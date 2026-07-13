// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'
import { useScenarioStore } from '@/state/scenarioStore'
import { useOptimizationStore } from '@/state/optimizationStore'
import { useUiStore } from '@/state/uiStore'

// Reset the singleton stores so the shell starts from its initial state.
beforeEach(() => {
  useOptimizationStore.getState().reset()
  useScenarioStore.setState({ scenario: null })
  useUiStore.getState().resetForNewScenario()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

const stepButton = (label: string) =>
  within(screen.getByRole('navigation')).getByRole('button', { name: label })

describe('App shell — happy path', () => {
  it('gates the stepper and clicks through generate → optimize → result', () => {
    render(<App />)

    // Setup screen shown; downstream steps disabled until prerequisites exist.
    expect(screen.getByText('Set up scenario')).toBeInTheDocument()
    expect(stepButton('Planning')).toBeDisabled()
    expect(stepButton('Simulation')).toBeDisabled()

    // Generate a scenario → Planning unlocks.
    fireEvent.click(screen.getByRole('button', { name: 'Generate scenario' }))
    expect(stepButton('Planning')).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: /Continue to planning/ }))
    expect(screen.getByText('Plan the load')).toBeInTheDocument()

    // Optimize → fake worker resolves → result present, Simulation/Report unlock.
    fireEvent.click(screen.getByRole('button', { name: 'Optimize' }))
    act(() => vi.runAllTimers())

    expect(useOptimizationStore.getState().result).not.toBeNull()
    expect(stepButton('Simulation')).toBeEnabled()
    expect(stepButton('Report')).toBeEnabled()

    // Navigate onward.
    fireEvent.click(screen.getByRole('button', { name: /View simulation/ }))
    expect(screen.getByText('Delivery simulation')).toBeInTheDocument()
  })
})
