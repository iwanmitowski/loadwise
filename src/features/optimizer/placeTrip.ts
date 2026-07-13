// The core placement heuristic: given the cargo for ONE trip, produce placements
// plus a list of items that could not be placed. Deterministic greedy best-fit —
// no global solver, no randomness (CLAUDE.md §Determinism). Extreme-point
// candidate generation + weighted scoring + T05 validation on every candidate.
//
// No React / Three imports: this is pure and runs inside the optimizer worker.

import { getTemplate, itemDimensions, itemVolume } from '@/features/cargo/templates'
import type {
  CargoItem,
  CargoPlacement,
  CargoTemplate,
  DoorSide,
  OptimizerConfig,
  Shop,
  UnplacedReason,
  Vec3,
  VehicleDefinition,
  VehicleDoor,
} from '@/types'
import { fitsThroughDoor, insideVehicle, type PlacedBox } from './geometry'
import { computeSupport } from './support'
import { validateCandidate } from './validate'

export type TripPlanInput = {
  items: CargoItem[]
  shops: Shop[]
  vehicle: VehicleDefinition
  config: OptimizerConfig
}

export type TripPlanOutput = {
  /** tripId is assigned by the multi-trip planner (T07), so it is omitted here. */
  placements: Array<Omit<CargoPlacement, 'tripId'>>
  unplaced: Array<{
    cargoId: string
    shopId: string
    reason: UnplacedReason
    detail?: string
  }>
}

/** Support-chain violation codes — the failures that mean "stacking constraint". */
const STACKING_CODES = new Set([
  'insufficient-support',
  'floor-only-violated',
  'unstackable-support',
  'support-overweight',
])

const ORIENTATIONS: Array<0 | 90> = [0, 90]

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Center of a placed box in cargo-space coordinates. */
function center(box: PlacedBox): Vec3 {
  return {
    x: box.min.x + box.size.width / 2,
    y: box.min.y + box.size.height / 2,
    z: box.min.z + box.size.depth / 2,
  }
}

/** Center of a door's opening on its wall plane. */
function doorOpeningCenter(door: VehicleDoor, space: VehicleDefinition['cargoSpace']): Vec3 {
  const y = door.position.y + door.height / 2
  if (door.side === 'rear') {
    return { x: door.position.x + door.width / 2, y, z: 0 }
  }
  // side doors: `width` runs along Z; pinned to the x=0 / x=width wall.
  const x = door.side === 'left' ? 0 : space.width
  return { x, y, z: door.position.z + door.width / 2 }
}

/** A validated candidate placement plus its combined score, for best-of selection. */
type Scored = { box: PlacedBox; rotationY: 0 | 90; score: number }

