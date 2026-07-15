// Warning generation (T08). Turns a fully-metricked `OptimizationResult` into the
// plain-language warnings the report shows. Every warning explains a number the
// user can see (idea.md §Optimization Report). Deterministic and pure — no React
// / Three imports. The exact trigger list lives in the T08 prompt's table.

import type {
  DeliveryTrip,
  OptimizationResult,
  OptimizationWarning,
  Scenario,
  Shop,
  UnplacedCargo,
  UnplacedReason,
} from '@/types'
import {
  overloadBreaches,
  supportLoads,
  underloadBreach,
} from '@/features/optimizer/axles'
import { unbracedCargo } from '@/features/optimizer/bracing'
import { toPlacedBox, type PlacedBox } from '@/features/optimizer/geometry'
import { cargoShopMap, cargoTemplateMap, tripWeightSplit, weightSplit } from './metrics'

/** Build every warning for a finished result, in a deterministic order. */
export function buildWarnings(
  result: OptimizationResult,
  scenario: Scenario,
): OptimizationWarning[] {
  const shopById = new Map(scenario.shops.map((s) => [s.id, s]))
  const warnings: OptimizationWarning[] = []

  // --- Per-trip warnings, in trip order. ---
  for (const trip of result.trips) {
    warnings.push(...tripWarnings(trip, scenario, shopById))
  }

  // --- Result-level: permanently unplaceable cargo. ---
  const permanent = result.unplaceableCargo.filter((u) => u.permanent)
  if (permanent.length > 0) {
    warnings.push({
      code: 'unplaceable-cargo',
      message: `${permanent.length} item(s) cannot be loaded: ${reasonSummary(permanent)}.`,
    })
  }

  // --- Pass-through: the time-limit warning T07 raises at runtime (metrics can't
  // re-derive it). Preserve any the optimizer already attached. ---
  for (const w of result.warnings) {
    if (w.code === 'time-limit') warnings.push(w)
  }

  return warnings
}

