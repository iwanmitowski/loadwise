# T17 — Demo mode + edge-case UX

Track C · Depends: T10, T11 (real pipeline live) · Branch: `feat/T17-demo-edge-ux`

## Context

Read `idea.md` §Demo Mode and §Important Edge Cases. Two jobs: (1) a one-click demo scenario that reliably shows off everything, (2) friendly UX for every edge case — clear messages instead of crashes or blank screens.

## Demo mode

- "**Load demo**" button on the Setup screen (activate the placeholder from T10): applies a **hard-coded ScenarioConfig** `{ seed: DEMO_SEED, vehicleId: 'box-truck', sideDoor: 'left', shopCount: 6 }` from `src/fixtures/demoConfig.ts`, generates, and jumps straight to Planning.
- **Finding DEMO_SEED is part of this task**: write a small dev script (`scripts/findDemoSeed.ts`, run with `npx tsx` or vitest, dev-only) that loops candidate seeds through `generateScenario` + `optimize` and prints seeds satisfying ALL idea.md demo criteria: ≥ 2 trips, ≥ 1 deferred item, ≥ 1 side-door-assigned shop, mixed cargo categories, 0 permanent unplaceables (a clean-ish but interesting demo). Pick one, hard-code it with a comment listing what it demonstrates. If no seed satisfies everything, relax in this order (document choice): mixed categories → side-door shop. Coordinate with Track A if the search reveals optimizer quirks — that feedback is valuable for T18.
- README + report screen footer mention the demo seed for reproducibility.

## Edge-case UX (map each to a concrete behavior — idea.md's 15-case list)

| Case | UX |
|---|---|
| Empty scenario / no shops / all shops zero-cargo | Planning shows empty-state card "Nothing to deliver — regenerate"; Optimize disabled with tooltip |
| Shop requests zero cargo | Shop card shows "No cargo requested" (T10 has it — verify), excluded from stops |
| Cargo larger than vehicle / heavier than payload | Report unplaceable table (T16) + planning-screen pre-warning: amber chip on shop card "1 item won't fit this vehicle" (cheap pre-check: dims/payload vs vehicle — reuse T07's pre-filter helper, don't reimplement) |
| No valid placement / optimizer loads zero items | Report shows empty-trip warning; simulation screen shows shell + "Nothing could be loaded" overlay instead of blank scene |
| More than one trip | TripSelector visible; toast after optimize: "Plan needs N trips" |
| Preferred side door unavailable | Handled silently by optimizer (falls back rear); planning shows door chip with strikethrough + "→ rear" |
| Zero total weight / division guards | T08 guarantees math; verify UI renders "—" not NaN (T16) — add a test |
| Invalid generated dimensions / overlapping placements | `validateLoad` failures → red banner on report "Internal validation failed (n violations)" + console detail; never crash |
| Split shop order | Warning + ⚠ badge on legend (T16 has it — verify end-to-end) |
| All cargo permanently unplaceable | Report renders with score 0 + clear message; simulation shows empty shell state |
| Worker error / cancel | Error alert with retry (T10 has it — verify against a thrown error via a debug flag) |

Implement missing pieces; where T10/T16 already cover it, add the verification to your checklist rather than duplicating.

- **Error boundary** around the 3D canvas (R3F failure → "3D view failed to load" card with reload button, app keeps working).
- Global toast/banner primitive if one doesn't exist yet (tiny, no library).

## Tests

RTL for: empty-state gating, NaN-free rendering with zero-weight fixture, pre-warning chip logic. Manual checklist in PR for the rest (list each case + how you triggered it).

## Acceptance criteria

- [ ] Demo button: one click → planning → optimize → 2+ trips, deferred item, side door in use
- [ ] Every table row above has its behavior implemented or verified (checklist in PR description)
- [ ] typecheck/lint/test green

## Wrap up

TASKS.md, worklog, commits `T17:`.
