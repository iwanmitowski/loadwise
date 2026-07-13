// Main-thread client for the optimizer worker. Owns the full protocol contract
// (idea.md §Performance and Cancellation):
//  - one run in flight — a new run() auto-cancels the previous one
//  - cancel() terminates the worker (the only reliable way to stop a synchronous
//    optimize) and lazily spawns a fresh one on the next run
//  - every response is matched by requestId; stale responses are ignored
//
// The worker is spawned through an injectable factory so tests can drive the
// message handling without a real Worker (jsdom has none).

import type { OptimizationResult, OptimizerConfig, OptimizerResponse, Scenario } from '@/types'

export type OptimizerProgressUpdate = { percent: number; stage: string }

export type OptimizerClient = {
  run(
    scenario: Scenario,
    config: OptimizerConfig,
    onProgress: (p: OptimizerProgressUpdate) => void,
  ): Promise<OptimizationResult>
  cancel(): void
}

/** Rejection value for cancelled runs — callers treat it as "not an error". */
export class CancelledError extends Error {
  constructor() {
    super('Optimization cancelled')
    this.name = 'CancelledError'
  }
}

/** The slice of Worker the client uses — fakeable in tests. */
export type WorkerLike = {
  postMessage(message: unknown): void
  terminate(): void
  onmessage: ((event: MessageEvent<OptimizerResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

/** One in-flight run awaiting worker responses. */
export type PendingRun = {
  requestId: string
  onProgress: (p: OptimizerProgressUpdate) => void
  resolve: (result: OptimizationResult) => void
  reject: (error: Error) => void
}

/**
 * Apply one worker response to the pending run (pure decision logic, exported
 * for tests). Returns what happened: `ignored` (no run, or stale requestId),
 * `progress` (forwarded), or `settled` (resolved/rejected — caller must clear
 * its pending slot).
 */
export function handleWorkerMessage(
  pending: PendingRun | null,
  message: OptimizerResponse,
): 'ignored' | 'progress' | 'settled' {
  if (!pending || message.requestId !== pending.requestId) return 'ignored'
  switch (message.type) {
    case 'progress':
      pending.onProgress({ percent: message.percent, stage: message.stage })
      return 'progress'
    case 'done':
      pending.resolve(message.result)
      return 'settled'
    case 'error':
      pending.reject(new Error(message.message))
      return 'settled'
  }
}

// The literal `new Worker(new URL(...), { type: 'module' })` pattern is what
// Vite's static analysis needs to bundle the worker for production.
function spawnWorker(): WorkerLike {
  return new Worker(new URL('./optimizer.worker.ts', import.meta.url), {
    type: 'module',
  })
}

export function createOptimizerClient(
  spawn: () => WorkerLike = spawnWorker,
): OptimizerClient {
  let worker: WorkerLike | null = null
  let pending: PendingRun | null = null

  const ensureWorker = (): WorkerLike => {
    if (worker) return worker
    const w = spawn()
    w.onmessage = (event) => {
      if (handleWorkerMessage(pending, event.data) === 'settled') pending = null
    }
    w.onerror = (event) => {
      // Script-level failure — the worker is in an unknown state, replace it.
      const failed = pending
      pending = null
      worker = null
      w.terminate()
      failed?.reject(new Error(event.message || 'Optimizer worker failed'))
    }
    worker = w
    return w
  }

  const cancel = (): void => {
    const cancelled = pending
    pending = null
    if (worker) {
      // Terminate is the cancel mechanism: optimize() runs synchronously inside
      // the worker, so no cooperative flag could interrupt it.
      worker.terminate()
      worker = null
    }
    cancelled?.reject(new CancelledError())
  }

  const run: OptimizerClient['run'] = (scenario, config, onProgress) => {
    if (pending) cancel() // only one run in flight
    const w = ensureWorker()
    // UI-layer request id — crypto.randomUUID is allowed outside src/features.
    const requestId = crypto.randomUUID()
    return new Promise<OptimizationResult>((resolve, reject) => {
      pending = { requestId, onProgress, resolve, reject }
      w.postMessage({ type: 'optimize', requestId, scenario, config })
    })
  }

  return { run, cancel }
}
