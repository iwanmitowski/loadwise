import type { OptimizerConfig } from '@/types'

// Tunable numbers only — no logic lives in this file.

export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = {
  weights: {
    compactness: 20,
    floorPreference: 15,
    weightBalance: 10,
    doorAccessibility: 20,
    deliveryOrderCompatibility: 25,
    supportQuality: 10,
  },
  maxTrips: 10,
  supportThreshold: 0.7,
  candidatePointCap: 600,
  safetyTimeLimitMs: 8000,
}

/** Weights for the report's overall quality score (see idea.md §Placement Scoring). */
export const SCORE_WEIGHTS = {
  volume: 25,
  weight: 15,
  balance: 20,
  accessibility: 25,
  delivery: 15,
} as const
