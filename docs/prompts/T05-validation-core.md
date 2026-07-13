# T05 — Geometry & constraint validation core

Track A · Depends: T02 · Branch: `feat/T05-validation-core`

## Context

Read `CLAUDE.md` §Domain conventions and `idea.md` §Automatic cargo placement (the "optimizer must validate" list). This is the correctness heart of LoadWise: pure geometry + constraint checks the heuristic (T06) calls thousands of times and the report (T08) uses for final verification. `src/features/optimizer/` — no React/Three imports, integer math only.

## Contracts

```ts
// src/features/optimizer/geometry.ts
export type PlacedBox = { cargoId: string; templateId: CargoCategory; min: Vec3; size: Dimensions; weightKg: number };
export function toPlacedBox(placement: CargoPlacement, template: CargoTemplate): PlacedBox; // applies rotationY 90 w/d swap
export function boxesOverlap(a: PlacedBox, b: PlacedBox): boolean;       // strict interior overlap; touching faces (shared edge/coordinate) is NOT overlap
export function insideVehicle(box: PlacedBox, space: Dimensions): boolean;
export function footprintOverlapArea(a: PlacedBox, b: PlacedBox): number; // XZ-plane intersection area in cm²

// src/features/optimizer/support.ts
export type SupportInfo = { ratio: number; supporters: string[] };       // ratio: 0..1 of base area supported
export function computeSupport(box: PlacedBox, placed: PlacedBox[]): SupportInfo;
// floor: box.min.y === 0 → ratio 1, supporters []
// else: supporters are boxes whose top face y === box.min.y; ratio = Σ footprintOverlapArea / baseArea

// src/features/optimizer/validate.ts
export type ConstraintViolation = { code: 'out-of-bounds' | 'overlap' | 'over-payload' | 'insufficient-support' | 'floor-only-violated' | 'unstackable-support' | 'support-overweight'; cargoId: string; detail: string };
export function validateCandidate(candidate: PlacedBox, placed: PlacedBox[], vehicle: VehicleDefinition, config: OptimizerConfig, currentWeightKg: number): ConstraintViolation[];  // fast path used by the heuristic; empty array = valid
export function validateLoad(placements: CargoPlacement[], scenario: Scenario, config: OptimizerConfig): ConstraintViolation[];  // full re-check of a finished trip, used by report + tests
```

## Rules to enforce (each is one check + one test minimum)

1. **Bounds**: box entirely within cargo space.
2. **Overlap**: no interior intersection with any placed box.
3. **Payload**: `currentWeightKg + box.weightKg ≤ vehicle.maxPayloadKg`.
4. **Support**: `computeSupport(...).ratio ≥ config.supportThreshold` (0.7).
5. **Floor-only**: template with `floorOnly` ⇒ `min.y === 0`.
6. **Unstackable supporters**: every supporter's template must have `stackable: true` (this automatically covers fragile boxes and beverage pallets).
7. **Supporter weight**: for each supporter, total weight resting **directly** on it (all boxes whose bottom = its top, weight attributed proportionally to contact area) must stay ≤ its `maxSupportedWeightKg`. Direct load only — no transitive propagation (documented simplification).
8. Upright is structural (rotation only swaps w/d) — no check needed; note it.

`validateLoad` re-runs all of the above over a complete placement list and also catches duplicate cargoIds and overlapping pairs (idea.md edge case "Two cargo items receive overlapping positions").

## Decisions already made

- Integer cm in, integer cm² out — exact comparisons, no epsilon.
- `validateCandidate` must be allocation-light (called in the hot loop): return early on first violation? **No** — return all violations found but order checks cheapest-first (bounds → overlap → payload → support chain) and let callers use `.length === 0`.
- Weight attribution for rule 7: proportional to `footprintOverlapArea` with each supporter.

## Tests

Table-driven Vitest cases per rule (valid + invalid pairs), plus: touching faces not an overlap; box on two supporters splitting weight; support exactly at 70% passes, 69.x% fails (construct with integer areas); fixture from T03 passes `validateLoad` cleanly (add that test to the fixture's TODO marker).

## Out of scope

No candidate generation, scoring, or placement selection (T06). No accessibility/blocking math (T06/T08 own that).

## Acceptance criteria

- [ ] All 7 rules implemented + tested both directions (pass and fail)
- [ ] T03 fixture validates clean
- [ ] typecheck/lint/test green

## Wrap up

TASKS.md, worklog, commits `T05:`.
