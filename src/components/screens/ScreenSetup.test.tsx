// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ScreenSetup } from './ScreenSetup'
import { useOptimizationStore } from '@/state/optimizationStore'
import { useScenarioStore } from '@/state/scenarioStore'
import { useUiStore } from '@/state/uiStore'

beforeEach(() => {
  useOptimizationStore.getState().reset()
  useScenarioStore.setState({
    config: { seed: 'test-seed', vehicleId: 'box-truck', sideDoor: 'none', shopCount: 5 },
    scenario: null,
  })
  useUiStore.getState().resetForNewScenario()
})

const vehicleGroup = () => screen.getByRole('radiogroup', { name: 'Vehicle' })

describe('ScreenSetup', () => {
  it('renders all three vehicles with dims and payload, current one selected', () => {
    render(<ScreenSetup />)

    const cards = within(vehicleGroup()).getAllByRole('radio')
    expect(cards).toHaveLength(3)
    expect(screen.getByText('Cargo van')).toBeInTheDocument()
    expect(screen.getByText('Box truck')).toBeInTheDocument()
    expect(screen.getByText('Semi-trailer')).toBeInTheDocument()

    // cm → m conversion with 1 decimal on the card (box truck 240×230×620).
    expect(screen.getByText(/2\.4 × 2\.3 × 6\.2 m/)).toBeInTheDocument()
    expect(screen.getByText(/payload 5,000 kg/)).toBeInTheDocument()

    expect(
      within(vehicleGroup()).getByRole('radio', { name: /Box truck/ }),
    ).toBeChecked()
  })

  it('selecting a vehicle and side door updates the config', () => {
    render(<ScreenSetup />)

    fireEvent.click(within(vehicleGroup()).getByRole('radio', { name: /Semi-trailer/ }))
    const doorGroup = screen.getByRole('radiogroup', { name: 'Side door' })
    fireEvent.click(within(doorGroup).getByRole('radio', { name: 'Left' }))

    const { config } = useScenarioStore.getState()
    expect(config.vehicleId).toBe('semi-trailer')
    expect(config.sideDoor).toBe('left')
  })

  it('shows the seed at all times and randomize changes it', () => {
    render(<ScreenSetup />)

    expect(screen.getByRole('textbox', { name: 'Seed' })).toHaveValue('test-seed')
    fireEvent.click(screen.getByRole('button', { name: 'Randomize' }))
    const seed = useScenarioStore.getState().config.seed
    expect(seed).not.toBe('test-seed')
    expect(screen.getByRole('textbox', { name: 'Seed' })).toHaveValue(seed)
  })

  it('generate builds the scenario and navigates to planning', () => {
    render(<ScreenSetup />)

    fireEvent.click(screen.getByRole('button', { name: 'Generate scenario' }))

    expect(useScenarioStore.getState().scenario).not.toBeNull()
    expect(useUiStore.getState().screen).toBe('planning')
  })

  it('Load demo generates the demo scenario and navigates to planning', () => {
    render(<ScreenSetup />)

    fireEvent.click(screen.getByRole('button', { name: 'Load demo' }))

    const { config, scenario } = useScenarioStore.getState()
    expect(config.seed).toBe('demo-1')
    expect(config.sideDoor).toBe('left')
    expect(config.shopCount).toBe(6)
    expect(scenario).not.toBeNull()
    expect(useUiStore.getState().screen).toBe('planning')
  })
})
