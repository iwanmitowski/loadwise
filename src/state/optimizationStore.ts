import { create } from 'zustand'
import { DEFAULT_OPTIMIZER_CONFIG } from '@/features/optimizer/config'
import type { OptimizationResult, Scenario } from '@/types'
import {
  CancelledError,
  createOptimizerClient,
  type OptimizerClient,
} from '@/workers/optimizerClient'
import { debug } from '@/utils/debug'
import { useUiStore } from './uiStore'
import { useToastStore } from './toastStore'

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

// Created lazily so importing the store never touches `Worker` (jsdom has
// none); jsdom tests swap in a fake via setOptimizerClient.
let client: OptimizerClient | null = null
const ensureClient = (): OptimizerClient => (client ??= createOptimizerClient())

/** Test seam: replace the worker-backed client. Pass null to restore default. */
export function setOptimizerClient(next: OptimizerClient | null): void {
  client = next
}

export const useOptimizationStore = create<OptimizationState>((set, get) => ({
  status: 'idle',
  progress: null,
  result: null,
  error: null,

  run: (scenario) => {
    // Debug seam (T17): ?debugOptimizerError forces the failure path so the
    // retry-able error alert can be verified against the real app.
    if (debug.optimizerError()) {
      set({
        status: 'error',
        progress: null,
        result: null,
        error: 'Debug: forced optimizer error (remove ?debugOptimizerError to run).',
      })
      return
    }
    // The client auto-cancels any in-flight run (its promise rejects with
    // CancelledError and is swallowed below), so re-running is always safe.
    set({
      status: 'running',
      progress: { percent: 0, stage: 'Optimizing…' },
      result: null,
      error: null,
    })
    ensureClient()
      .run(scenario, DEFAULT_OPTIMIZER_CONFIG, (progress) => {
        if (get().status === 'running') set({ progress })
      })
      .then((result) => {
        // Settlement races: if cancel()/reset() flipped the status in the gap
        // between the promise settling and this microtask, drop the result.
        if (get().status !== 'running') return
        set({ status: 'done', progress: { percent: 100, stage: 'Done' }, result })
        // selectedTripId default: first trip when a result arrives.
        useUiStore.getState().setSelectedTrip(result.trips[0]?.id ?? null)
        // Multi-trip is a notable outcome — surface it (idea.md edge case).
        if (result.trips.length > 1) {
          useToastStore.getState().show(`Plan needs ${result.trips.length} trips`, 'info')
        }
      })
      .catch((error: unknown) => {
        if (error instanceof CancelledError) return // cancel()/reset() set state
        if (get().status !== 'running') return
        set({
          status: 'error',
          progress: null,
          error: error instanceof Error ? error.message : String(error),
        })
      })
  },

  cancel: () => {
    client?.cancel()
    if (get().status === 'running') {
      set({ status: 'cancelled', progress: null })
    }
  },

  reset: () => {
    client?.cancel()
    set({ status: 'idle', progress: null, result: null, error: null })
  },
}))
