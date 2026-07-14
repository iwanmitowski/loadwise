// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ShopLegend } from './ShopLegend'
import { demoResult, demoScenario } from '@/fixtures/demo'
import { useUiStore } from '@/state/uiStore'

const trip = demoResult.trips[0]

beforeEach(() => useUiStore.getState().resetForNewScenario())
afterEach(cleanup)

describe('ShopLegend', () => {
  it('lists a row per stop in delivery (stop) order with its number', () => {
    render(<ShopLegend trip={trip} scenario={demoScenario} />)
    const rows = screen.getAllByRole('button')
    // Stops: Volt Hub (1), Hop Cellar (2), Metro Market (3).
    expect(rows[0]).toHaveTextContent('#1')
    expect(rows[0]).toHaveTextContent('Volt Hub')
    expect(rows[2]).toHaveTextContent('Metro Market')
  })

  it('flags shops with deferred cargo with a ⚠ badge', () => {
    render(<ShopLegend trip={trip} scenario={demoScenario} />)
    // shop-2 (Hop Cellar) has a deferred item in the demo trip.
    const hopCellar = screen.getByRole('button', { name: /Hop Cellar/ })
    expect(hopCellar).toHaveTextContent('⚠')
    // Volt Hub has none.
    expect(screen.getByRole('button', { name: /Volt Hub/ })).not.toHaveTextContent('⚠')
  })

  it('flags shops named in alsoWarnShopIds (unplaceable cargo)', () => {
    render(
      <ShopLegend trip={trip} scenario={demoScenario} alsoWarnShopIds={['shop-1']} />,
    )
    expect(screen.getByRole('button', { name: /Metro Market/ })).toHaveTextContent('⚠')
  })

  it('toggles the shop filter on and off, exposing a clear affordance', () => {
    render(<ShopLegend trip={trip} scenario={demoScenario} />)
    const voltHub = screen.getByRole('button', { name: /Volt Hub/ })

    fireEvent.click(voltHub)
    expect(useUiStore.getState().shopFilter).toBe('shop-3')
    expect(screen.getByRole('button', { name: 'clear filter' })).toBeInTheDocument()

    // Clicking the active shop again clears the filter.
    fireEvent.click(voltHub)
    expect(useUiStore.getState().shopFilter).toBeNull()
  })

  it('clear filter button resets the filter', () => {
    useUiStore.getState().setShopFilter('shop-2')
    render(<ShopLegend trip={trip} scenario={demoScenario} />)
    fireEvent.click(screen.getByRole('button', { name: 'clear filter' }))
    expect(useUiStore.getState().shopFilter).toBeNull()
  })
})