function tripWarnings(
  trip: DeliveryTrip,
  scenario: Scenario,
  shopById: Map<string, Shop>,
): OptimizationWarning[] {
  const out: OptimizationWarning[] = []
  const m = trip.metrics
  const n = trip.tripNumber

  // Empty trip: nothing else about it is meaningful.
  if (trip.placements.length === 0) {
    out.push({ code: 'empty-trip', message: `Trip ${n} is empty.`, tripId: trip.id })
    return out
  }

  // Capacity: which limit was hit first.
  if (m.weightUtilization >= 0.9 && m.volumeUtilization < 0.7) {
    out.push({
      code: 'weight-limited',
      message: `Trip ${n} reached weight capacity before volume capacity.`,
      tripId: trip.id,
    })
  } else if (m.volumeUtilization >= 0.9 && m.weightUtilization < 0.7) {
    out.push({
      code: 'volume-limited',
      message: `Trip ${n} reached volume capacity before weight capacity.`,
      tripId: trip.id,
    })
  }

  // Imbalance: report the worse of the two axes, naming the heavier side.
  // Thresholds are asymmetric on the z axis: a REAR-heavy load (mass toward the
  // rear door/overhang, i.e. behind the rear axle) warns at 0.9, because it
  // unloads the steering axle — worst on a lightly loaded vehicle (Directive
  // 2014/47/EU Annex III axle-load intent; no axle geometry in the MVP, so
  // mass-half share is the proxy). Front bias is the front-pack rule's *intent*
  // (mass over/between the axles), so it only warns when extreme (< 0.5) on a
  // heavily loaded vehicle (util ≥ 0.7) — light front-packed trips stay silent.
  // Lateral threshold per docs/deep-research-cargo-loading.md: red at a 10%+
  // side difference (product warning threshold, not a legal rule).
  const split = tripWeightSplit(trip, scenario)
  const rearHeavy = split.rear > split.front
  const lrTripped = m.leftRightBalance < 0.9
  const zTripped = rearHeavy
    ? m.frontRearBalance < 0.9
    : m.frontRearBalance < 0.5 && m.weightUtilization >= 0.7
  if (lrTripped || zTripped) {
    out.push(imbalanceWarning(trip, scenario, lrTripped, zTripped))
  }

  // Split shop orders.
  for (const shopId of m.splitShopIds) {
    const name = shopById.get(shopId)?.name ?? shopId
    out.push({
      code: 'shop-split',
      message: `Order for ${name} was split between trips ${n} and ${n + 1}.`,
      tripId: trip.id,
    })
  }

  // Deferred cargo moved to the next trip.
  if (trip.deferredCargo.length > 0) {
    out.push({
      code: 'deferred-cargo',
      message: `${trip.deferredCargo.length} item(s) moved to trip ${n + 1}.`,
      tripId: trip.id,
    })
  }

  // Blocked cargo — items needing others moved to unload.
  if (m.blockedCargoCount > 0) {
    out.push({
      code: 'blocked-cargo',
      message: `${m.blockedCargoCount} item(s) require moving other cargo when unloading.`,
      tripId: trip.id,
    })
  }

  // Unsecured cargo — no forward blocking chain to the front wall. Under
  // braking (EN 12195-1's 0.8g forward case) these items rely on lashing,
  // which the MVP doesn't model — so surface them for the driver, with the
  // extra forward restraint they need: F = (0.8 − μ)·m·g at the guidelines'
  // generic dry-friction assumption μ ≈ 0.3, expressed in daN as printed on
  // strap labels. LIFO delivery bands make some of this unavoidable (each band
  // ends at a gap); the warning quantifies the lashing burden rather than
  // failing the trip.
  const boxes = resolveTripBoxes(trip, scenario)
  const unbraced = unbracedCargo(boxes, scenario.vehicle.cargoSpace)
  if (unbraced.length > 0) {
    const ids = new Set(unbraced)
    const massKg = boxes.reduce((sum, b) => sum + (ids.has(b.cargoId) ? b.weightKg : 0), 0)
    const daN = Math.ceil(((0.8 - 0.3) * massKg * 9.81) / 10)
    out.push({
      code: 'unsecured-cargo',
      message:
        `${unbraced.length} item(s) (${Math.round(massKg)}kg) have no forward blocking against braking — ` +
        `secure with lashings (≈${daN} daN extra forward restraint at μ≈0.3, planning estimate).`,
      tripId: trip.id,
    })
  }

  // Axle planning estimates (only when the vehicle carries axle geometry):
  // the departure state, then the state remaining after EVERY delivery stop —
  // a plan can be legal at the depot and become unsafe mid-route
  // (docs/physics.md). Overload at departure is normally impossible (the
  // optimizer hard-rejects it) but hand-authored data is re-checked anyway.
  if (scenario.vehicle.axles) {
    out.push(...axleStateWarnings(trip, scenario, boxes))
  }

  return out
}

