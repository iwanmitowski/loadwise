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
import { axleScore, emptySupportLoads, itemSupportDelta } from './axles'
import { computeSupport } from './support'
import { validateCandidate } from './validate'

export type TripPlanInput = {
  items: CargoItem[]
  shops: Shop[]
  vehicle: VehicleDefinition
  config: OptimizerConfig
  /**
   * Optional per-item hook (added for T07). Invoked once after each item in the
   * insertion sequence is processed — placed or not — with the 1-based `index`
   * and the sequence `total`. Returning a truthy value aborts the remaining
   * items: they are returned in `unplaced` with reason `no-valid-placement` and
   * detail `'time-limit'`. T07 uses this both to emit progress and to enforce
   * the safety time limit. Left undefined, `planSingleTrip` behaves exactly as
   * before (no abort, no callback overhead).
   */
  onItemPlaced?: (progress: { index: number; total: number }) => boolean | void
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
  const { items, shops, vehicle, config, onItemPlaced } = input
  const space = vehicle.cargoSpace
  const diagonal = Math.hypot(space.width, space.height, space.depth)

  const shopById = new Map(shops.map((s) => [s.id, s]))

  // --- Stops present in this trip, ordered by delivery order (the front-pack
  // boundary needs each item's rank). Derived from the items actually loaded. ---
  const presentShopIds = new Set(items.map((i) => i.shopId))
  const stops = [...presentShopIds]
    .map((id) => shopById.get(id))
    .filter((s): s is Shop => s !== undefined)
    .sort((a, b) => a.deliveryOrder - b.deliveryOrder || (a.id < b.id ? -1 : 1))
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
  // Running z-moment (kg·cm) of the committed load — with currentWeightKg this
  // gives the load's longitudinal centre of gravity for the stability term.
  let projMomentZ = 0
  // Running axle contributions of the committed load (kg on front/kingpin and
  // rear/axle-group). Only meaningful when the vehicle has axle data.
  let projAxleA = 0
  let projAxleB = 0
  // Delivery rank of each committed box, for the front-pack band boundary.
  const rankByCargo = new Map<string, number>()
  let loadingOrder = 0

  for (let i = 0; i < sequence.length; i++) {
    const item = sequence[i]
    const template = getTemplate(item.templateId)
    const side = doorSideByItem.get(item.id)!
    const door = vehicle.doors.find((d) => d.side === side)!
    const rank = rankByShop.get(item.shopId) ?? 0
    // Front-pack boundary: this item may not end deeper than the shallowest box
    // of any LATER stop (that band was packed first — intruding beside it would
    // block its unloading). Constant per item, so computed outside the
    // candidate loop.
    const boundary = laterBandBoundary(placed, rankByCargo, rank, space.depth)

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
          boundary,
          space,
          diagonal,
          placed,
          projLeft,
          projRight,
          projMomentZ,
          projAxleA,
          projAxleB,
          axles: vehicle.axles,
          currentWeightKg,
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
    } else {
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
      rankByCargo.set(item.id, rank)
      currentWeightKg += best.box.weightKg
      const [l, r] = projectLeftRight(best.box, space.width)
      projLeft += l
      projRight += r
      projMomentZ += best.box.weightKg * (best.box.min.z + best.box.size.depth / 2)
      if (vehicle.axles) {
        const delta = itemSupportDelta(
          best.box.min.z + best.box.size.depth / 2,
          best.box.weightKg,
          vehicle.axles,
        )
        projAxleA += delta.aKg
        projAxleB += delta.bKg
      }
      candidatePoints = updateCandidatePoints(
        candidatePoints,
        best.box,
        placed,
        config.candidatePointCap,
      )
    }

    // Per-item hook (T07): progress + safety-time-limit abort. When it asks to
    // stop, the untouched tail of the sequence is returned as time-limited so
    // the multi-trip planner can mark those items and finish with best-so-far.
    if (onItemPlaced && onItemPlaced({ index: i + 1, total: sequence.length })) {
      for (let j = i + 1; j < sequence.length; j++) {
        unplaced.push({
          cargoId: sequence[j].id,
          shopId: sequence[j].shopId,
          reason: 'no-valid-placement',
          detail: 'time-limit',
        })
      }
      break
    }
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
    push(p.x, p.y, p.z - size.depth) // face-flush BEHIND the anchor plane at p.z
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
    // The box's own min corner: anchor plane for the face-flush-behind variant
    // (front-pack butts the next band up against this band's rear face). Never
    // strictly inside its own box, so the inside-drop below keeps it.
    { x: box.min.x, y: box.min.y, z: box.min.z },
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
  /** Front-pack limit: deepest z this item's band may reach (see rule 6). */
  boundary: number
  space: VehicleDefinition['cargoSpace']
  diagonal: number
  placed: PlacedBox[]
  projLeft: number
  projRight: number
  /** Running z-moment (kg·cm) of the committed load. */
  projMomentZ: number
  /** Running axle contributions of the committed load (kg). */
  projAxleA: number
  projAxleB: number
  /** Axle geometry when the vehicle has it — switches the longitudinal term. */
  axles: VehicleDefinition['axles']
  /** Total committed weight (kg) — with projMomentZ gives the load's z-CoG. */
  currentWeightKg: number
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
  // Vehicle stability: lateral (left/right) and longitudinal (front/rear)
  // balance share the weightBalance weight equally. With axle data the
  // longitudinal term is the axle-envelope score (physics-driven — the CoG
  // target follows the plated limits, per docs/physics.md); without it, the
  // geometric CoG proxy.
  const longitudinal = ctx.axles
    ? axleCandidateScore(box, ctx)
    : longitudinalBalance(box, ctx)
  const wb = (weightBalance(box, ctx) + longitudinal) / 2
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

/**
 * Front-pack rule (replaced the proportional band model — see T13 worklog):
 * rear-door cargo packs contiguously against the cabin wall (headboard),
 * order-preserving. `boundary` is the shallowest face of any LATER stop's band
 * — this item scores best flush against it (or the front wall when no later
 * band exists) and zero past it (intruding beside a later band would block its
 * unloading). Packing forward keeps the CoG off the rear overhang and gives
 * cargo a forward blocking chain under braking; the only cost is a longer
 * carry at early stops.
 */
function deliveryOrderCompatibility(box: PlacedBox, ctx: ScoreContext): number {
  if (ctx.door.side === 'rear') {
    if (ctx.boundary <= 0) return 0
    const faceZ = box.min.z + box.size.depth
    if (faceZ > ctx.boundary) return 0
    return clamp01(faceZ / ctx.boundary)
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

/**
 * The deepest z an item of delivery rank `rank` may reach: the minimum min-z
 * over committed boxes of LATER stops (their bands were packed first), else the
 * cabin wall. Keeps bands contiguous and strictly ordered rear→front by stop.
 */
function laterBandBoundary(
  placed: PlacedBox[],
  rankByCargo: Map<string, number>,
  rank: number,
  depth: number,
): number {
  let boundary = depth
  for (const b of placed) {
    const r = rankByCargo.get(b.cargoId)
    if (r !== undefined && r > rank && b.min.z < boundary) boundary = b.min.z
  }
  return boundary
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

/**
 * Longitudinal (front/rear) stability of the load *including* this candidate:
 * how close the load's z-centre-of-gravity sits to the middle of the cargo bay.
 * Strongly asymmetric — a rear-biased CoG (toward the rear door, z→0) is
 * penalised 4× as hard as a cabin-biased one: mass on the rear overhang sits
 * behind the rear axle and unloads the steering axle, which is most dangerous on
 * a lightly loaded vehicle, while forward bias sits over/between the axles and
 * is the *intent* of the front-pack rule (Directive 2014/47/EU Annex III
 * axle-load intent; the MVP has no axle geometry, so this is the proxy — see
 * the T13 worklog). The mild cabin-side slope only discourages extreme nose
 * bias; it must never fight deliveryOrderCompatibility's pull to the headboard.
 */
function longitudinalBalance(box: PlacedBox, ctx: ScoreContext): number {
  if (ctx.space.depth === 0) return 1
  const cz = box.min.z + box.size.depth / 2
  const momentZ = ctx.projMomentZ + box.weightKg * cz
  const totalKg = ctx.currentWeightKg + box.weightKg
  if (totalKg === 0) return 1
  const cogFrac = momentZ / totalKg / ctx.space.depth // 0 = rear door, 1 = cabin
  const deviation = cogFrac - 0.5
  const penalty = deviation >= 0 ? (0.5 * deviation) / 0.5 : (2 * -deviation) / 0.5
  return clamp01(1 - penalty)
}

/**
 * Axle-envelope quality of the load *including* this candidate: margin to the
 * plated maxima, guarded by the steer/kingpin minimum share (see axles.ts).
 * Uses the running committed contributions so each candidate costs O(1).
 */
function axleCandidateScore(box: PlacedBox, ctx: ScoreContext): number {
  const model = ctx.axles!
  const empty = emptySupportLoads(model)
  const delta = itemSupportDelta(
    box.min.z + box.size.depth / 2,
    box.weightKg,
    model,
  )
  const aKg = empty.aKg + ctx.projAxleA + delta.aKg
  const bKg = empty.bKg + ctx.projAxleB + delta.bKg
  return axleScore({ kind: model.kind, aKg, bKg, totalKg: aKg + bKg }, model)
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

  // Only axle limits blocked it: every position would overload an axle.
  if (seenCodes.size > 0 && [...seenCodes].every((c) => c === 'axle-overload')) {
    return {
      reason: 'no-valid-placement',
      detail: 'No position kept axle loads within limits (planning estimate).',
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
