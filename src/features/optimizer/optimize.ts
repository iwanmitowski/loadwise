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
// Metrics/warnings are T08's job. Until T08 lands this emits placeholder metrics
// (the counts we already know, zeros elsewhere) behind T08's `OptimizationMetrics`
// interface; `time-limit` is the one warning T07 owns (idea.md warnings table).

import { getTemplate, itemDimensions } from '@/features/cargo/templates'
import type {
  CargoItem,
  CargoPlacement,
  DeliveryStop,
  DeliveryTrip,
  DoorSide,
  Dimensions,
  OptimizationMetrics,
  OptimizationResult,
  OptimizationWarning,
  OptimizerConfig,
  Scenario,
  Shop,
  UnplacedCargo,
  VehicleDefinition,
} from '@/types'
import { type Clock, performanceClock } from '@/utils/clock'
import { fitsThroughDoor } from './geometry'
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
        trips.push({
          id: tripId,
          tripNumber,
          stops: buildStops(placements),
          placements,
          deferredCargo: [],
          metrics: placeholderMetrics(presented, placements.length, 0, []),
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
    const keptSplitShopIds = splitShopIds.filter((sid) => !deferShopIds.has(sid))

    // --- Steps 5-7: assemble this trip and gather next-trip input. ---
    const keptPlacements = plan.placements.filter(
      (p) => !deferShopIds.has(shopByCargo.get(p.cargoId)!),
    )
    const placements = stamp(keptPlacements, tripId)

    const deferredCargo: UnplacedCargo[] = []
    const nextItems: CargoItem[] = []
    // T06-unplaced items (deferrable) — except those swept up by a whole-shop defer.
    for (const u of plan.unplaced) {
      if (deferShopIds.has(u.shopId)) continue
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
    for (const sid of deferShopIds) {
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

    trips.push({
      id: tripId,
      tripNumber,
      stops: buildStops(placements),
      placements,
      deferredCargo,
      metrics: placeholderMetrics(presented, placements.length, deferredCargo.length, keptSplitShopIds),
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

  return {
    seed: scenario.config.seed,
    vehicleId: vehicle.id,
    trips,
    unplaceableCargo: unplaceable,
    warnings,
    overallScore: 0, // T08 computes this.
    elapsedMs: clock() - startedAt, // Documented nondeterminism (metadata only).
  }
}

// --------------------------------------------------------------------------
// Pre-filter (step 1)
// --------------------------------------------------------------------------

function prefilterPermanents(
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

/**
 * Placeholder metrics until T08's `buildTripMetrics` lands. Fills only the counts
 * T07 already knows (requested / loaded / deferred / splitShopIds) and zeroes the
 * rest, matching T08's `OptimizationMetrics` shape so the swap is drop-in.
 */
function placeholderMetrics(
  requestedUnits: number,
  loadedUnits: number,
  deferredUnits: number,
  splitShopIds: string[],
): OptimizationMetrics {
  return {
    requestedUnits,
    loadedUnits,
    deferredUnits,
    totalWeightKg: 0,
    weightUtilization: 0,
    usedVolumeCm3: 0,
    volumeUtilization: 0,
    emptyVolumeCm3: 0,
    leftRightBalance: 0,
    frontRearBalance: 0,
    blockedCargoCount: 0,
    extraUnloadingMoves: 0,
    splitShopIds,
    constraintViolations: 0,
    overallScore: 0,
  }
}