/** Axle/balance breaches at departure and after each stop (planning estimates). */
function axleStateWarnings(
  trip: DeliveryTrip,
  scenario: Scenario,
  boxes: PlacedBox[],
): OptimizationWarning[] {
  const model = scenario.vehicle.axles!
  const n = trip.tripNumber
  const out: OptimizationWarning[] = []

  // Lateral is included only for post-stop states — at departure the regular
  // `imbalance` warning already covers it. It is also skipped while the
  // remaining load is under 25% of payload: imbalance forces scale with mass,
  // and a lone last-stop pallet off the centreline is operationally irrelevant
  // (product threshold, not a legal rule).
  const breachesOf = (state: PlacedBox[], includeLateral: boolean): string[] => {
    const loads = supportLoads(state, model)
    const breaches = [...overloadBreaches(loads, model)]
    const under = underloadBreach(loads, model)
    if (under) breaches.push(under)
    if (includeLateral) {
      const split = weightSplit(state, scenario.vehicle.cargoSpace)
      const lateral = split.total === 0 ? 1 : 1 - Math.abs(split.left - split.right) / split.total
      if (lateral < 0.9 && split.total >= scenario.vehicle.maxPayloadKg * 0.25) {
        breaches.push(`left/right imbalance ${Math.round((1 - lateral) * 100)}%`)
      }
    }
    return breaches
  }

  const atDeparture = breachesOf(boxes, false)
  if (atDeparture.length > 0) {
    out.push({
      code: 'axle-limit',
      message: `Trip ${n} at departure: ${atDeparture.join('; ')} (planning estimate).`,
      tripId: trip.id,
    })
  }

  // Walk the route: after each stop the stop's cargo leaves the vehicle.
  const shopByCargo = cargoShopMap(scenario)
  const stops = [...trip.stops].sort((a, b) => a.stopNumber - b.stopNumber)
  let remaining = boxes
  for (const stop of stops) {
    remaining = remaining.filter((b) => shopByCargo.get(b.cargoId) !== stop.shopId)
    if (remaining.length === 0) break
    const breaches = breachesOf(remaining, true)
    if (breaches.length > 0) {
      out.push({
        code: 'unsafe-after-stop',
        message: `Trip ${n} after stop ${stop.stopNumber}: ${breaches.join('; ')} (planning estimate).`,
        tripId: trip.id,
      })
    }
  }

  return out
}

/** Resolve a trip's placements to boxes (skips cargo the scenario never requested). */
function resolveTripBoxes(trip: DeliveryTrip, scenario: Scenario): PlacedBox[] {
  const templates = cargoTemplateMap(scenario)
  const boxes: PlacedBox[] = []
  for (const p of trip.placements) {
    const template = templates.get(p.cargoId)
    if (template) boxes.push(toPlacedBox(p, template))
  }
  return boxes
}

/**
 * The imbalance message for a trip: the tripped axis (worse balance value when
 * both tripped), heavier side, and the gap %.
 */
function imbalanceWarning(
  trip: DeliveryTrip,
  scenario: Scenario,
  lrTripped: boolean,
  zTripped: boolean,
): OptimizationWarning {
  const m = trip.metrics
  const split = tripWeightSplit(trip, scenario)
  const useLR =
    lrTripped && zTripped ? m.leftRightBalance <= m.frontRearBalance : lrTripped

  let message: string
  if (useLR) {
    const pct = Math.round((1 - m.leftRightBalance) * 100)
    const [heavier, lighter] = split.left >= split.right ? ['left', 'right'] : ['right', 'left']
    message = `The ${heavier} side is ${pct}% heavier than the ${lighter}.`
  } else {
    const pct = Math.round((1 - m.frontRearBalance) * 100)
    const [heavier, lighter] = split.rear >= split.front ? ['rear', 'front'] : ['front', 'rear']
    message = `The ${heavier} of the load is ${pct}% heavier than the ${lighter}.`
    // The dangerous combination: rear-heavy AND lightly loaded — the mass sits
    // on the rear overhang with little elsewhere to counter it.
    if (heavier === 'rear' && m.weightUtilization < 0.5) {
      message += ' Rear-heavy at light load can unload the steering axle.'
    }
  }

  return { code: 'imbalance', message, tripId: trip.id }
}

/** Human phrase per unplaced reason. */
const REASON_PHRASE: Record<UnplacedReason, string> = {
  'exceeds-vehicle-dimensions': 'too large for the vehicle',
  'exceeds-payload': 'too heavy for the vehicle',
  'no-valid-placement': 'no valid placement',
  'stacking-constraint': 'stacking constraints',
  'accessibility-constraint': 'accessibility constraints',
  'trip-limit-reached': 'trip limit reached',
}

/** "1 too large for the vehicle, 2 too heavy…" — grouped by reason, in enum order. */
function reasonSummary(items: UnplacedCargo[]): string {
  const counts = new Map<UnplacedReason, number>()
  for (const item of items) counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1)
  const order = Object.keys(REASON_PHRASE) as UnplacedReason[]
  return order
    .filter((reason) => counts.has(reason))
    .map((reason) => `${counts.get(reason)} ${REASON_PHRASE[reason]}`)
    .join(', ')
}
