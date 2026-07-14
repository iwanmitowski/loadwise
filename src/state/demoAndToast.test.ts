import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScenarioStore } from './scenarioStore'
import { useOptimizationStore, setOptimizerClient } from './optimizationStore'
import { useToastStore } from './toastStore'
import { DEMO_CONFIG } from '@/fixtures/demoConfig'
import { demoResult } from '@/fixtures/demo'
import type { OptimizationResult } from '@/types'
import type { OptimizerClient } from '@/workers/optimizerClient'

afterEach(() => {
  setOptimizerClient(null)
  useToastStore.getState().clear()
  useOptimizationStore.getState().reset()
})

describe('loadDemo', () => {
  it('applies the demo config and generates a matching scenario', () => {
    useScenarioStore.getState().loadDemo()
    const { config, scenario } = useScenarioStore.getState()

    expect(config).toEqual(DEMO_CONFIG)
    expect(scenario).not.toBeNull()
    expect(scenario!.config.seed).toBe(DEMO_CONFIG.seed)
    expect(scenario!.shops).toHaveLength(6)
    expect(scenario!.vehicle.id).toBe('box-truck')
    // sideDoor 'left' → the vehicle carries a left door.
    expect(scenario!.vehicle.doors.some((d) => d.side === 'left')).toBe(true)
  })
})

describe('toastStore', () => {
  it('adds, deduplicates and dismisses toasts', () => {
    const { show, dismiss } = useToastStore.getState()
    const id = show('hello', 'info')
    const again = show('hello', 'info')
    expect(id).toBe(again) // deduped
    expect(useToastStore.getState().toasts).toHaveLength(1)

    dismiss(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})

describe('multi-trip toast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires "Plan needs N trips" when a run returns more than one trip', async () => {
    const twoTrip: OptimizationResult = {
      ...demoResult,
      trips: [
        demoResult.trips[0],
        { ...demoResult.trips[0], id: 'trip-2', tripNumber: 2 },
      ],
    }
    const client: OptimizerClient = {
      run: () => Promise.resolve(twoTrip),
      cancel: () => {},
    }
    setOptimizerClient(client)

    useOptimizationStore.getState().run({} as never)
    await vi.runAllTimersAsync()

    const messages = useToastStore.getState().toasts.map((t) => t.message)
    expect(messages).toContain('Plan needs 2 trips')
  })

  it('does not toast for a single-trip result', async () => {
    const client: OptimizerClient = {
      run: () => Promise.resolve(demoResult),
      cancel: () => {},
    }
    setOptimizerClient(client)

    useOptimizationStore.getState().run({} as never)
    await vi.runAllTimersAsync()

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
