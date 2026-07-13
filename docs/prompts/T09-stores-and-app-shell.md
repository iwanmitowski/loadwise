# T09 — Zustand stores + app shell

Track C · Depends: T01, T02 · Branch: `feat/T09-stores-shell`

## Context

Read `CLAUDE.md`. State backbone + screen navigation for the whole app. Other tasks (T10, T13–T17) plug into these stores — get the shapes right, keep logic thin (stores orchestrate; domain functions compute).

## Contracts

```ts
// src/state/scenarioStore.ts
type ScenarioState = {
  config: ScenarioConfig;                       // default: box-truck, sideDoor 'none', shopCount 5, seed 'loadwise-1'
  scenario: Scenario | null;
  setConfig(patch: Partial<ScenarioConfig>): void;
  generate(): void;                             // calls generateScenario(config) — until T04 merges, use demoScenario from fixtures behind a TODO(T04)
  randomizeSeed(): void;                        // crypto.randomUUID().slice(0, 8) — UI layer, allowed
};

// src/state/optimizationStore.ts
type OptimizationState = {
  status: 'idle' | 'running' | 'done' | 'error' | 'cancelled';
  progress: { percent: number; stage: string } | null;
  result: OptimizationResult | null;
  error: string | null;
  run(scenario: Scenario): void;                // delegates to T11's client; until T11 merges, setTimeout + demoResult fixture behind TODO(T11)
  cancel(): void;
  reset(): void;                                // called whenever a new scenario is generated
};

// src/state/uiStore.ts
type UiState = {
  screen: 'setup' | 'planning' | 'simulation' | 'report';
  selectedTripId: string | null;                // default: first trip when result arrives
  selectedCargoId: string | null;
  shopFilter: string | null;                    // shopId or null = all
  wallsVisible: boolean; roofVisible: boolean; doorsOpen: boolean;
  playback: { mode: 'idle' | 'loading' | 'delivery'; playing: boolean; speed: 0.5 | 1 | 2 | 4; index: number };
  // + setters, goTo(screen), resetView()
};
```

## Decisions already made

- Navigation is **state-driven** (screen enum) — no router. Four screens per idea.md §Required Screens.
- Shop colors: `src/utils/shopColors.ts` — `shopColor(index: number): string` from a fixed 8-color palette (distinct hues, readable on dark bg; e.g. `#4f9dde #e8843a #58b978 #d95f8c #8f7ee0 #d9b13b #4fc2c9 #a86f4f`). Color = shops sorted by id, index into palette — deterministic, shared by 3D and legend.
- App shell: dark theme (3D-friendly), header with app name + screen stepper (Setup → Planning → Simulation → Report; later steps disabled until prerequisites exist: planning needs scenario, simulation/report need result), main content area full-height.
- Screens themselves are placeholder `<div>`s here — T10/T16 and Track B fill them. Export `<Screen*>` stubs with the layout slots they'll need (documented props).
- Generating a new scenario resets optimization + ui selections (wire that).

## Tests

Store unit tests (Vitest, no jsdom needed for zustand): generate→reset chain; screen gating logic; shopColor determinism.

## Out of scope

Real screen content (T10/T16), worker (T11), 3D (Track B). Fixture-based `run()` is temporary scaffolding — mark clearly.

## Acceptance criteria

- [ ] `npm run dev` shows shell with working stepper and placeholder screens
- [ ] Stores typed exactly as above; fixture-driven happy path clickable end to end (generate → "optimize" → fake result present)
- [ ] typecheck/lint/test green

## Wrap up

TASKS.md, worklog, commits `T09:`.
