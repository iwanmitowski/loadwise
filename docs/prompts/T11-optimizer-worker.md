# T11 — Optimizer Web Worker + client

Track C · Depends: T02 (protocol) — build against a MOCK first; re-wire when T07 merges · Branch: `feat/T11-optimizer-worker`

## Context

Read `idea.md` §Performance and Cancellation and `src/types/worker.ts` (T02). Two phases on purpose: (1) full worker plumbing with a mock optimizer during Phase 1, (2) swap the mock for the real `optimize()` when T07 lands. The protocol, progress, cancellation, and stale-response handling are THIS task and must not change at swap time.

## Deliverables

```ts
// src/workers/optimizer.worker.ts  (Vite module worker)
// onmessage: OptimizeRequest → runs optimizer, posts OptimizerProgress / OptimizerDone / OptimizerError

// src/workers/optimizerClient.ts
export type OptimizerClient = {
  run(scenario: Scenario, config: OptimizerConfig, onProgress: (p: { percent: number; stage: string }) => void): Promise<OptimizationResult>;
  cancel(): void;
};
export function createOptimizerClient(): OptimizerClient;
```

## Decisions already made

- Worker creation: `new Worker(new URL('./optimizer.worker.ts', import.meta.url), { type: 'module' })` — the Vite-supported pattern; verify it works in `vite build` + `vite preview`, not just dev.
- **requestId**: `crypto.randomUUID()` per run (UI layer — allowed). Client ignores any message whose requestId ≠ current run (stale-response guard, idea.md requirement).
- **Cancellation = terminate**: `cancel()` calls `worker.terminate()`, rejects the in-flight promise with a `CancelledError`, and lazily spawns a fresh worker on next run. Simplest reliable cancel — no cooperative flags.
- Only ONE run in flight: a new `run()` while running auto-cancels the previous.
- **Mock phase**: `src/workers/mockOptimize.ts` — takes a scenario, emits fake progress over ~2s (5 steps), returns `demoResult` from fixtures re-stamped with the request's seed. Worker imports `mockOptimize` behind a single `const optimizeFn = mockOptimize` line — the T07 swap changes exactly that line to the real `optimize` (leave a `TODO(T07)` comment). *(As implemented: T07 had already merged when T11 started, so the mock phase was skipped and the worker wires the real `optimize` directly. jsdom tests use `src/test/fakeOptimizerClient.ts` instead — same role as the mock, but test-only.)*
- Progress throttling: forward at most ~10 messages/s to the client.
- Errors inside the worker → `OptimizerError` message; client rejects; store maps to `status: 'error'`.
- Wire `optimizationStore.run/cancel` (T09) to this client, replacing its setTimeout scaffolding.

## Phase 2 (after T07 merges — same task, same prompt)

Swap mock → real `optimize(scenario, config, onProgress)`. Verify: 100-item scenario (warehouse-heavy seed) completes < 5s with visible progress; cancel mid-run leaves UI consistent (`cancelled` status, re-run works); two rapid runs → only latest result lands.

## Tests

Vitest with the client's message handling factored pure: stale requestId ignored; error mapping; auto-cancel on second run. (Full worker e2e is covered manually + in T19's Playwright smoke — document the manual check in the PR.)

## Out of scope

Optimizer internals (T06–T08), UI beyond wiring the existing store.

## Acceptance criteria

- [ ] Optimize button drives real progress bar from worker messages; cancel works; stale results never render
- [ ] Works in `vite preview` (production worker bundling verified)
- [ ] typecheck/lint/test green

## Wrap up

TASKS.md, worklog, commits `T11:`. When Phase 2 lands, note the swap in the worklog and ping Track A that end-to-end is live (that's Milestone M2).
