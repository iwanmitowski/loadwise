// Pure metrics layer (T08). Turns one finished trip's placements into the
// `OptimizationMetrics` the report screen shows — every number the UI displays
// comes from here. Deterministic and div-by-zero-proof: guards on empty trips,
// zero weight, and zero-volume vehicles (see idea.md §Optimization Report and
// the T08 prompt for the exact formulas). No React / Three imports — this runs
// in the optimizer worker just like the placement heuristic.

import { getTemplate, itemVolume } from '@/features/cargo/templates'
import { findBlockers } from '@/features/optimizer/accessibility'
import { axleComplianceScore, supportLoads } from '@/features/optimizer/axles'
import { toPlacedBox, type PlacedBox } from '@/features/optimizer/geometry'
import { validateLoad } from '@/features/optimizer/validate'
import type {
  CargoPlacement,
  CargoTemplate,
  DeliveryStop,
  OptimizationMetrics,
  OptimizerConfig,
  Scenario,
  UnplacedCargo,
} from '@/types'
import { computeTripScore } from './score'

/** The minimal trip shape metrics need — a full `DeliveryTrip` satisfies it. */
export type TripInput = {
  placements: CargoPlacement[]
  deferredCargo: UnplacedCargo[]
  stops: DeliveryStop[]
}

/** Mass of a trip split across the two mid-planes (proportional to overlap). */
export type WeightSplit = {
  left: number
  right: number
  /** rear = the z < depth/2 half (nearest the rear door). */
  rear: number
  front: number
  total: number
}

/**
 * Compute every field of `OptimizationMetrics` for one trip. `requestedUnitsForTrip`
 * is how many items were presented to this trip (loaded + deferred) — the planner
 * knows it, metrics can't re-derive it. Guards make every ratio safe: an empty
 * trip yields zeroed ratios, balances of 1, and a score of 0.
 */
export function buildTripMetrics(
  trip: TripInput,
  scenario: Scenario,
  requestedUnitsForTrip: number,
  config: OptimizerConfig,
): OptimizationMetrics {
  const { vehicle } = scenario
  const space = vehicle.cargoSpace
  const templateByCargo = cargoTemplateMap(scenario)
  const shopByCargo = cargoShopMap(scenario)

  const boxes = resolveBoxes(trip.placements, templateByCargo)
  const loadedUnits = boxes.length

  let totalWeightKg = 0
  let usedVolumeCm3 = 0
  for (const box of boxes) {
    totalWeightKg += box.weightKg
    usedVolumeCm3 += itemVolume(getTemplate(box.templateId))
  }

  const vehicleVolume = space.width * space.height * space.depth
  const volumeUtilization = vehicleVolume === 0 ? 0 : usedVolumeCm3 / vehicleVolume
  const weightUtilization = vehicle.maxPayloadKg === 0 ? 0 : totalWeightKg / vehicle.maxPayloadKg
  const emptyVolumeCm3 = Math.max(0, vehicleVolume - usedVolumeCm3)

  const split = weightSplit(boxes, space)
  const leftRightBalance = split.total === 0 ? 1 : 1 - Math.abs(split.left - split.right) / split.total
  const frontRearBalance = split.total === 0 ? 1 : 1 - Math.abs(split.rear - split.front) / split.total

  const { blockedCargoCount, extraUnloadingMoves } = blockingStats(trip, boxes, scenario, shopByCargo)

  const splitShopIds = deriveSplitShopIds(trip, shopByCargo)
  const constraintViolations = validateLoad(trip.placements, scenario, config).length
  const longitudinalStability = longitudinalStabilityScore(boxes, vehicle, split)

  const overallScore = computeTripScore({
    loadedUnits,
    volumeUtilization,
    weightUtilization,
    leftRightBalance,
    longitudinalStability,
    blockedCargoCount,
    splitShopCount: splitShopIds.length,
    stopCount: trip.stops.length,
  })

  return {
    requestedUnits: requestedUnitsForTrip,
    loadedUnits,
    deferredUnits: trip.deferredCargo.length,
    totalWeightKg,
    weightUtilization,
    usedVolumeCm3,
    volumeUtilization,
    emptyVolumeCm3,
    leftRightBalance,
    frontRearBalance,
    longitudinalStability,
    blockedCargoCount,
    extraUnloadingMoves,
    splitShopIds,
    constraintViolations,
    overallScore,
  }
}

// --------------------------------------------------------------------------
// Shared helpers (also used by warnings.ts / reportModel.ts)
// --------------------------------------------------------------------------

/** cargoId → its resolved template, over every item the scenario requested. */
export function cargoTemplateMap(scenario: Scenario): Map<string, CargoTemplate> {
  const map = new Map<string, CargoTemplate>()
  for (const shop of scenario.shops) {
    for (const item of shop.requestedCargo) {
      map.set(item.id, getTemplate(item.templateId))
    }
  }
  return map
}

/** cargoId → owning shopId, over every item the scenario requested. */
export function cargoShopMap(scenario: Scenario): Map<string, string> {
  const map = new Map<string, string>()
  for (const shop of scenario.shops) {
    for (const item of shop.requestedCargo) map.set(item.id, shop.id)
  }
  return map
}

/** Resolve placements to boxes, skipping any whose cargo the scenario never requested. */
function resolveBoxes(
  placements: CargoPlacement[],
  templateByCargo: Map<string, CargoTemplate>,
): PlacedBox[] {
  const boxes: PlacedBox[] = []
  for (const p of placements) {
    const template = templateByCargo.get(p.cargoId)
    if (template) boxes.push(toPlacedBox(p, template))
  }
  return boxes
}

