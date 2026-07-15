// The optimizer's public entry point (T07). Wraps the single-trip heuristic
// (T06 `planSingleTrip`) in the overflow loop: keep creating trips until all
// cargo is placed or proven unplaceable, with hard caps that prevent infinite
// trip generation (idea.md §Automatic trip planning).
//
// Pure and deterministic apart from one documented seam: `elapsedMs` and the
// safety time-limit read the injected `Clock`. Same seed + config ⇒ identical
// result in every field except `elapsedMs`. No React / Three imports — this runs
// inside the optimizer Web Worker (T11).
//
// Metrics, warnings and the overall score come from T08's report layer
// (`src/features/reports/`): each trip is metricked as it is assembled, then the
// finished result is scored and warned in one pass. `time-limit` is the one
// warning T07 owns (idea.md warnings table); T08's `buildWarnings` passes it through.

import { getTemplate, itemDimensions } from '@/features/cargo/templates'
import { buildTripMetrics } from '@/features/reports/metrics'
import { overallScore } from '@/features/reports/score'
import { buildWarnings } from '@/features/reports/warnings'
import type {
  CargoItem,
  CargoPlacement,
  DeliveryStop,
  DeliveryTrip,
  DoorSide,
  Dimensions,
  OptimizationResult,
  OptimizationWarning,
  OptimizerConfig,
  Scenario,
  Shop,
  UnplacedCargo,
  VehicleDefinition,
} from '@/types'
import { type Clock, performanceClock } from '@/utils/clock'
import { overloadBreaches, supportLoads } from './axles'
import { fitsThroughDoor, type PlacedBox } from './geometry'
import { computeSupport } from './support'
import { planSingleTrip } from './placeTrip'

export type ProgressFn = (percent: number, stage: string) => void

/**
 * Plan how the scenario's cargo loads into its vehicle across one or more trips.
 * `onProgress` (optional) is called at least once per trip and roughly every ten
 * items, never more than ~50×/run. `clock` is injectable for tests; production
 * callers omit it and get `performanceClock`.
 */