export function planSingleTrip(input: TripPlanInput): TripPlanOutput {
  const { items, shops, vehicle, config } = input
  const space = vehicle.cargoSpace
  const diagonal = Math.hypot(space.width, space.height, space.depth)

  const shopById = new Map(shops.map((s) => [s.id, s]))

  // --- Stops present in this trip, ordered by delivery order (rule 6 needs the
  // rank + count). Derived from the items actually being loaded. ---
  const presentShopIds = new Set(items.map((i) => i.shopId))
  const stops = [...presentShopIds]
    .map((id) => shopById.get(id))
    .filter((s): s is Shop => s !== undefined)
    .sort((a, b) => a.deliveryOrder - b.deliveryOrder || (a.id < b.id ? -1 : 1))
  const stopCount = stops.length
  const rankByShop = new Map(stops.map((s, i) => [s.id, i]))

  // --- Rule 1: door assignment per item. ---
  const doorSideByItem = new Map<string, DoorSide>()
  for (const item of items) {
    doorSideByItem.set(item.id, assignDoor(item, shopById.get(item.shopId), vehicle))
  }

  // --- Rule 2: insertion sequence. Shops in reverse delivery order; within a
  // shop floorOnly → weight desc → volume desc → id asc. ---
  const itemsByShop = new Map<string, CargoItem[]>()
  for (const item of items) {
    const bucket = itemsByShop.get(item.shopId)
    if (bucket) bucket.push(item)
    else itemsByShop.set(item.shopId, [item])
  }
  const reverseStops = [...stops].sort(
    (a, b) => b.deliveryOrder - a.deliveryOrder || (a.id < b.id ? -1 : 1),
  )
  const sequence: CargoItem[] = []
  const seenShopIds = new Set<string>()
  for (const shop of reverseStops) {
    const bucket = itemsByShop.get(shop.id) ?? []
    bucket.sort(compareWithinShop)
    sequence.push(...bucket)
    seenShopIds.add(shop.id)
  }
  // Defensive: any item whose shop was not resolvable still gets a turn (last).
  for (const [shopId, bucket] of itemsByShop) {
    if (seenShopIds.has(shopId)) continue
    bucket.sort(compareWithinShop)
    sequence.push(...bucket)
  }

  // --- Greedy placement loop. ---
  const placed: PlacedBox[] = []
  const placements: TripPlanOutput['placements'] = []
  const unplaced: TripPlanOutput['unplaced'] = []
  let candidatePoints: Vec3[] = [{ x: 0, y: 0, z: 0 }]
  let currentWeightKg = 0
  let projLeft = 0
  let projRight = 0
  let loadingOrder = 0

  for (const item of sequence) {
    const template = getTemplate(item.templateId)
    const side = doorSideByItem.get(item.id)!
    const door = vehicle.doors.find((d) => d.side === side)!
    const rank = rankByShop.get(item.shopId) ?? 0

    let best: Scored | null = null
    const seenCodes = new Set<string>()

    for (const rotationY of ORIENTATIONS) {
      const size = itemDimensions(template, rotationY)
      // Skip the redundant 90° orientation for a square footprint.
      if (rotationY === 90 && template.dimensions.width === template.dimensions.depth) {
        continue
      }

      for (const minCorner of candidatePositions(candidatePoints, size, space)) {
        const box: PlacedBox = {
          cargoId: item.id,
          templateId: template.id,
          min: minCorner,
          size,
          weightKg: template.weightKg,
        }
        // Cheap bounds guard before the (pricier) full validation.
        if (!insideVehicle(box, space)) continue

        const violations = validateCandidate(box, placed, vehicle, config, currentWeightKg)
        if (violations.length > 0) {
          for (const v of violations) seenCodes.add(v.code)
          continue
        }

        const score = scorePlacement(box, {
          door,
          rank,
          stopCount,
          space,
          diagonal,
          placed,
          projLeft,
          projRight,
          weights: config.weights,
        })
        if (best === null || isBetter(box, score, best)) {
          best = { box, rotationY, score }
        }
      }
    }

    if (best === null) {
      const { reason, detail } = classifyUnplaced(template, currentWeightKg, seenCodes, vehicle)
      unplaced.push({ cargoId: item.id, shopId: item.shopId, reason, detail })
      continue
    }

    // Commit the best placement.
    loadingOrder += 1
    placements.push({
      cargoId: item.id,
      position: best.box.min,
      rotationY: best.rotationY,
      loadingOrder,
      assignedDoor: side,
    })
    placed.push(best.box)
    currentWeightKg += best.box.weightKg
    const [l, r] = projectLeftRight(best.box, space.width)
    projLeft += l
    projRight += r
    candidatePoints = updateCandidatePoints(
      candidatePoints,
      best.box,
      placed,
      config.candidatePointCap,
    )
  }

  return { placements, unplaced }
}

// --------------------------------------------------------------------------
// Door assignment (rule 1)
// --------------------------------------------------------------------------

