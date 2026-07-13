import { describe, expect, it } from 'vitest'
import type { OptimizationMetrics, UnplacedCargo } from '@/types'
import { computeTripScore, overallScore } from './score'

const withScore = (overallScoreValue: number): OptimizationMetrics => ({
  requestedUnits: 0,
  loadedUnits: 1,
  deferredUnits: 0,
  totalWeightKg: 0,
  weightUtilization: 0,
  usedVolumeCm3: 0,
  volumeUtilization: 0,
  emptyVolumeCm3: 0,
  leftRightBalance: 1,
  frontRearBalance: 1,
  blockedCargoCount: 0,
  extraUnloadingMoves: 0,
  splitShopIds: [],
  constraintViolations: 0,
  overallScore: overallScoreValue,
})

const permanent: UnplacedCargo = {
  cargoId: 'x',
  shopId: 'shop-1',
  reason: 'exceeds-vehicle-dimensions',
  permanent: true,
}

describe('computeTripScore', () => {
  it('returns 0 for an empty trip regardless of balances', () => {
    expect(
      computeTripScore({
        loadedUnits: 0,
        volumeUtilization: 0,
        weightUtilization: 0,
        leftRightBalance: 1,
        frontRearBalance: 1,
        blockedCargoCount: 0,
        splitShopCount: 0,
        stopCount: 0,
      }),
    ).toBe(0)
  })

  it('gives a perfect 100 when every component is maxed', () => {
    expect(
      computeTripScore({
        loadedUnits: 4,
        volumeUtilization: 1,
        weightUtilization: 1,
        leftRightBalance: 1,
        frontRearBalance: 1,
        blockedCargoCount: 0,
        splitShopCount: 0,
        stopCount: 2,
      }),
    ).toBe(100)
  })

  it('weights each component per SCORE_WEIGHTS', () => {
    // volume .5 → 12.5, weight 0, balance (0.9+0.7)/2=0.8 → 16, accessibility
    // 1−1/4=0.75 → 18.75, delivery 1−1/2=0.5 → 7.5. Sum = 54.75 → 55.
    expect(
      computeTripScore({
        loadedUnits: 4,
        volumeUtilization: 0.5,
        weightUtilization: 0,
        leftRightBalance: 0.9,
        frontRearBalance: 0.7,
        blockedCargoCount: 1,
        splitShopCount: 1,
        stopCount: 2,
      }),
    ).toBe(55)
  })
})

describe('overallScore', () => {
  it('returns 0 when there are no trips', () => {
    expect(overallScore([], [permanent])).toBe(0)
  })

  it('averages the per-trip scores', () => {
    expect(overallScore([withScore(40), withScore(60)], [])).toBe(50)
  })

  it('subtracts 5 per permanently unplaceable item', () => {
    expect(overallScore([withScore(80)], [permanent, permanent])).toBe(70)
  })

  it('floors the penalized score at 0', () => {
    expect(overallScore([withScore(10)], [permanent, permanent, permanent])).toBe(0)
  })
})
