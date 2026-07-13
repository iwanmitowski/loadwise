# LoadWise — 48-Hour Execution Plan

Team of 3 developers, all using Claude Code (planning sessions: Fable 5 · implementation sessions: Opus 4.8). Hours are relative to kickoff (H0). Full task details live in `docs/prompts/`, live status in [TASKS.md](TASKS.md).

## Tracks (one developer each — claim yours in TASKS.md at kickoff)

| Track | Focus | Tasks |
|---|---|---|
| **A — Domain & Optimizer** | Types, RNG, scenario generation, validation, placement heuristic, multi-trip, metrics | T02–T08, lead T18 |
| **B — 3D & Animation** | R3F vehicle scene, cargo rendering, loading animation, delivery simulation | T12–T15, lead T20 |
| **C — UI, State & Integration** | Scaffold, stores, screens, worker, report, demo mode, deploy | T01, T09–T11, T16–T17, lead T19 |

Track A is the critical path for correctness; Track B for demo wow-factor; Track C for gluing it together. The **fixtures file (T03)** is what lets B and C build against realistic data from hour ~3 without waiting for the optimizer.

## Phase 0 — Foundation (H0–H2) · all hands

- **T01** (C): Scaffold Vite + React + TS + Tailwind + R3F + Zustand + Vitest + ESLint (with determinism lint rules) + GitHub Actions CI + deploy hello page to Vercel.
- **T02** (A): All shared types + vehicle definitions + cargo catalog + optimizer config. **All three devs review this PR before merge** — it is the contract everyone codes against.
- B meanwhile: reviews T02, skims R3F/drei docs, prepares track B branch.

**Milestone M0 (H2):** repo builds, CI green, public URL live, types merged. Everyone pulls `main` and forks off.

## Phase 1 — Parallel core (H2–H12)

| Track A | Track B | Track C |
|---|---|---|
| T03 seeded RNG + fixtures | T12 vehicle 3D scene | T09 stores + app shell |
| T04 scenario generator | T13 cargo rendering (from fixtures) | T10 setup + planning screens |
| T05 validation core | | T11 worker skeleton w/ mock optimizer |

**Milestone M1 (H12):** scenario generation works with visible seed; 3D shows fixture cargo inside a vehicle with doors/walls/camera; screens navigate; worker round-trips a mock result with progress + cancel.

## Phase 2 — The engine meets the app (H12–H24)

| Track A | Track B | Track C |
|---|---|---|
| T06 placement heuristic | T13 finish (selection, labels, filters) | T11 wire real optimizer into worker |
| T07 multi-trip planner | T14 loading animation | T16 report screen |
| T08 metrics + warnings | | |

**Milestone M2 (H24) — the integration milestone, do not slip it:** end-to-end happy path works: generate scenario → optimize in worker → view real placements per trip in 3D → read real report numbers. If M2 is at risk, cut from the ladder below immediately.

## Phase 3 — Feature complete (H24–H36)

| Track A | Track B | Track C |
|---|---|---|
| Tune scoring weights, fix optimizer bugs found via UI | T15 delivery simulation | T17 demo mode + edge-case UX |
| **T18** integration hardening: walk all 15 edge cases from idea.md (lead A, all help) | | |

**Milestone M3 (H36):** feature complete — loading animation, delivery simulation, report with warnings, demo seed chosen (must show ≥2 trips + ≥1 deferred item + side-door value).

## Phase 4 — Ship (H36–H48)

- **T19** (lead C): unit-test pass on optimizer invariants (no overlap/bounds/support violations across ~20 seeds, determinism test), Playwright smoke if time permits.
- **T20** (lead B): visual polish, README with screenshots, final deploy, 3-minute demo script + rehearsal.
- **H44: feature freeze.** Only bug fixes after this. H46–H48: buffer + submission.

## Sync cadence

15-minute stand-ups at H2 (M0), H12, H24, H36, H44 — demo your track live, re-balance tasks if a track slips. Any `src/types/` change after M0 is announced immediately, not at the next sync.

## Scope-cut ladder (cut top-first when behind)

1. Optimizer improvement/repack pass (idea.md step 12 — already marked optional)
2. Playwright e2e (keep unit tests)
3. Temporary-move animation for blocking cargo in delivery sim (keep highlight + counters)
4. Side-door corridor scoring (keep simple near-door placement preference)
5. Center-of-mass marker
6. Animation speed control (keep play/pause/restart)
7. Cargo filter by shop (keep legend + click-to-select)

**Never cut:** determinism/seed replay, multi-trip planning, 3D trip view, report metrics, public deploy. These are acceptance criteria.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Type contract churn breaks parallel work | T02 reviewed by all 3 before merge; later changes flagged `[TYPES CHANGE]` in PR title + immediate team ping |
| Heuristic too slow (100 items) | Deterministic caps (candidate-point cap) sized in T06; time is a safety fallback only, with warning |
| Time-based cutoff breaks determinism | Primary limits are deterministic (caps/iterations); `performance.now()` safety cutoff at 8s lives only in the worker and emits a `time-limit` warning |
| Worker integration surprises late | T11 builds the full protocol against a mock optimizer in Phase 1; only the function behind it swaps in Phase 2 |
| Merge conflicts between 3 devs | Directory ownership per track; per-dev worklog files; merge to `main` at least every ~4h |
| `Math.random()` sneaks in, breaking seed replay | ESLint `no-restricted-properties` ban in domain dirs (set up in T01) + determinism unit test (T19) |
| A track falls behind | Prompts make every task transferable — any dev can pick up any `docs/prompts/Txx` file; re-balance at syncs |
| R3F performance with ~100 boxes | Fine without instancing; animate via refs in `useFrame`, never per-frame React state (spec'd in T14) |

## Model usage

- **Fable 5** — planning: architecture changes, re-planning at syncs, writing/updating task prompts, debugging gnarly cross-cutting issues.
- **Opus 4.8** — implementation: one fresh session per task, kicked off with `Read docs/prompts/Txx-... and implement it.` For the four hardest tasks (T06, T07, T14, T15) start the session in **plan mode**, approve the plan, then let it implement.