export function optimize(
  scenario: Scenario,
  config: OptimizerConfig,
  onProgress?: ProgressFn,
  clock: Clock = performanceClock,
): OptimizationResult {
  const startedAt = clock()
  const { vehicle } = scenario

  const allItems = scenario.shops.flatMap((s) => s.requestedCargo)
  const itemById = new Map(allItems.map((i) => [i.id, i]))
  const shopByCargo = new Map(allItems.map((i) => [i.id, i.shopId]))
  const shopById = new Map(scenario.shops.map((s) => [s.id, s]))

  const trips: DeliveryTrip[] = []
  const warnings: OptimizationWarning[] = []

  // --- Step 1: pre-filter permanently unplaceable items (never enter the loop). ---
  const { placeable, permanent } = prefilterPermanents(allItems, vehicle)
  const unplaceable: UnplacedCargo[] = [...permanent]

  const totalPlaceable = placeable.length
  let placedSoFar = 0
  let remaining: CargoItem[] = placeable
  let timeLimitHit = false

  // Shared helper: turn a trip's kept placements into ordered delivery stops.
  const buildStops = (placements: CargoPlacement[]): DeliveryStop[] => {
    const placedShopIds = new Set(placements.map((p) => shopByCargo.get(p.cargoId)!))
    return scenario.shops
      .filter((s) => placedShopIds.has(s.id))
      .sort((a, b) => a.deliveryOrder - b.deliveryOrder || (a.id < b.id ? -1 : 1))
      .map((s, i) => ({ shopId: s.id, stopNumber: i + 1, door: shopDoor(s, vehicle) }))
  }

  // --- Step 2: trip loop, capped at config.maxTrips. ---
  for (let tripNumber = 1; tripNumber <= config.maxTrips; tripNumber++) {
    if (remaining.length === 0) break
    const tripId = `trip-${tripNumber}`
    const presented = remaining.length
    const placedBefore = placedSoFar

    onProgress?.(pct(placedBefore, totalPlaceable), `Trip ${tripNumber}: planning ${presented} item(s)`)

    const plan = planSingleTrip({
      items: remaining,
      shops: scenario.shops,
      vehicle,
      config,
      onItemPlaced: ({ index }) => {
        if (index % 10 === 0) {
          onProgress?.(
            pct(placedBefore + index, totalPlaceable),
            `Trip ${tripNumber}: placing ${index}/${presented}`,
          )
        }
        if (clock() - startedAt >= config.safetyTimeLimitMs) {
          timeLimitHit = true
          return true
        }
        return false
      },
    })

    // --- Step 10: safety time limit — finish with best-so-far, everything else
    // is permanently unplaceable for this result. ---
    if (timeLimitHit) {
      if (plan.placements.length > 0) {
        const placements = stamp(plan.placements, tripId)
        const stops = buildStops(placements)
        trips.push({
          id: tripId,
          tripNumber,
          stops,
          placements,
          deferredCargo: [],
          metrics: buildTripMetrics({ placements, deferredCargo: [], stops }, scenario, presented, config),
        })
      }
      for (const u of plan.unplaced) {
        unplaceable.push({
          cargoId: u.cargoId,
          shopId: u.shopId,
          reason: 'no-valid-placement',
          permanent: true,
          detail: 'time-limit',
        })
      }
      warnings.push({
        code: 'time-limit',
        message: 'Optimization stopped at the time limit; result may be partial.',
      })
      remaining = []
      break
    }

    // --- Step 4: loop safety — a trip that places nothing means the remaining
    // items cannot be placed even in an empty vehicle. Stop before creating a
    // useless empty trip (prevents infinite loops, idea.md requirement). ---
    if (plan.placements.length === 0) {
      for (const it of remaining) {
        unplaceable.push({
          cargoId: it.id,
          shopId: it.shopId,
          reason: 'no-valid-placement',
          permanent: true,
        })
      }
      remaining = []
      break
    }

    // --- Step 3: anti-split rule. A shop is *split* this trip when it had some
    // items placed and some not. Defer the whole shop to the next trip when it
    // barely fit (< 50% placed) and another shop still got cargo in — as long as
    // doing so leaves at least one shop's placements standing (never empty the
    // trip; that would stall progress). Kept splits are recorded per trip. ---
    const presentedByShop = tally(remaining.map((i) => i.shopId))
    const placedByShop = tally(plan.placements.map((p) => shopByCargo.get(p.cargoId)!))
    const unplacedByShop = tally(plan.unplaced.map((u) => u.shopId))

    const splitShopIds = [...presentedByShop.keys()].filter(
      (sid) => (placedByShop.get(sid) ?? 0) > 0 && (unplacedByShop.get(sid) ?? 0) > 0,
    )
    const placingShopIds = new Set(placedByShop.keys())

    const deferShopIds = new Set<string>()
    const orderedSplits = splitShopIds
      .map((sid) => shopById.get(sid)!)
      .sort((a, b) => a.deliveryOrder - b.deliveryOrder || (a.id < b.id ? -1 : 1))
    for (const shop of orderedSplits) {
      const fraction = (placedByShop.get(shop.id) ?? 0) / presentedByShop.get(shop.id)!
      const anotherShopPlaced = [...placingShopIds].some((sid) => sid !== shop.id)
      if (fraction < 0.5 && anotherShopPlaced) {
        const stillPlacing = [...placingShopIds].filter(
          (sid) => sid !== shop.id && !deferShopIds.has(sid),
        )
        if (stillPlacing.length > 0) deferShopIds.add(shop.id)
      }
    }

    // --- Steps 5-7: assemble this trip and gather next-trip input. ---
    // The anti-split rule defers whole shops, but a *kept* box may have been
    // stacked on a deferred shop's box during single-trip packing. Simply
    // dropping the supporter would leave the box floating (support ratio 0), so
    // cascade-defer every box that loses support once the deferred shops are gone
    // — repeated, because removing one box can un-support the box above it. The
    // anti-split defer is abandoned outright (plan.placements is internally
    // supported AND axle-legal by construction) when the cascade would empty
    // the trip, or when the removals push an axle past its plated max — item
    // axle contributions can be NEGATIVE (rear overhang), so removing boxes can
    // RAISE the other axle's load past a limit that held during packing.
    let effectiveDefer = deferShopIds
    const antiSplitKept = plan.placements.filter(
      (p) => !effectiveDefer.has(shopByCargo.get(p.cargoId)!),
    )
    let cascade = deferOrphanedStacks(antiSplitKept, itemById, config)
    if (cascade.kept.length === 0 || breachesAxleMaxima(cascade.kept, itemById, vehicle)) {
      effectiveDefer = new Set<string>()
      cascade = { kept: plan.placements, orphaned: [] }
    }
    const placements = stamp(cascade.kept, tripId)

    const deferredCargo: UnplacedCargo[] = []
    const nextItems: CargoItem[] = []
    // T06-unplaced items (deferrable) — except those swept up by a whole-shop defer.
    for (const u of plan.unplaced) {
      if (effectiveDefer.has(u.shopId)) continue
      deferredCargo.push({
        cargoId: u.cargoId,
        shopId: u.shopId,
        reason: u.reason,
        permanent: false,
        detail: u.detail,
      })
      nextItems.push(itemById.get(u.cargoId)!)
    }
    // Whole-shop anti-split deferrals: every item the shop presented this trip.
    for (const sid of effectiveDefer) {
      for (const it of remaining) {
        if (it.shopId !== sid) continue
        deferredCargo.push({
          cargoId: it.id,
          shopId: sid,
          reason: 'no-valid-placement',
          permanent: false,
          detail: 'Deferred to keep shop order together.',
        })
        nextItems.push(it)
      }
    }
    // Cascade-orphaned boxes: their supporter was deferred, so they follow it to
    // the next trip. (Distinct from the sets above — these were placed and kept.)
    for (const p of cascade.orphaned) {
      const it = itemById.get(p.cargoId)!
      deferredCargo.push({
        cargoId: it.id,
        shopId: it.shopId,
        reason: 'no-valid-placement',
        permanent: false,
        detail: 'Deferred: its supporting cargo moved to a later trip.',
      })
      nextItems.push(it)
    }

    const stops = buildStops(placements)
    trips.push({
      id: tripId,
      tripNumber,
      stops,
      placements,
      deferredCargo,
      metrics: buildTripMetrics({ placements, deferredCargo, stops }, scenario, presented, config),
    })

    placedSoFar += placements.length
    remaining = nextItems
  }

  // --- Step 5 (tail): items still unplaced after maxTrips → trip-limit-reached. ---
  for (const it of remaining) {
    unplaceable.push({
      cargoId: it.id,
      shopId: it.shopId,
      reason: 'trip-limit-reached',
      permanent: true,
    })
  }

  onProgress?.(100, 'Done')

  // T08: score the finished result and generate its warnings. `warnings` holds
  // only the runtime `time-limit` notice at this point; `buildWarnings` passes it
  // through and adds every metric-derived warning.
  const preliminary: OptimizationResult = {
    seed: scenario.config.seed,
    vehicleId: vehicle.id,
    trips,
    unplaceableCargo: unplaceable,
    warnings,
    overallScore: 0,
    elapsedMs: 0,
  }

  return {
    ...preliminary,
    warnings: buildWarnings(preliminary, scenario),
    overallScore: overallScore(
      trips.map((t) => t.metrics),
      unplaceable,
    ),
    elapsedMs: clock() - startedAt, // Documented nondeterminism (metadata only).
  }
}