function assignDoor(
  item: CargoItem,
  shop: Shop | undefined,
  vehicle: VehicleDefinition,
): DoorSide {
  const preferred =
    shop && vehicle.doors.some((d) => d.side === shop.preferredDoor)
      ? shop.preferredDoor
      : 'rear'
  if (preferred === 'rear') return 'rear'

  // Side door preferred: the item must physically pass it (either rotation),
  // otherwise it individually falls back to the rear door.
  const sideDoor = vehicle.doors.find((d) => d.side === preferred)!
  const template = getTemplate(item.templateId)
  const fits =
    fitsThroughDoor(itemDimensions(template, 0), sideDoor) ||
    fitsThroughDoor(itemDimensions(template, 90), sideDoor)
  return fits ? preferred : 'rear'
}

// --------------------------------------------------------------------------
// Ordering (rule 2)
// --------------------------------------------------------------------------

function compareWithinShop(a: CargoItem, b: CargoItem): number {
  const ta = getTemplate(a.templateId)
  const tb = getTemplate(b.templateId)
  // floorOnly first
  if (ta.floorOnly !== tb.floorOnly) return ta.floorOnly ? -1 : 1
  // weight desc
  if (ta.weightKg !== tb.weightKg) return tb.weightKg - ta.weightKg
  // volume desc
  const va = itemVolume(ta)
  const vb = itemVolume(tb)
  if (va !== vb) return vb - va
  // id asc
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

// --------------------------------------------------------------------------
// Candidate positions (rule 3)
// --------------------------------------------------------------------------

/**
 * For the current item size, expand each stored extreme point into the base
 * position plus wall-flush variants (max-z face against the cabin wall, min-x
 * face against each side wall). Positions are deduped and clamped into bounds;
 * out-of-bounds or overlapping variants are simply dropped by the caller's
 * validation. Yields min corners.
 */
function candidatePositions(
  points: Vec3[],
  size: { width: number; height: number; depth: number },
  space: VehicleDefinition['cargoSpace'],
): Vec3[] {
  const out: Vec3[] = []
  const seen = new Set<string>()
  const push = (x: number, y: number, z: number) => {
    if (x < 0 || y < 0 || z < 0) return
    const key = `${x},${y},${z}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ x, y, z })
  }
  for (const p of points) {
    push(p.x, p.y, p.z) // base
    push(p.x, p.y, space.depth - size.depth) // flush to cabin wall (max z)
    push(0, p.y, p.z) // flush to left wall
    push(space.width - size.width, p.y, p.z) // flush to right wall
  }
  return out
}

/**
 * After placing `box`, seed three new extreme points, drop points that now fall
 * strictly inside any placed box, dedupe, and cap. Eviction order is
 * deterministic: keep points with lowest y, then highest z, then lowest x —
 * points ranked last are evicted first.
 */
function updateCandidatePoints(
  points: Vec3[],
  box: PlacedBox,
  placed: PlacedBox[],
  cap: number,
): Vec3[] {
  const next = [
    ...points,
    { x: box.min.x + box.size.width, y: box.min.y, z: box.min.z },
    { x: box.min.x, y: box.min.y, z: box.min.z + box.size.depth },
    { x: box.min.x, y: box.min.y + box.size.height, z: box.min.z },
  ]

  // Dedupe.
  const seen = new Set<string>()
  const deduped: Vec3[] = []
  for (const p of next) {
    const key = `${p.x},${p.y},${p.z}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(p)
  }

  // Drop points strictly inside any placed box (they can never be a min corner).
  const kept = deduped.filter((p) => !placed.some((b) => strictlyInside(p, b)))

  // Deterministic keep-order: lowest y, then highest z, then lowest x.
  kept.sort((a, b) => a.y - b.y || b.z - a.z || a.x - b.x)
  return kept.length > cap ? kept.slice(0, cap) : kept
}

function strictlyInside(p: Vec3, b: PlacedBox): boolean {
  return (
    p.x > b.min.x &&
    p.x < b.min.x + b.size.width &&
    p.y > b.min.y &&
    p.y < b.min.y + b.size.height &&
    p.z > b.min.z &&
    p.z < b.min.z + b.size.depth
  )
}

// --------------------------------------------------------------------------
// Scoring (rule 6) + selection (rule 7)
// --------------------------------------------------------------------------

type ScoreContext = {
  door: VehicleDoor
  rank: number
  stopCount: number
  space: VehicleDefinition['cargoSpace']
  diagonal: number
  placed: PlacedBox[]
  projLeft: number
  projRight: number
  weights: OptimizerConfig['weights']
}

function scorePlacement(box: PlacedBox, ctx: ScoreContext): number {
  const w = ctx.weights
  const sum =
    w.compactness +
    w.floorPreference +
    w.weightBalance +
    w.doorAccessibility +
    w.deliveryOrderCompatibility +
    w.supportQuality
  if (sum === 0) return 0

  const doc = deliveryOrderCompatibility(box, ctx)
  const da = doorAccessibility(box, ctx)
  const comp = compactness(box, ctx)
  const floor = clamp01(1 - box.min.y / ctx.space.height)
  const wb = weightBalance(box, ctx)
  const sq = clamp01(computeSupport(box, ctx.placed).ratio)

  return (
    (w.deliveryOrderCompatibility * doc +
      w.doorAccessibility * da +
      w.compactness * comp +
      w.floorPreference * floor +
      w.weightBalance * wb +
      w.supportQuality * sq) /
    sum
  )
}

function deliveryOrderCompatibility(box: PlacedBox, ctx: ScoreContext): number {
  const cz = box.min.z + box.size.depth / 2
  if (ctx.door.side === 'rear') {
    // Later deliveries → deeper ideal band (see worklog note on the naming of
    // this term in the T06 prompt). rank 0 = first stop (shallow, near door).
    const idealZ = (ctx.space.depth * (ctx.rank + 0.5)) / ctx.stopCount
    return clamp01(1 - Math.abs(idealZ - cz) / ctx.space.depth)
  }
  // Side door: 1 when the item's z-interval overlaps the door's z-interval,
  // else decays with the gap to that interval.
  const bz0 = box.min.z
  const bz1 = box.min.z + box.size.depth
  const dz0 = ctx.door.position.z
  const dz1 = ctx.door.position.z + ctx.door.width
  const overlap = Math.min(bz1, dz1) - Math.max(bz0, dz0)
  if (overlap >= 0) return 1
  const gap = Math.max(bz0, dz0) - Math.min(bz1, dz1)
  return clamp01(1 - gap / ctx.space.depth)
}

function doorAccessibility(box: PlacedBox, ctx: ScoreContext): number {
  const c = center(box)
  const o = doorOpeningCenter(ctx.door, ctx.space)
  const dist = Math.hypot(c.x - o.x, c.y - o.y, c.z - o.z)
  return clamp01(1 - dist / ctx.diagonal)
}

/** Fraction (0, ⅓, ⅔, 1) of the x-min, y-min and z-max faces touching a wall or box. */
function compactness(box: PlacedBox, ctx: ScoreContext): number {
  const zMax = box.min.z + box.size.depth

  const xTouch =
    box.min.x === 0 ||
    ctx.placed.some(
      (b) =>
        b.min.x + b.size.width === box.min.x &&
        overlaps(b.min.y, b.size.height, box.min.y, box.size.height) &&
        overlaps(b.min.z, b.size.depth, box.min.z, box.size.depth),
    )
  const yTouch =
    box.min.y === 0 ||
    ctx.placed.some(
      (b) =>
        b.min.y + b.size.height === box.min.y &&
        overlaps(b.min.x, b.size.width, box.min.x, box.size.width) &&
        overlaps(b.min.z, b.size.depth, box.min.z, box.size.depth),
    )
  const zTouch =
    zMax === ctx.space.depth ||
    ctx.placed.some(
      (b) =>
        b.min.z === zMax &&
        overlaps(b.min.x, b.size.width, box.min.x, box.size.width) &&
        overlaps(b.min.y, b.size.height, box.min.y, box.size.height),
    )

  return ((xTouch ? 1 : 0) + (yTouch ? 1 : 0) + (zTouch ? 1 : 0)) / 3
}

function overlaps(aMin: number, aLen: number, bMin: number, bLen: number): boolean {
  return aMin < bMin + bLen && bMin < aMin + aLen
}

/** 1 − |left−right| / total, using the box's mass projected onto the two X halves. */
function weightBalance(box: PlacedBox, ctx: ScoreContext): number {
  const [l, r] = projectLeftRight(box, ctx.space.width)
  const left = ctx.projLeft + l
  const right = ctx.projRight + r
  const total = left + right
  if (total === 0) return 1
  return clamp01(1 - Math.abs(left - right) / total)
}

/** Split a box's weight across the vehicle's X midline in proportion to width. */
function projectLeftRight(box: PlacedBox, vehicleWidth: number): [number, number] {
  const mid = vehicleWidth / 2
  const x0 = box.min.x
  const x1 = box.min.x + box.size.width
  const leftLen = Math.max(0, Math.min(x1, mid) - x0)
  const w = box.size.width
  const leftKg = w === 0 ? 0 : (box.weightKg * leftLen) / w
  return [leftKg, box.weightKg - leftKg]
}

/** Selection tiebreak (rule 7): higher score, then lower y → higher z → lower x. */
function isBetter(box: PlacedBox, score: number, best: Scored): boolean {
  if (score !== best.score) return score > best.score
  if (box.min.y !== best.box.min.y) return box.min.y < best.box.min.y
  if (box.min.z !== best.box.min.z) return box.min.z > best.box.min.z
  return box.min.x < best.box.min.x
}

// --------------------------------------------------------------------------
// Unplaced reason (rule 8)
// --------------------------------------------------------------------------

function classifyUnplaced(
  template: CargoTemplate,
  currentWeightKg: number,
  seenCodes: Set<string>,
  vehicle: VehicleDefinition,
): { reason: UnplacedReason; detail?: string } {
  const space = vehicle.cargoSpace
  const fits0 = fitsInBounds(itemDimensions(template, 0), space)
  const fits90 = fitsInBounds(itemDimensions(template, 90), space)
  if (!fits0 && !fits90) {
    const d = template.dimensions
    const dims: string[] = []
    if (Math.min(d.width, d.depth) > Math.max(space.width, space.depth)) dims.push('footprint')
    else {
      if (d.width > space.width && d.depth > space.depth) dims.push('width/depth')
      if (d.height > space.height) dims.push('height')
    }
    return {
      reason: 'exceeds-vehicle-dimensions',
      detail: `Exceeds cargo space (${dims.length ? dims.join(', ') : 'dimensions'}).`,
    }
  }

  if (template.weightKg > vehicle.maxPayloadKg) {
    return {
      reason: 'exceeds-payload',
      detail: `Item ${template.weightKg}kg exceeds vehicle payload ${vehicle.maxPayloadKg}kg.`,
    }
  }

  if (currentWeightKg + template.weightKg > vehicle.maxPayloadKg) {
    return {
      reason: 'exceeds-payload',
      detail: `Payload remaining ${vehicle.maxPayloadKg - currentWeightKg}kg, item needs ${template.weightKg}kg.`,
    }
  }

  if (seenCodes.size > 0 && [...seenCodes].every((c) => STACKING_CODES.has(c))) {
    return {
      reason: 'stacking-constraint',
      detail: 'No position satisfied support/stacking constraints.',
    }
  }

  return { reason: 'no-valid-placement' }
}

function fitsInBounds(
  size: { width: number; height: number; depth: number },
  space: VehicleDefinition['cargoSpace'],
): boolean {
  return (
    size.width <= space.width &&
    size.height <= space.height &&
    size.depth <= space.depth
  )
}
