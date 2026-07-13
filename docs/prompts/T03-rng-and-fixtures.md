# T03 — Seeded RNG + demo fixtures

Track A · Depends: T02 · Branch: `feat/T03-rng-fixtures`

## Context

Read `CLAUDE.md` §Domain conventions. Two small deliverables that unblock everyone: the deterministic RNG (foundation of seed replay) and a hand-authored fixture dataset so Tracks B and C can build against realistic data before the optimizer exists. Ship this fast — B and C are waiting on the fixtures.

## Deliverable 1 — `src/utils/rng.ts`

```ts
export type Rng = {
  next(): number;                 // [0, 1)
  int(min: number, max: number): number;  // inclusive both ends
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];     // returns new array, Fisher–Yates
  chance(p: number): boolean;
};
export function createRng(seed: string): Rng;
```

Implementation: xmur3 string hash → mulberry32 PRNG (well-known, tiny, deterministic). No `Math.random` anywhere. Unit tests: same seed ⇒ identical first 100 outputs; different seeds diverge; `int` bounds inclusive; `shuffle` is a permutation and deterministic per seed.

Also `src/utils/download.ts`: `downloadJson(filename: string, data: unknown)` (Blob + object URL — browser-only util, lives in utils but is trivial; exempt from the no-DOM rule, note it).

## Deliverable 2 — `src/fixtures/demo.ts`

Export `demoScenario: Scenario` and `demoResult: OptimizationResult` for the **box-truck** (240×230×620, rear door only). Hand-authored, hard-coded, obviously valid. Use exactly this layout (verified: no overlaps, in bounds, stacking legal):

3 shops — shop-1 "Metro Market" (supermarket, deliveryOrder 3), shop-2 "Hop Cellar" (beverage-store, deliveryOrder 2), shop-3 "Volt Hub" (electronics-store, deliveryOrder 1). All doors rear. Delivery order 1 = unloaded first ⇒ placed nearest the rear door (low z); order 3 deepest.

| cargoId | template | position (x,y,z) | rot | loadingOrder | shop |
|---|---|---|---|---|---|
| shop-1-c1 | standard-pallet | (0,0,540) | 0 | 1 | shop-1 |
| shop-1-c2 | standard-pallet | (120,0,540) | 0 | 2 | shop-1 |
| shop-2-c1 | beverage-pallet | (0,0,460) | 0 | 3 | shop-2 |
| shop-2-c2 | large-box | (120,0,460) | 0 | 4 | shop-2 |
| shop-2-c3 | medium-box | (120,60,460) | 0 | 5 | shop-2 |
| shop-3-c1 | beverage-stack | (0,0,0) | 0 | 6 | shop-3 |
| shop-3-c2 | beverage-stack | (40,0,0) | 0 | 7 | shop-3 |
| shop-3-c3 | fragile-box | (120,0,0) | 0 | 8 | shop-3 |
| shop-3-c4 | medium-box | (180,0,0) | 0 | 9 | shop-3 |

Single trip `trip-1`; `deferredCargo`: one extra `shop-2-c4` beverage-pallet with reason `no-valid-placement`, `permanent: false`. `unplaceableCargo`: empty. Stops: shop-3 (1), shop-2 (2), shop-1 (3), all `rear`. Metrics: compute by hand approximately and hard-code (totalWeight 1,482 kg; weightUtilization ≈ 0.30; fill in the rest plausibly; overallScore 78). Add one warning: `deferred-cargo` "1 beverage pallet moved to a later trip". `demoScenario.shops[*].requestedCargo` must list all 10 items (9 placed + 1 deferred).

Once T05 lands, add a test asserting the fixture passes `validateLoad` — leave a `TODO(T05)` marker now.

## Out of scope

No generation logic (T04), no validation logic (T05). Fixture numbers are hard-coded on purpose — do not compute them.

## Acceptance criteria

- [ ] RNG tests green; determinism test included
- [ ] Fixtures typecheck against T02 types exactly
- [ ] `demoResult` placements match the table above verbatim

## Wrap up

TASKS.md → done, worklog entry, commits `T03:`. Ping Tracks B & C that fixtures are on `main`.
