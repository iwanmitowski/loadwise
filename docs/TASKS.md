# LoadWise — Task Board

Live source of truth for who is doing what. Update the **Owner** cell when you claim a track at kickoff, and the **Status** cell when you start (`wip`) and finish (`done`) a task. Statuses: `todo` · `wip` · `review` · `done` · `cut`.

Rules: respect the Depends column · one branch per task (`feat/Txx-slug`) · commits prefixed `Txx:` · worklog entry on completion (see [worklog/README.md](worklog/README.md)).

| ID | Task | Track | Owner | Depends | Prompt | Status |
|---|---|---|---|---|---|---|
| T01 | Scaffold, tooling, CI, Vercel deploy | C | — | — | [T01](prompts/T01-scaffold-and-deploy.md) | todo |
| T02 | Domain types, vehicle & cargo catalog, config | A | — | — | [T02](prompts/T02-domain-types-and-data.md) | todo |
| T03 | Seeded RNG + demo fixtures | A | — | T02 | [T03](prompts/T03-rng-and-fixtures.md) | todo |
| T04 | Scenario generator | A | — | T02, T03 | [T04](prompts/T04-scenario-generator.md) | todo |
| T05 | Geometry & constraint validation | A | — | T02 | [T05](prompts/T05-validation-core.md) | todo |
| T06 | Placement heuristic (single trip) | A | — | T03, T05 | [T06](prompts/T06-placement-heuristic.md) | todo |
| T07 | Multi-trip planner | A | — | T06 | [T07](prompts/T07-multi-trip-planner.md) | todo |
| T08 | Metrics, warnings, report data | A | — | T07 | [T08](prompts/T08-metrics-and-warnings.md) | todo |
| T09 | Zustand stores + app shell | C | — | T01, T02 | [T09](prompts/T09-stores-and-app-shell.md) | todo |
| T10 | Scenario Setup & Planning screens | C | — | T09 | [T10](prompts/T10-setup-and-planning-screens.md) | todo |
| T11 | Optimizer Web Worker + client | C | — | T02 (mock) → T07 (real) | [T11](prompts/T11-optimizer-worker.md) | todo |
| T12 | Vehicle 3D scene | B | — | T01, T02 | [T12](prompts/T12-vehicle-scene.md) | todo |
| T13 | Cargo rendering & interaction | B | — | T03, T12 | [T13](prompts/T13-cargo-rendering.md) | todo |
| T14 | Loading animation | B | — | T13 | [T14](prompts/T14-loading-animation.md) | todo |
| T15 | Delivery simulation | B | — | T13, T05 | [T15](prompts/T15-delivery-simulation.md) | todo |
| T16 | Report screen, trip selector, legend | C | — | T09 (mock) → T08 (real) | [T16](prompts/T16-report-screen.md) | todo |
| T17 | Demo mode + edge-case UX | C | — | T10, T11 | [T17](prompts/T17-demo-mode-and-edge-ux.md) | todo |
| T18 | Integration hardening (15 edge cases) | all (lead A) | — | T04–T16 | [T18](prompts/T18-integration-hardening.md) | todo |
| T19 | Test pass + Playwright smoke | all (lead C) | — | T18 | [T19](prompts/T19-test-pass.md) | todo |
| T20 | Polish, README, final deploy, demo script | all (lead B) | — | T18 | [T20](prompts/T20-polish-and-ship.md) | todo |

## Dependency shape

```
T01 ─┬─→ T09 → T10 ─┐
     └─→ T12 → T13 ─┼→ T14, T15 ─┐
T02 ─┬─→ T03 ─┬─→ T04 ───────────┼─→ T18 → T19, T20
     │        └─→ T06            │
     ├─→ T05 ──→ T06 → T07 → T08 ┤
     └─→ T11 (mock first) ───────┘
```

T11 and T16 start early against mocks/fixtures and get re-wired to real optimizer output in Phase 2 — that re-wiring is part of those tasks, not a separate one.
