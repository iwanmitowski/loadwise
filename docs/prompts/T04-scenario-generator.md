# T04 — Scenario generator

Track A · Depends: T02, T03 · Branch: `feat/T04-scenario-generator`

## Context

Read `CLAUDE.md` §Domain conventions and `idea.md` §Shop and Order Generation, §Functional Requirements/Scenario generation. Pure functions in `src/features/scenario/`. All randomness through the `Rng` passed in — the same `ScenarioConfig` must always produce the identical `Scenario` (deep-equal).

## Contract

```ts
// src/features/scenario/generate.ts
export function generateScenario(config: ScenarioConfig): Scenario;
```

Internally: `createRng(config.seed)`, one RNG instance threaded through everything, fixed call order (any reordering changes results — keep generation single-pass and document the order).

## Decisions already made

- `shopCount` clamped to 3–8 (clamp silently; UI enforces too).
- Shop IDs `shop-1..n` in generation order; `deliveryOrder` = seeded shuffle of `1..n`.
- Shop type: uniform pick. Shop name: seeded pick from per-type name pools (prefix + suffix, e.g. supermarket: Fresh/Metro/Daily/Family/Green × Market/Foods/Grocers; beverage: Hop/Vine/Barrel/Spring × Cellar/Drinks/Beverages; electronics: Volt/Pixel/Nova/Circuit × Hub/Electronics/Tech; general: Corner/Central/Oak/Main × Store/Goods/Trading; warehouse: North/Prime/Cargo/East × Depot/Warehouse/Logistics). Deduplicate by appending " 2", " 3"….
- `preferredDoor`: if `config.sideDoor === 'none'` → `rear`; else the side door with probability 0.4, otherwise `rear`.
- Cargo quantity + mix per shop type (weights are template pick probabilities; quantity range inclusive):

| Shop type | qty | standard-pallet | beverage-pallet | beverage-stack | large-box | medium-box | fragile-box |
|---|---|---|---|---|---|---|---|
| supermarket | 4–10 | .25 | .15 | .15 | .15 | .25 | .05 |
| beverage-store | 3–8 | .05 | .40 | .40 | 0 | .15 | 0 |
| electronics-store | 2–6 | .05 | 0 | 0 | .30 | .25 | .40 |
| general-store | 2–8 | .15 | 0 | .15 | .25 | .35 | .10 |
| warehouse | 6–14 | .40 | .10 | 0 | .30 | .20 | 0 |

  Put this table in `src/features/scenario/profiles.ts` as data.
- Edge case by design: with probability 0.05 a shop's quantity is 0 (`requestedCargo: []`) — downstream must handle it (idea.md edge case "Shop requests zero cargo").
- Cargo IDs `${shopId}-c${k}`, k starting at 1.
- Vehicle: `buildScenarioVehicle(config.vehicleId, config.sideDoor)` from T02.

## Tests (Vitest)

- Same config twice ⇒ deep-equal scenarios (multiple seeds).
- Different seeds ⇒ different scenarios (allow rare collisions by testing 3 seeds).
- shopCount respected + clamping; deliveryOrder is a permutation of 1..n.
- Weighted mix sanity: for a beverage store over many seeds, beverage templates dominate (statistical, loose bounds).
- Zero-cargo shop occurs across ~200 seeds.

## Out of scope

No UI, no placement, no trips. Do not filter out cargo that won't fit the vehicle — that's the optimizer's job to detect and report (T07).

## Acceptance criteria

- [ ] `generateScenario` pure & deterministic (test-proven)
- [ ] Profile table encoded as data, not branching logic
- [ ] typecheck/lint/test green

## Wrap up

TASKS.md, worklog, commits `T04:`.
