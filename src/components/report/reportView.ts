// UI-layer helpers for the Report screen. These do lookups and label mapping —
// NOT metric math (that all comes from T08's `buildReportModel`). Kept separate
// from the components so they stay unit-testable.

import type {
  OptimizationResult,
  Scenario,
  UnplacedReason,
  WarningCode,
} from '@/types'
import { getTemplate } from '@/features/cargo/templates'

/** Map every requested cargo id → its template's display name. */
export function buildTemplateNames(scenario: Scenario): Map<string, string> {
  const names = new Map<string, string>()
  for (const shop of scenario.shops) {
    for (const item of shop.requestedCargo) {
      names.set(item.id, getTemplate(item.templateId).name)
    }
  }
  return names
}

/**
 * Map cargo id → the `tripNumber` it was ultimately placed in. Deferred items
 * that never land anywhere are simply absent — callers render "not placed".
 */
export function buildPlacementTripNumbers(
  result: OptimizationResult,
): Map<string, number> {
  const byCargo = new Map<string, number>()
  for (const trip of result.trips) {
    for (const p of trip.placements) byCargo.set(p.cargoId, trip.tripNumber)
  }
  return byCargo
}

/** "→ Trip 2" for a deferred item that later got placed, else "not placed". */
export function destinationLabel(
  cargoId: string,
  tripByCargo: Map<string, number>,
): string {
  const n = tripByCargo.get(cargoId)
  return n === undefined ? 'not placed' : `→ Trip ${n}`
}

/** Plain-language chip text per unplaceable reason. */
export const REASON_LABEL: Record<UnplacedReason, string> = {
  'exceeds-vehicle-dimensions': 'Too large for vehicle',
  'exceeds-payload': 'Over payload',
  'no-valid-placement': 'No valid placement',
  'stacking-constraint': 'Stacking constraint',
  'accessibility-constraint': 'Accessibility constraint',
  'trip-limit-reached': 'Trip limit reached',
}

export type WarningSeverity = 'error' | 'warn'

// Hard failures render red; everything else is informational amber (per T16).
const ERROR_CODES: ReadonlySet<WarningCode> = new Set<WarningCode>([
  'unplaceable-cargo',
  'empty-trip',
  'time-limit',
])

export function warningSeverity(code: WarningCode): WarningSeverity {
  return ERROR_CODES.has(code) ? 'error' : 'warn'
}

/** Score → color band: red < 50 ≤ amber < 75 ≤ green. Clamped upstream to 0–100. */
export function scoreBand(score: number): 'low' | 'mid' | 'high' {
  if (score < 50) return 'low'
  if (score < 75) return 'mid'
  return 'high'
}
