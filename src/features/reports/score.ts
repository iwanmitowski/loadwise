// Overall quality score (T08). `computeTripScore` produces the per-trip 0–100
// figure stored in each trip's metrics; `overallScore` averages those across the
// result and applies the permanent-unplaceable penalty. Weighted with
// `SCORE_WEIGHTS` from the optimizer config (idea.md §Placement Scoring). Pure —
// no React / Three imports.

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
  frontRearBalance: number
  blockedCargoCount: number
  splitShopCount: number
  stopCount: number
}

/**
 * Per-trip score in 0–100. Weighted sum (weights sum to 100):
 *   volume 25 · weight 15 · balance 20 (mean of LR/FR) · accessibility 25 ·
 *   delivery 15 (1 − splitShops/stops, floored at 0).
 * An empty trip scores 0 outright — its balances read 1 by convention but a trip
 * that carries nothing has no quality to reward.
 */
export function computeTripScore(input: TripScoreInput): number {
  if (input.loadedUnits === 0) return 0

  const volume = clamp01(input.volumeUtilization)
  const weight = clamp01(input.weightUtilization)
  const balance = clamp01((input.leftRightBalance + input.frontRearBalance) / 2)
  const accessibility = clamp01(1 - input.blockedCargoCount / input.loadedUnits)
  const delivery =
    input.stopCount === 0 ? 1 : Math.max(0, 1 - input.splitShopCount / input.stopCount)

  const raw =
    SCORE_WEIGHTS.volume * volume +
    SCORE_WEIGHTS.weight * weight +
    SCORE_WEIGHTS.balance * balance +
    SCORE_WEIGHTS.accessibility * accessibility +
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
