// Overall quality score (T08, recalibrated in T22). `computeTripScore` produces
// the per-trip 0–100 figure stored in each trip's metrics; `overallScore`
// averages those across the result and applies the permanent-unplaceable
// penalty. Weighted with `SCORE_WEIGHTS` from the optimizer config.
//
// The score grades what the PLANNER controls, per docs/deep-research-cargo-
// loading.md ("the densest plan is not the best plan"; rank accessibility and
// compliance above raw utilisation):
//   accessibility 25 · stability 25 · lateral balance 15 · utilisation 20 ·
//   delivery cohesion 15.
// Two deliberate departures from the pre-T22 model, which scored ~50 on good
// plans: (1) longitudinal "balance" is now axle/CoG COMPLIANCE, not a 50/50
// front–rear split — the front-pack + axle work loads mass forward on purpose,
// which the old metric punished; (2) utilisation is `max(volume, weight)` —
// a truck at its weight limit is full even at 40% volume, so it is not double-
// penalised for low volume. Pure — no React / Three imports.

import { SCORE_WEIGHTS } from '@/features/optimizer/config'
import type { OptimizationMetrics, UnplacedCargo } from '@/types'

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function clampScore(v: number): number {
  return v < 0 ? 0 : v > 100 ? 100 : v
}

export type TripScoreInput = {
  loadedUnits: number
  volumeUtilization: number
  weightUtilization: number
  leftRightBalance: number
  /** Longitudinal stability 0..1: axle compliance, or a forward-CoG proxy when
   *  the vehicle has no axle data (see metrics.ts). NOT a 50/50 split. */
  longitudinalStability: number
  blockedCargoCount: number
  splitShopCount: number
  stopCount: number
}

/**
 * Per-trip score in 0–100. Weighted sum (weights sum to 100). An empty trip
 * scores 0 outright — it has no load quality to reward.
 */
export function computeTripScore(input: TripScoreInput): number {
  if (input.loadedUnits === 0) return 0

  const accessibility = clamp01(1 - input.blockedCargoCount / input.loadedUnits)
  const stability = clamp01(input.longitudinalStability)
  const lateral = clamp01(input.leftRightBalance)
  // A truck full on EITHER binding dimension (weight or volume) is full.
  const utilization = clamp01(Math.max(input.volumeUtilization, input.weightUtilization))
  const delivery =
    input.stopCount === 0 ? 1 : Math.max(0, 1 - input.splitShopCount / input.stopCount)

  const raw =
    SCORE_WEIGHTS.accessibility * accessibility +
    SCORE_WEIGHTS.stability * stability +
    SCORE_WEIGHTS.lateralBalance * lateral +
    SCORE_WEIGHTS.utilization * utilization +
    SCORE_WEIGHTS.delivery * delivery

  return clampScore(Math.round(raw))
}

/**
 * Result-level score: the mean of the per-trip scores, minus 5 per permanently
 * unplaceable item, clamped to 0–100 and rounded. No trips (everything was
 * unplaceable) ⇒ 0.
 */
export function overallScore(
  metrics: OptimizationMetrics[],
  unplaceable: UnplacedCargo[],
): number {
  if (metrics.length === 0) return 0
  const mean = metrics.reduce((sum, m) => sum + m.overallScore, 0) / metrics.length
  const permanent = unplaceable.filter((u) => u.permanent).length
  return clampScore(Math.round(mean - 5 * permanent))
}