/**
 * Split each box's mass across the X mid-plane (left/right) and Z mid-plane
 * (rear/front) in proportion to how much of its footprint lies on each side —
 * an item straddling a plane contributes each side its overlap fraction × weight.
 * Exposed so warnings can name the heavier side.
 */
export function weightSplit(boxes: PlacedBox[], space: Scenario['vehicle']['cargoSpace']): WeightSplit {
  const midX = space.width / 2
  const midZ = space.depth / 2
  let left = 0
  let right = 0
  let rear = 0
  let front = 0
  let total = 0
  for (const box of boxes) {
    total += box.weightKg
    const [l, r] = splitAxis(box.min.x, box.size.width, midX, box.weightKg)
    left += l
    right += r
    // rear = low half (z < depth/2), nearest the rear door.
    const [rearW, frontW] = splitAxis(box.min.z, box.size.depth, midZ, box.weightKg)
    rear += rearW
    front += frontW
  }
  return { left, right, rear, front, total }
}

/** Convenience: resolve + split a whole trip in one call (used by warnings). */
export function tripWeightSplit(trip: TripInput, scenario: Scenario): WeightSplit {
  const boxes = resolveBoxes(trip.placements, cargoTemplateMap(scenario))
  return weightSplit(boxes, scenario.vehicle.cargoSpace)
}

/**
 * Longitudinal stability 0..1 for the score (T22): axle-envelope compliance
 * when the vehicle has axle geometry (full marks within limits, healthy steer
 * share), else a forward-CoG proxy — mass toward the cabin is rewarded, mass on
 * the rear overhang penalised. Deliberately NOT a 50/50 front–rear split: the
 * planner loads forward on purpose (front-pack + axle scoring), so a 50/50
 * target would grade the correct behaviour as an imbalance.
 */
export function longitudinalStabilityScore(
  boxes: PlacedBox[],
  vehicle: Scenario['vehicle'],
  split: WeightSplit,
): number {
  if (vehicle.axles) {
    return axleComplianceScore(supportLoads(boxes, vehicle.axles), vehicle.axles)
  }
  if (split.total === 0) return 1
  // frontShare 0 = all on rear overhang, 1 = all at the cabin. Centre (0.5)
  // scores 0.7; forward → up to 1; rear-biased → down toward 0.
  const frontShare = split.front / split.total
  return Math.max(0, Math.min(1, 0.7 + (frontShare - 0.5) * 1.2))
}

/** Portion of `weight` on the low side of `mid`, then the remainder, by width overlap. */
function splitAxis(min: number, len: number, mid: number, weight: number): [number, number] {
  const lowLen = Math.max(0, Math.min(min + len, mid) - min)
  const lowKg = len === 0 ? 0 : (weight * lowLen) / len
  return [lowKg, weight - lowKg]
}

/**
 * Blocked-cargo and extra-unloading counts. A blocker only matters when it is
 * delivered at a *later* stop than the item it blocks (same-stop items unload
 * together, so they don't count). `blockedCargoCount` = items with ≥ 1 such
 * blocker; `extraUnloadingMoves` = per stop, the distinct later-delivered items
 * that must be moved to reach anything unloaded there, summed across stops.
 */
function blockingStats(
  trip: TripInput,
  boxes: PlacedBox[],
  scenario: Scenario,
  shopByCargo: Map<string, string>,
): { blockedCargoCount: number; extraUnloadingMoves: number } {
  const stopByShop = new Map(trip.stops.map((s) => [s.shopId, s.stopNumber]))
  const placementByCargo = new Map(trip.placements.map((p) => [p.cargoId, p]))
  const stopOf = (cargoId: string): number | undefined => {
    const shopId = shopByCargo.get(cargoId)
    return shopId === undefined ? undefined : stopByShop.get(shopId)
  }

  // Group loaded boxes by the stop that unloads them.
  const boxesByStop = new Map<number, PlacedBox[]>()
  for (const box of boxes) {
    const stop = stopOf(box.cargoId)
    if (stop === undefined) continue
    const bucket = boxesByStop.get(stop)
    if (bucket) bucket.push(box)
    else boxesByStop.set(stop, [box])
  }

  let blockedCargoCount = 0
  let extraUnloadingMoves = 0
  for (const [stopNumber, stopBoxes] of boxesByStop) {
    const movesForStop = new Set<string>()
    for (const target of stopBoxes) {
      const placement = placementByCargo.get(target.cargoId)!
      const door = scenario.vehicle.doors.find((d) => d.side === placement.assignedDoor)
      if (!door) continue
      const laterBlockers = findBlockers(target, door, boxes).filter((id) => {
        const s = stopOf(id)
        return s !== undefined && s > stopNumber
      })
      if (laterBlockers.length > 0) blockedCargoCount += 1
      for (const id of laterBlockers) movesForStop.add(id)
    }
    extraUnloadingMoves += movesForStop.size
  }

  return { blockedCargoCount, extraUnloadingMoves }
}

/** Shops with some cargo placed this trip AND some deferred — i.e. split (sorted by id). */
function deriveSplitShopIds(trip: TripInput, shopByCargo: Map<string, string>): string[] {
  const placedShops = new Set<string>()
  for (const p of trip.placements) {
    const shopId = shopByCargo.get(p.cargoId)
    if (shopId !== undefined) placedShops.add(shopId)
  }
  const deferredShops = new Set(trip.deferredCargo.map((d) => d.shopId))
  return [...placedShops]
    .filter((id) => deferredShops.has(id))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}
