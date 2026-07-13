import { describe, expect, it, vi } from 'vitest'
import type { OptimizationResult, OptimizerResponse } from '@/types'
import { demoScenario } from '@/fixtures/demo'
import { DEFAULT_OPTIMIZER_CONFIG } from '@/features/optimizer/config'
import {
  CancelledError,
  createOptimizerClient,
  handleWorkerMessage,
  type PendingRun,
  type WorkerLike,
} from './optimizerClient'

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

type FakeWorker = WorkerLike & {
  posted: Array<{ type: string; requestId: string }>
  terminated: boolean
  emit(message: OptimizerResponse): void
}

function makeFakeWorker(): FakeWorker {
  const worker: FakeWorker = {
    posted: [],
    terminated: false,
    onmessage: null,
    onerror: null,
    postMessage(message: unknown) {
      worker.posted.push(message as { type: string; requestId: string })
    },
    terminate() {
      worker.terminated = true
    },
    emit(message: OptimizerResponse) {
      worker.onmessage?.({ data: message } as MessageEvent<OptimizerResponse>)
    },
  }
  return worker
}

/** Client wired to fake workers; returns the client plus every spawned worker. */
function makeClient() {
  const workers: FakeWorker[] = []
  const client = createOptimizerClient(() => {
    const w = makeFakeWorker()
    workers.push(w)
    return w
  })
  return { client, workers }
}

const RESULT = { seed: 'r', trips: [] } as unknown as OptimizationResult

const startRun = (client: ReturnType<typeof makeClient>['client']) => {
  const onProgress = vi.fn()
  const promise = client.run(demoScenario, DEFAULT_OPTIMIZER_CONFIG, onProgress)
  promise.catch(() => {}) // avoid unhandled-rejection noise when tests cancel
  return { promise, onProgress }
}

// ---------------------------------------------------------------------------
// handleWorkerMessage — pure protocol logic
// ---------------------------------------------------------------------------

describe('handleWorkerMessage', () => {
  const pendingRun = (): PendingRun & { calls: string[] } => {
    const calls: string[] = []
    return {
      requestId: 'req-1',
      calls,
      onProgress: (p) => calls.push(`progress ${p.percent} ${p.stage}`),
      resolve: () => calls.push('resolve'),
      reject: (e) => calls.push(`reject ${e.message}`),
    }
  }

  it('ignores messages when nothing is pending', () => {
    expect(
      handleWorkerMessage(null, { type: 'done', requestId: 'req-1', result: RESULT }),
    ).toBe('ignored')
  })

  it('ignores stale requestIds entirely', () => {
    const pending = pendingRun()
    expect(
      handleWorkerMessage(pending, { type: 'done', requestId: 'old', result: RESULT }),
    ).toBe('ignored')
    expect(
      handleWorkerMessage(pending, { type: 'progress', requestId: 'old', percent: 50, stage: 'x' }),
    ).toBe('ignored')
    expect(
      handleWorkerMessage(pending, { type: 'error', requestId: 'old', message: 'boom' }),
    ).toBe('ignored')
    expect(pending.calls).toEqual([])
  })

  it('forwards progress and settles on done', () => {
    const pending = pendingRun()
    expect(
      handleWorkerMessage(pending, { type: 'progress', requestId: 'req-1', percent: 40, stage: 'Trip 1' }),
    ).toBe('progress')
    expect(
      handleWorkerMessage(pending, { type: 'done', requestId: 'req-1', result: RESULT }),
    ).toBe('settled')
    expect(pending.calls).toEqual(['progress 40 Trip 1', 'resolve'])
  })

  it('maps worker errors to a rejection with the message', () => {
    const pending = pendingRun()
    expect(
      handleWorkerMessage(pending, { type: 'error', requestId: 'req-1', message: 'exploded' }),
    ).toBe('settled')
    expect(pending.calls).toEqual(['reject exploded'])
  })
})

// ---------------------------------------------------------------------------
// createOptimizerClient — lifecycle around the protocol
// ---------------------------------------------------------------------------

describe('createOptimizerClient', () => {
  it('posts the request and resolves on the matching done', async () => {
    const { client, workers } = makeClient()
    const { promise, onProgress } = startRun(client)

    const [worker] = workers
    expect(worker.posted).toHaveLength(1)
    const { requestId } = worker.posted[0]

    worker.emit({ type: 'progress', requestId, percent: 30, stage: 'Trip 1' })
    expect(onProgress).toHaveBeenCalledWith({ percent: 30, stage: 'Trip 1' })

    worker.emit({ type: 'done', requestId, result: RESULT })
    await expect(promise).resolves.toBe(RESULT)
  })

  it('ignores responses with a stale requestId', async () => {
    const { client, workers } = makeClient()
    const { promise, onProgress } = startRun(client)
    const [worker] = workers
    const { requestId } = worker.posted[0]

    worker.emit({ type: 'progress', requestId: 'stale', percent: 99, stage: 'old' })
    worker.emit({ type: 'done', requestId: 'stale', result: RESULT })
    worker.emit({ type: 'error', requestId: 'stale', message: 'old failure' })
    expect(onProgress).not.toHaveBeenCalled()

    // The genuine response still lands afterwards.
    worker.emit({ type: 'done', requestId, result: RESULT })
    await expect(promise).resolves.toBe(RESULT)
  })

  it('rejects with the worker error message', async () => {
    const { client, workers } = makeClient()
    const { promise } = startRun(client)
    const [worker] = workers

    worker.emit({ type: 'error', requestId: worker.posted[0].requestId, message: 'no space left' })
    await expect(promise).rejects.toThrow('no space left')
    await expect(promise).rejects.not.toBeInstanceOf(CancelledError)
  })

  it('cancel terminates the worker, rejects with CancelledError, respawns next run', async () => {
    const { client, workers } = makeClient()
    const { promise } = startRun(client)

    client.cancel()
    await expect(promise).rejects.toBeInstanceOf(CancelledError)
    expect(workers[0].terminated).toBe(true)

    // Next run gets a fresh worker.
    startRun(client)
    expect(workers).toHaveLength(2)
    expect(workers[1].posted).toHaveLength(1)
  })

  it('a second run auto-cancels the first; only the latest result lands', async () => {
    const { client, workers } = makeClient()
    const first = startRun(client)
    const second = startRun(client)

    await expect(first.promise).rejects.toBeInstanceOf(CancelledError)
    expect(workers[0].terminated).toBe(true)
    expect(workers).toHaveLength(2)

    // A response replaying the first run's requestId is ignored by the new run.
    const staleId = workers[0].posted[0].requestId
    workers[1].emit({ type: 'done', requestId: staleId, result: RESULT })

    const { requestId } = workers[1].posted[0]
    workers[1].emit({ type: 'done', requestId, result: RESULT })
    await expect(second.promise).resolves.toBe(RESULT)
  })

  it('worker script errors reject the run and replace the worker', async () => {
    const { client, workers } = makeClient()
    const { promise } = startRun(client)

    workers[0].onerror?.({ message: 'importScripts failed' } as ErrorEvent)
    await expect(promise).rejects.toThrow('importScripts failed')

    startRun(client)
    expect(workers).toHaveLength(2)
  })

  it('cancel with nothing in flight is a no-op', () => {
    const { client, workers } = makeClient()
    expect(() => client.cancel()).not.toThrow()
    expect(workers).toHaveLength(0)
  })
})
