// Optimizer Web Worker (Vite module worker). Receives one OptimizeRequest per
// message, runs the synchronous optimizer, and streams OptimizerProgress before
// a final OptimizerDone / OptimizerError. Cancellation is handled entirely by
// the client terminating the worker (optimize() is synchronous, so cooperative
// flags could never be observed mid-run anyway).
//
// T07 merged before this task started, so the real `optimize` is wired directly
// — the prompt's mock phase was skipped (see worklog).

import { optimize } from '@/features/optimizer/optimize'
import type { OptimizeRequest, OptimizerResponse } from '@/types'

// tsconfig only loads the DOM lib; type the worker scope minimally instead of
// pulling in lib.webworker for one file.
type WorkerScope = {
  postMessage(message: OptimizerResponse): void
  onmessage: ((event: MessageEvent<OptimizeRequest>) => void) | null
}
const ctx = self as unknown as WorkerScope

/** Minimum gap between forwarded progress messages (~10 msgs/s max). */
const PROGRESS_INTERVAL_MS = 100

ctx.onmessage = (event) => {
  const { requestId, scenario, config } = event.data

  let lastSentAt = -Infinity
  const onProgress = (percent: number, stage: string) => {
    const now = performance.now()
    // Always let the terminal 100% through; throttle everything else.
    if (percent < 100 && now - lastSentAt < PROGRESS_INTERVAL_MS) return
    lastSentAt = now
    ctx.postMessage({ type: 'progress', requestId, percent, stage })
  }

  try {
    const result = optimize(scenario, config, onProgress)
    ctx.postMessage({ type: 'done', requestId, result })
  } catch (error) {
    ctx.postMessage({
      type: 'error',
      requestId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
