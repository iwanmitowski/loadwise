import type { OptimizerConfig } from '@/types'

// Tunable numbers only — no logic lives in this file.

export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = {
  // weightBalance ↑ / doorAccessibility ↓ (was 10/20): the balance term now
  // covers longitudinal (front/rear) vehicle stability too, and the door term
  // was dragging whole loads onto the rear overhang. Together with the
  // front-pack delivery-order rule (see placeTrip.ts), measured over 240
  // generated scenarios: rear-heavy trips 54%→3%, blocked cargo −85%,
  // unloading moves −81%, trips +1% (see the T13 worklog stability addenda).
  weights: {
    compactness: 20,
    floorPreference: 15,
    weightBalance: 25,
    doorAccessibility: 12,
    deliveryOrderCompatibility: 25,
    supportQuality: 10,
  },
  maxTrips: 10,
  supportThreshold: 0.7,
  candidatePointCap: 600,
  safetyTimeLimitMs: 8000,
}

/**
 * Weights for the report's overall quality score (sum to 100). Recalibrated in
 * T22 to grade what the planner controls (docs/deep-research-cargo-loading.md):
 * accessibility + stability compliance lead; utilisation is `max(vol,weight)`
 * and secondary; longitudinal quality is axle/CoG compliance, not a 50/50 split.
 */
export const SCORE_WEIGHTS = {
  accessibility: 25,
  stability: 25,
  lateralBalance: 15,
  utilization: 20,
  delivery: 15,
} as const
