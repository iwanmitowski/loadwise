// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'
import { createFakeOptimizerClient } from '@/test/fakeOptimizerClient'
import { useScenarioStore } from '@/state/scenarioStore'
import { setOptimizerClient, useOptimizationStore } from '@/state/optimizationStore'
import { useUiStore } from '@/state/uiStore'

// Reset the singleton stores so the shell starts from its initial state.
// jsdom has no Worker — swap the optimizer client for the timer-based fake.
beforeEach(() => {
  setOptimizerClient(createFakeOptimizerClient())
  useOptimizationStore.getState().reset()
  useScenarioStore.setState({ scenario: null })
  useUiStore.getState().resetForNewScenario()
  vi.useFakeTimers()
})
afterEach(() => {
  setOptimizerClient(null)
  vi.useRealTimers()
})

const stepButton = (label: string) =>
  within(screen.getByRole('navigation')).getByRole('button', { name: label })

describe('App shell — happy path', () => {
  it('gates the stepper and clicks through generate → optimize → simulation', async () => {
    render(<App />)

    // Setup screen shown; downstream steps disabled until prerequisites exist.
    expect(screen.getByText('Set up scenario')).toBeInTheDocument()
    expect(stepButton('Planning')).toBeDisabled()
    expect(stepButton('Simulation')).toBeDisabled()

    // Generate a scenario → Planning unlocks and Generate navigates onto it.
    fireEvent.click(screen.getByRole('button', { name: 'Generate scenario' }))
    expect(stepButton('Planning')).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Planning' })).toBeInTheDocument()

    // Optimize → fake worker resolves → result present, Simulation/Report
    // unlock, and Planning auto-advances to the simulation placeholder.
    fireEvent.click(screen.getByRole('button', { name: 'Optimize' }))
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(useOptimizationStore.getState().result).not.toBeNull()
    expect(stepButton('Simulation')).toBeEnabled()
    expect(stepButton('Report')).toBeEnabled()
    expect(screen.getByText('Delivery simulation')).toBeInTheDocument()
  })
})
