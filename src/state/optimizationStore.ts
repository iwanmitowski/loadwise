import { create } from 'zustand'
import type { OptimizationResult, Scenario } from '@/types'
import { demoResult } from '@/fixtures/demo'
import { useUiStore } from './uiStore'

export type OptimizationStatus =
  | 'idle'
  | 'running'
  | 'done'
  | 'error'
  | 'cancelled'

export type OptimizationProgress = { percent: number; stage: string }

export type OptimizationState = {
  status: OptimizationStatus
  progress: OptimizationProgress | null
  result: OptimizationResult | null
  error: string | null

  run(scenario: Scenario): void
  cancel(): void
  reset(): void
}

// TODO(T11): replace this fixture-driven scaffold with the real optimizer worker
// client. Until then, `run` fakes a short async job and returns the demo result
// so the setup → planning → simulation → report flow is clickable end to end.
const FAKE_RUN_MS = 400

export const useOptimizationStore = create<OptimizationState>((set, get) => {
  // Token guards against a stale timer resolving after cancel()/reset().
  let runToken = 0

  const finish = (token: number, scenario: Scenario) => {
    if (token !== runToken || get().status !== 'running') return
    const result: OptimizationResult = { ...demoResult, seed: scenario.config.seed }
    set({ status: 'done', progress: { percent: 100, stage: 'Done' }, result })
    // selectedTripId default: first trip when a result arrives.
    useUiStore.getState().setSelectedTrip(result.trips[0]?.id ?? null)
  }

  return {
    status: 'idle',
    progress: null,
    result: null,
    error: null,

    run: (scenario) => {
      const token = ++runToken
      set({
        status: 'running',
        progress: { percent: 0, stage: 'Optimizing…' },
        result: null,
        error: null,
      })
      // TODO(T11): delegate to the worker client; this setTimeout is scaffolding.
      setTimeout(() => finish(token, scenario), FAKE_RUN_MS)
    },

    cancel: () => {
      runToken++
      if (get().status === 'running') {
        set({ status: 'cancelled', progress: null })
      }
    },

    reset: () => {
      runToken++
      set({ status: 'idle', progress: null, result: null, error: null })
    },
  }
})
