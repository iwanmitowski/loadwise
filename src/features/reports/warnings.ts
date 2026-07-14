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
import { tripWeightSplit } from './metrics'

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
  // rear door/overhang, i.e. behind the rear axle) warns earlier than a
  // cabin-biased one, because it unloads the steering axle — worst on a lightly
  // loaded vehicle (Directive 2014/47/EU Annex III axle-load intent; no axle
  // geometry in the MVP, so mass-half share is the proxy).
  const split = tripWeightSplit(trip, scenario)
  const rearHeavy = split.rear > split.front
  const zThreshold = rearHeavy ? 0.9 : 0.75
  const lrTripped = m.leftRightBalance < 0.85
  const zTripped = m.frontRearBalance < zThreshold
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

  return out
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
