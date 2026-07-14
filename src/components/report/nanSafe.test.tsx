// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MetricGrid } from './MetricGrid'
import type { TripReport } from '@/features/reports/reportModel'
import type { OptimizationMetrics } from '@/types'

// A degenerate zero-weight trip: the balance/utilization ratios divide by zero.
// T08 guards the math, but the UI must never render "NaN%" even if a non-finite
// value reaches it — every percent goes through fmtPctSafe → "—".
const nanMetrics: OptimizationMetrics = {
  requestedUnits: 0,
  loadedUnits: 0,
  deferredUnits: 0,
  totalWeightKg: 0,
  weightUtilization: NaN,
  usedVolumeCm3: 0,
  volumeUtilization: NaN,
  emptyVolumeCm3: 0,
  leftRightBalance: NaN,
  frontRearBalance: NaN,
  blockedCargoCount: 0,
  extraUnloadingMoves: 0,
  splitShopIds: [],
  constraintViolations: 0,
  overallScore: 0,
}

const trip: TripReport = {
  tripId: 'trip-1',
  tripNumber: 1,
  metrics: nanMetrics,
  stops: [],
  deferredCargo: [],
  warnings: [],
}

afterEach(cleanup)

describe('NaN-free rendering (zero-weight fixture)', () => {
  it('never renders "NaN" and dashes the non-finite percents', () => {
    render(<MetricGrid trip={trip} />)
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
    // Four percent bars (2 utilizations + 2 balances) all fall back to "—".
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
  })
})
