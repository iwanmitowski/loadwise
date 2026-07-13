# T07 — Multi-trip planner

Track A · Depends: T06 · Branch: `feat/T07-multi-trip-planner` · **Start Claude in plan mode.**

## Context

Read `idea.md` §Automatic trip planning, §Multi-trip behavior. Wraps `planSingleTrip` (T06) in the overflow loop: create trips until all cargo is placed or proven unplaceable. This is also where the optimizer's public entry point lives.

## Contract

```ts
// src/features/optimizer/optimize.ts
export type ProgressFn = (percent: number, stage: string) => void;
export function optimize(scenario: Scenario, config: OptimizerConfig, onProgress?: ProgressFn): OptimizationResult;
```
(`elapsedMs`: measure with `performance.now()` **only at the optimize() boundary** — acceptable nondeterminism in a metadata field; document it. The ESLint Date.now ban stands; performance.now via a tiny injected clock or a lint-exempted wrapper in `src/utils/clock.ts`.)

## Algorithm (decisions already made)

1. **Pre-filter permanents** before trip 1: items that fit in no orientation → `exceeds-vehicle-dimensions`; single item weight > payload → `exceeds-payload`. Both `permanent: true`, never enter the loop.
2. **Trip loop** (max `config.maxTrips` = 10): run `planSingleTrip` on remaining items (all remaining shops, original deliveryOrder values kept).
3. **Anti-split rule**: after a trip plan returns, for each shop that got **split** (some placed, some unplaced): if < 50% of its items were placed AND at least one other shop placed ≥ 1 item in this trip, remove that shop's placements from the trip and defer the whole shop. Re-run is NOT needed — removal is enough for MVP (space stays unused; note as known simplification). Record genuinely split shops in `metrics.splitShopIds`.
4. **Loop safety**: if a trip places 0 items, mark all remaining as `no-valid-placement`, `permanent: true`, and stop (prevents infinite loops — idea.md requirement).
5. Deferred items (`permanent: false`, reason from T06) become the next trip's input. After `maxTrips`, leftovers get `trip-limit-reached`, `permanent: true`.
6. **Stops per trip**: shops with ≥ 1 placement, ordered by original `deliveryOrder`, renumbered `stopNumber` 1..k, door = shop's assigned door.
7. **Trip IDs** `trip-1..n`, `tripNumber` 1-based; stamp `tripId` + global `loadingOrder` (per trip, 1-based) into placements.
8. **Metrics/warnings**: call T08's builders per trip and result-level (if T08 not merged yet, emit placeholder zeros behind its interface and coordinate; prefer building after T08).
9. **Progress**: call `onProgress` at least per trip and every ~10 items inside the item loop (thread a callback into planSingleTrip via optional param — add it to T06's input as `onItemPlaced?`), stages like `"Trip 2: placing 34/58"`. Never call it more than ~50×/run.
10. **Safety time limit**: check the injected clock against `config.safetyTimeLimitMs` (8s) once per item; on trigger, finish the current item, mark the rest `no-valid-placement` with detail `time-limit`, add a `time-limit` warning, return best-so-far. (Deterministic caps should make this unreachable in practice.)

## Tests

- One-trip case passes through unchanged.
- Volume overflow: cargo for 2 trips → 2 trips, all placed, deferred items in trip 2 (assert `deferredCargo` of trip 1 equals trip 2's extra input).
- Weight overflow: light-volume/heavy-weight set (beverage pallets in a cargo-van, payload 1200) → splits on weight.
- Anti-split: construct a shop that 20%-fits → whole shop lands in trip 2; splitShopIds empty for trip 1.
- Oversized + overweight items end up in `unplaceableCargo` with correct reasons, `permanent: true`, and appear in NO trip.
- Zero placeable items at all → 0 or 1 empty trips, everything permanent, no infinite loop (test with all-oversized cargo).
- `maxTrips` respected → `trip-limit-reached`.
- Determinism: full `optimize` twice ⇒ deep-equal (excluding `elapsedMs`).

## Out of scope

Worker plumbing (T11), metric formulas (T08 — integrate, don't implement), UI.

## Wrap up

TASKS.md, worklog, commits `T07:`. If you touched T06's input type for the progress callback, update `docs/prompts/T06-placement-heuristic.md` accordingly.
