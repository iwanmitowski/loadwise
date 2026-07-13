// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TotalsBar } from './TotalsBar'
import type { ScenarioTotals } from './totals'

const totals = (weightRatio: number, volumeRatio: number): ScenarioTotals => ({
  shops: 3,
  units: 10,
  weightKg: 1800,
  volumeCm3: 4_608_000,
  weightRatio,
  volumeRatio,
})

describe('TotalsBar', () => {
  it('renders percentages within capacity without the overflow hint', () => {
    render(<TotalsBar totals={totals(0.5, 0.25)} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.queryByText(/exceeds capacity/)).not.toBeInTheDocument()
  })

  it('styles an over-capacity bar amber and shows the multi-trip hint', () => {
    render(<TotalsBar totals={totals(1.5, 0.4)} />)

    const pct = screen.getByText('150%')
    expect(pct).toHaveClass('text-amber-400')
    expect(screen.getByText(/exceeds capacity → multiple trips/)).toBeInTheDocument()

    // The within-capacity bar stays untinted.
    expect(screen.getByText('40%')).not.toHaveClass('text-amber-400')
  })
})
