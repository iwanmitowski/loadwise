// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { ScreenPlanning } from './ScreenPlanning'
import { demoScenario } from '@/fixtures/demo'
import { useOptimizationStore } from '@/state/optimizationStore'
import { useScenarioStore } from '@/state/scenarioStore'
import { useUiStore } from '@/state/uiStore'
import type { Scenario, Shop } from '@/types'

// Demo scenario plus a zero-cargo shop — the card must render, not hide.
const zeroCargoShop: Shop = {
  id: 'shop-4',
  name: 'Empty Corner',
  type: 'general-store',
  deliveryOrder: 4,
  preferredDoor: 'rear',
  requestedCargo: [],
}
const fixtureScenario: Scenario = {
  ...demoScenario,
  shops: [...demoScenario.shops, zeroCargoShop],
}

beforeEach(() => {
  useOptimizationStore.getState().reset()
  useScenarioStore.setState({ scenario: fixtureScenario })
  useUiStore.getState().resetForNewScenario()
  useUiStore.getState().goTo('planning')
})

describe('ScreenPlanning', () => {
  it('renders shop cards in delivery order, including the zero-cargo shop', () => {
    render(<ScreenPlanning />)

    const cards = within(
      screen.getByRole('list', { name: 'Shops in delivery order' }),
    ).getAllByRole('listitem')
    expect(cards).toHaveLength(4)

    // demoScenario delivery order: Volt Hub (1), Hop Cellar (2), Metro Market (3).
    expect(cards[0]).toHaveTextContent('Volt Hub')
    expect(cards[0]).toHaveTextContent('Stop 1')
    expect(cards[1]).toHaveTextContent('Hop Cellar')
    expect(cards[2]).toHaveTextContent('Metro Market')

    // Requested cargo rolled up as template × count chips with totals.
    expect(cards[2]).toHaveTextContent('Standard pallet × 2')
    expect(cards[2]).toHaveTextContent('700 kg')

    // Zero-cargo shop stays visible with an explicit empty line.
    expect(cards[3]).toHaveTextContent('Empty Corner')
    expect(cards[3]).toHaveTextContent('No cargo requested')
  })

  it('shows scenario totals and the seed badge', () => {
    render(<ScreenPlanning />)
    expect(screen.getByText('demo')).toBeInTheDocument() // seed badge
    expect(screen.getByText('Shops')).toBeInTheDocument()
    expect(screen.getByText('Box truck', { exact: false })).toBeInTheDocument()
  })

  it('disables optimize when there is no scenario', () => {
    useScenarioStore.setState({ scenario: null })
    render(<ScreenPlanning />)
    expect(screen.getByRole('button', { name: 'Optimize' })).toBeDisabled()
  })

  describe('optimize flow (fake timers)', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('shows progress + cancel while running, then advances to simulation', () => {
      render(<ScreenPlanning />)

      fireEvent.click(screen.getByRole('button', { name: 'Optimize' }))
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Optimize' })).toBeDisabled()

      act(() => vi.runAllTimers())

      expect(useOptimizationStore.getState().status).toBe('done')
      expect(useUiStore.getState().screen).toBe('simulation')
    })

    it('cancel stops the run and stays on planning', () => {
      render(<ScreenPlanning />)

      fireEvent.click(screen.getByRole('button', { name: 'Optimize' }))
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      act(() => vi.runAllTimers())

      expect(useOptimizationStore.getState().status).toBe('cancelled')
      expect(useUiStore.getState().screen).toBe('planning')
      expect(screen.getByRole('button', { name: 'Optimize' })).toBeEnabled()
    })
  })

  it('shows an inline alert with retry on error', () => {
    useOptimizationStore.setState({ status: 'error', error: 'worker exploded' })
    render(<ScreenPlanning />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('worker exploded')
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('regenerate keeps the config but picks a new seed and stays on planning', () => {
    useScenarioStore.setState({
      config: { seed: 'before', vehicleId: 'box-truck', sideDoor: 'none', shopCount: 5 },
    })
    render(<ScreenPlanning />)

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))

    const { config, scenario } = useScenarioStore.getState()
    expect(config.seed).not.toBe('before')
    expect(config.vehicleId).toBe('box-truck')
    expect(config.shopCount).toBe(5)
    expect(scenario!.config.seed).toBe(config.seed)
    expect(useUiStore.getState().screen).toBe('planning')
  })

  it('back returns to setup', () => {
    render(<ScreenPlanning />)
    fireEvent.click(screen.getByRole('button', { name: '← Back' }))
    expect(useUiStore.getState().screen).toBe('setup')
  })
})