// --------------------------------------------------------------------------
// Pre-filter (step 1)
// --------------------------------------------------------------------------

/**
 * Split items into those that could conceivably be placed and those that can
 * never fit *this* vehicle (dims in every orientation, door aperture, or single
 * item over payload). Exported so the planning screen can show a cheap
 * pre-warning without re-implementing the check (T17). Pure and side-effect free.
 */
export function prefilterPermanents(
  items: CargoItem[],
  vehicle: VehicleDefinition,
): { placeable: CargoItem[]; permanent: UnplacedCargo[] } {
  const space = vehicle.cargoSpace
  const placeable: CargoItem[] = []
  const permanent: UnplacedCargo[] = []

  for (const item of items) {
    const template = getTemplate(item.templateId)
    const size0 = itemDimensions(template, 0)
    const size90 = itemDimensions(template, 90)

    if (!fitsInSpace(size0, space) && !fitsInSpace(size90, space)) {
      permanent.push({
        cargoId: item.id,
        shopId: item.shopId,
        reason: 'exceeds-vehicle-dimensions',
        permanent: true,
        detail: 'Item exceeds the cargo space in every orientation.',
      })
      continue
    }

    const fitsAnyDoor = vehicle.doors.some(
      (d) => fitsThroughDoor(size0, d) || fitsThroughDoor(size90, d),
    )
    if (!fitsAnyDoor) {
      permanent.push({
        cargoId: item.id,
        shopId: item.shopId,
        reason: 'exceeds-vehicle-dimensions',
        permanent: true,
        detail: 'does not fit through any door',
      })
      continue
    }

    if (template.weightKg > vehicle.maxPayloadKg) {
      permanent.push({
        cargoId: item.id,
        shopId: item.shopId,
        reason: 'exceeds-payload',
        permanent: true,
        detail: `Item ${template.weightKg}kg exceeds vehicle payload ${vehicle.maxPayloadKg}kg.`,
      })
      continue
    }

    placeable.push(item)
  }

  return { placeable, permanent }
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function fitsInSpace(size: Dimensions, space: Dimensions): boolean {
  return size.width <= space.width && size.height <= space.height && size.depth <= space.depth
}

/** The stop-level door for a shop: its preferred door if the vehicle has it, else rear. */
function shopDoor(shop: Shop, vehicle: VehicleDefinition): DoorSide {
  return vehicle.doors.some((d) => d.side === shop.preferredDoor) ? shop.preferredDoor : 'rear'
}

type UntrippedPlacement = Omit<CargoPlacement, 'tripId'>

/**
 * Whether a kept-placement set exceeds an axle/kingpin plated maximum (planning
 * estimate; false when the vehicle has no axle data). Used to decide when the
 * anti-split defer must be abandoned: removing boxes can raise an axle load.
 */
function breachesAxleMaxima(
  placements: UntrippedPlacement[],
  itemById: Map<string, CargoItem>,
  vehicle: VehicleDefinition,
): boolean {
  if (!vehicle.axles) return false
  const boxes: PlacedBox[] = placements.map((p) => {
    const template = getTemplate(itemById.get(p.cargoId)!.templateId)
    return {
      cargoId: p.cargoId,
      templateId: template.id,
      min: p.position,
      size: itemDimensions(template, p.rotationY),
      weightKg: template.weightKg,
    }
  })
  return overloadBreaches(supportLoads(boxes, vehicle.axles), vehicle.axles).length > 0
}

/**
 * Iteratively remove placements whose base support has dropped below the
 * threshold against the surviving set — used after the anti-split rule strips a
 * deferred shop's boxes out of a trip, which can leave boxes stacked on them
 * floating. Repeats until a fixed point because removing one box can un-support
 * the box resting on it. Floor boxes (y=0) always keep full support, so this can
 * only ever shed stacked cargo. Returns the survivors plus the shed placements.
 */
function deferOrphanedStacks(
  placements: UntrippedPlacement[],
  itemById: Map<string, CargoItem>,
  config: OptimizerConfig,
): { kept: UntrippedPlacement[]; orphaned: UntrippedPlacement[] } {
  let kept = placements
  const orphaned: UntrippedPlacement[] = []
  for (;;) {
    const boxes: PlacedBox[] = kept.map((p) => {
      const template = getTemplate(itemById.get(p.cargoId)!.templateId)
      return {
        cargoId: p.cargoId,
        templateId: template.id,
        min: p.position,
        size: itemDimensions(template, p.rotationY),
        weightKg: template.weightKg,
      }
    })
    const badIds = new Set(
      boxes
        .filter(
          (b) => b.min.y > 0 && computeSupport(b, boxes).ratio < config.supportThreshold,
        )
        .map((b) => b.cargoId),
    )
    if (badIds.size === 0) break
    for (const p of kept) if (badIds.has(p.cargoId)) orphaned.push(p)
    kept = kept.filter((p) => !badIds.has(p.cargoId))
  }
  return { kept, orphaned }
}

/** Stamp tripId + gapless per-trip loadingOrder (1..k) onto kept placements. */
function stamp(
  placements: Array<Omit<CargoPlacement, 'tripId'>>,
  tripId: string,
): CargoPlacement[] {
  return placements.map((p, i) => ({ ...p, tripId, loadingOrder: i + 1 }))
}

function tally(ids: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1)
  return m
}

/** Monotone-ish 0–99 progress percent; the final 100 is emitted at the end. */
function pct(done: number, total: number): number {
  if (total <= 0) return 0
  const v = Math.round((done / total) * 100)
  return v < 0 ? 0 : v > 99 ? 99 : v
}
