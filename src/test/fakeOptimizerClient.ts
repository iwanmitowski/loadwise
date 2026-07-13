// Fake OptimizerClient for jsdom tests — real Workers don't exist there.
// Mirrors the real client's contract: resolves the demo result (re-stamped
// with the scenario's seed) on a timer so tests drive completion with fake
// timers, and cancel()/auto-cancel reject the in-flight promise with
// CancelledError exactly like worker termination does.

import { demoResult } from '@/fixtures/demo'
import { CancelledError, type OptimizerClient } from '@/workers/optimizerClient'

export function createFakeOptimizerClient(delayMs = 50): OptimizerClient {
  let pending: { timer: ReturnType<typeof setTimeout>; reject: (e: Error) => void } | null =
    null

  const cancel = (): void => {
    if (!pending) return
    clearTimeout(pending.timer)
    const { reject } = pending
    pending = null
    reject(new CancelledError())
  }

  return {
    run: (scenario, _config, onProgress) => {
      cancel() // only one run in flight, like the real client
      return new Promise((resolve, reject) => {
        onProgress({ percent: 10, stage: 'Optimizing…' })
        const timer = setTimeout(() => {
          pending = null
          resolve({ ...demoResult, seed: scenario.config.seed })
        }, delayMs)
        pending = { timer, reject }
      })
    },
    cancel,
  }
}
