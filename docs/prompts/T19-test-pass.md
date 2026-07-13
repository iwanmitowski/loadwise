# T19 — Test pass + Playwright smoke (all hands, lead: Track C)

Depends: T18 · Branch: `feat/T19-tests`

## Context

Read `idea.md` §Testing. Unit tests exist per-task already; this pass adds the cross-cutting safety nets and (time permitting) one browser smoke test. Do NOT chase coverage numbers — chase the invariants that protect the demo.

## Priority order (stop where time runs out)

1. **Optimizer invariant suite** (`src/features/optimizer/invariants.test.ts`) — the highest-value test in the repo: for ~20 fixed seeds × 3 vehicles × side door on/off: run `generateScenario` + `optimize`, then assert for every trip: `validateLoad` returns zero violations; every requested item is exactly once in {placed, deferred→later trip, unplaceable}; loadingOrder is 1..n dense; trip weight ≤ payload; maxTrips respected. Any failure prints the seed — instant repro.
2. **Full-pipeline determinism test**: same seed twice ⇒ deep-equal scenario and result (minus elapsedMs). (Skip if T18 already added it — verify it exists.)
3. **Store/UI regression tests**: only where T18 found bugs — pin each fixed bug with a test.
4. **Playwright smoke** (if ≥ 3h remain): install `@playwright/test` (chromium only). One spec: open app → Load demo → planning shows shops → Optimize → simulation screen canvas appears → switch to Report → overall score visible and > 0 → export button downloads. Run headless in CI as a separate non-blocking job (don't gate merges on it this late).

## Decisions already made

- No component-level 3D testing (R3F in jsdom is not worth it — the invariant suite + smoke covers the risk).
- Keep total `npm run test` under ~60s so it stays in CI.

## Acceptance criteria

- [ ] Invariant suite green across all seeds (record any seed that needed an optimizer fix — that's a T18-class bug, fix before merging)
- [ ] Determinism test present and green
- [ ] CI green including new tests; Playwright job added if built

## Wrap up

TASKS.md, worklog, commits `T19:`.
