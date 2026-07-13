# T06 — Placement heuristic (single trip)

Track A · Depends: T03, T05 · Branch: `feat/T06-placement-heuristic` · **Start Claude in plan mode for this one.**

## Context

Read `CLAUDE.md` §Domain conventions, `idea.md` §Optimization Strategy, §Placement Scoring, §Door-aware loading. This is the core algorithm: given cargo for ONE trip, produce placements + a list of items that didn't fit. Deterministic greedy best-fit — no global solver, no randomness.

## Contract

```ts
// src/features/optimizer/placeTrip.ts
export type TripPlanInput = { items: CargoItem[]; shops: Shop[]; vehicle: VehicleDefinition; config: OptimizerConfig };
export type TripPlanOutput = {
  placements: Array<Omit<CargoPlacement, 'tripId'>>;   // tripId assigned by T07
  unplaced: Array<{ cargoId: string; shopId: string; reason: UnplacedReason; detail?: string }>;
};
export function planSingleTrip(input: TripPlanInput): TripPlanOutput;
```

## Algorithm (decisions already made — implement as specified)

**1. Door assignment (per shop).** `shop.preferredDoor` if the vehicle has that door, else `rear`. All the shop's items get this `assignedDoor`.

**2. Processing order.** Iterate shops in **reverse delivery order** (last stop first → it ends up deepest for rear-door unloading). Within a shop, sort items: `floorOnly` first → weight desc → volume desc → id asc. This yields the global insertion sequence; `loadingOrder` = 1-based index of successful placement.

**3. Candidate points.** Maintain a set starting with `(0,0,0)`, `(vehicleWidth − itemWidth, 0, depth − itemDepth)`-style wall-corner seeds is unnecessary — use classic extreme points: after placing box b at min corner (x,y,z) with size (w,h,d), add candidates `(x+w, y, z)`, `(x, y, z+d)`, `(x, y+h, z)`. For each item, also try each candidate with the item's max-z face flush against the cabin wall and each side wall when the candidate allows (clamp candidate so box fits; skip if clamping moves it onto another box — validation rejects those anyway). Dedupe points; drop points strictly inside placed boxes; cap total at `config.candidatePointCap`, evicting **highest-score-last** (keep points with lowest y, then highest z) — deterministic eviction order, document it.

**4. Orientations.** rotationY 0 and 90 (skip 90 when w === d).

**5. Validate** every (candidate × orientation) with `validateCandidate` (T05). Invalid → discard.

**6. Score** each valid placement 0–1 per component, combined with `config.weights` (normalize by weight sum):
- `deliveryOrderCompatibility`: for rear-door items, `centerZ / depth` scaled by how late the stop is — concretely `1 − |idealZ − centerZ| / depth`, where `idealZ = depth × (stopsAfterThisShop + 0.5) / stopCount` (later deliveries → deeper ideal band). For side-door items: 1 if the item's z-interval overlaps its door's z-interval, else decays with distance to the door interval (`1 − gap/depth`).
- `doorAccessibility`: 1 − normalized distance from item center to its assigned door's opening center (straight-line, normalized by vehicle diagonal).
- `compactness`: fraction of the 3 min-faces (x=…, y=…, z-max toward cabin) touching a wall or another box (0, ⅓, ⅔, 1).
- `floorPreference`: `1 − min.y / vehicleHeight`.
- `weightBalance`: 1 − |projected left/right weight delta| / totalWeightSoFar (compute incrementally; 1 when total is 0).
- `supportQuality`: the support ratio from T05 (1 for floor).

**7. Select** best score; tiebreak: lower y → higher z → lower x → cargoId asc. Place, update candidates, continue.

**8. Unplaced reasons** (per item, checked in this order): doesn't fit vehicle in any orientation → `exceeds-vehicle-dimensions` (detail: which dims); item weight alone > payload → `exceeds-payload`; remaining payload insufficient → `exceeds-payload` (detail "payload remaining"); floor-only/stacking constraints were the only failures seen → `stacking-constraint`; otherwise → `no-valid-placement`. (`accessibility-constraint` and `trip-limit-reached` are assigned by T07 — export a helper if useful.)

**9. Determinism.** No RNG at all in this module. Every iteration order is sorted with explicit tiebreakers. Candidate set kept in sorted order, not insertion order.

## Blocking metric helper (used by T08/T15 — implement here, it needs placement internals)

```ts
// src/features/optimizer/accessibility.ts
export function findBlockers(target: PlacedBox, targetDoor: VehicleDoor, others: PlacedBox[]): string[];
```
Rear door: blocker = other box with `z < target.z` whose X **and** Y intervals overlap target's (sliding the target straight out along −Z). Left door (x=0 wall): blocker = box with `x < target.x`, Z and Y intervals overlapping. Right door mirrored. Pure geometry — "delivered later" filtering is the caller's job.

## Performance target

100 items ≤ ~3s in a worker on a mid laptop. Guard: candidate cap + early bounds rejection. Add a perf smoke test (not CI-gating): 100-item synthetic input completes < 5s.

## Tests

- Everything-fits case: N small boxes all placed, zero unplaced, `validateLoad` clean.
- Rear-door ordering: 2 shops → the later-delivery shop's cargo has strictly greater mean z.
- Side door: shop preferring `left` gets items whose z-intervals overlap the door interval (build a roomy case).
- Floor-only beverage pallet never leaves floor; fragile box never has anything above it (construct temptation cases).
- Determinism: same input twice ⇒ deep-equal output.
- Overweight single item → `exceeds-payload`; oversized item → `exceeds-vehicle-dimensions`.

## Out of scope

Multi-trip looping (T07), metrics (T08), improvement pass (cut-ladder item — do not build).

## Wrap up

TASKS.md, worklog (note any spec deviations + chosen constants), commits `T06:`.
