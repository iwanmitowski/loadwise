# Worklog — ivan-mitovski

## [2026-07-13 21:56] T01 — Scaffold, tooling, CI, Vercel deploy
- Dev: ivan-mitovski · Model: Opus 4.8 (1M) · Branch: feat/T01-scaffold
- Done: scaffolded Vite + React 19 + TS (strict) app; installed three/@react-three/fiber/@react-three/drei/zustand + Tailwind v4 (Vite plugin), Vitest, Testing Library, jsdom, Prettier, ESLint stack; created the full `src/` folder skeleton (`.gitkeep` per dir); placeholder LoadWise page with an R3F `<Canvas>` spinning box; wired scripts (dev/build/preview/test/test:watch/typecheck/lint/format), ESLint flat config with the determinism guard, Vitest (node default env + jsdom opt-in) with one passing smoke test, GitHub Actions CI, `.gitignore` (+ `CLAUDE.local.md`, `.vercel`) and README stub. All gates green locally; determinism ban verified (temp `Math.random()` in `src/utils` → lint error, then removed); dev server serves 200 + module transform.
- Files: package.json, package-lock.json, vite.config.ts, tsconfig.app.json, index.html, eslint.config.js, .prettierrc.json, .prettierignore, .gitignore, .github/workflows/ci.yml, src/App.tsx, src/main.tsx, src/index.css, src/test/setup.ts, src/smoke.test.ts, src/**/.gitkeep, README.md, docs/TASKS.md
- Decisions/deviations:
  - **Node was not installed on this machine.** Installed Node.js LTS (v24.18.0) via `winget` (user scope, portable) to unblock the task. Repo requires Node ≥ 20 — satisfied.
  - **Linter: ESLint flat config, not the scaffolder default.** Current `create-vite` now ships **oxlint** (no ESLint). The prompt (req #5) mandates an ESLint per-path `no-restricted-properties` determinism guard, so I removed oxlint and set up the standard Vite ESLint flat-config stack (`eslint` + `typescript-eslint` + `react-hooks` + `react-refresh`). This matches CLAUDE.md ("ESLint enforces this").
  - **react-hooks config:** eslint-plugin-react-hooks v7's `recommended-latest` preset uses the legacy array-`plugins` format (rejected by ESLint 10) and enables very aggressive React-Compiler rules. Registered the plugin directly and enabled just `rules-of-hooks` (error) + `exhaustive-deps` (warn) — the classic Vite-template behaviour.
  - **tsconfig:** scaffold omitted `strict` — added it. TS 6.0 deprecates `baseUrl`, so the `@/` path alias uses `paths` only (resolves relative to tsconfig). `typecheck` uses `tsc -b --noEmit` (solution-style root tsconfig needs `-b` to typecheck referenced projects).
  - Dropped Vite demo assets (logos/hero/App.css); replaced favicon with an inline emoji data-URI.
- Follow-ups:
  - **Vercel deploy is not done** — it requires connecting the GitHub repo in the Vercel dashboard (framework preset: Vite), which needs the owner's authenticated account. README has a `_TBD_` live-URL placeholder to fill in once connected. Acceptance criteria "public Vercel URL" + "CI green on the PR" remain owner-actioned.
  - Production bundle is ~1 MB (three.js) → Vite chunk-size warning only. Fine for MVP; revisit code-splitting in T20 polish if needed.
  - Node was installed only to the user PATH (winget) — a fresh shell picks it up; this session prepends it manually.

## [2026-07-13 22:07] T02 — Domain types, vehicle & cargo catalog, config
- Dev: ivan-mitovski · Model: Opus 4.8 (1M) · Branch: feat/T02-domain-types
- Done: created the full `src/types/` contract (geometry, vehicle, cargo, shop, scenario, optimization, worker) with barrel re-export; encoded the three vehicles and six cargo templates exactly per the T02 tables; added `getVehicle`/`buildScenarioVehicle` (door filtering) and `getTemplate`/`itemDimensions`/`itemVolume` helpers; `DEFAULT_OPTIMIZER_CONFIG` + `SCORE_WEIGHTS`. 11 unit tests (rotation swap, volume, template flags, door centring/positioning, side-door filtering). typecheck + lint + test all green; no runtime deps added.
- Files: src/types/{geometry,vehicle,cargo,shop,scenario,optimization,worker,index}.ts, src/features/vehicles/vehicles.ts, src/features/vehicles/vehicles.test.ts, src/features/cargo/templates.ts, src/features/cargo/templates.test.ts, src/features/optimizer/config.ts, docs/TASKS.md
- Decisions/deviations:
  - `index.ts` uses `export type *` (verbatimModuleSyntax is on — value-style re-export of type-only modules would error).
  - Door geometry computed from a private `VehicleSpec` table: rear door min-corner `x = (width - doorWidth)/2, y=0, z=0`; side doors on the x=0 (left) / x=width (right) wall, `width` along Z, min-corner z from the table, y=0. `getVehicle` exposes all three candidate doors; `buildScenarioVehicle` keeps rear + chosen side (or none). Documented the axis convention on `VehicleDoor`.
  - Added small convenience exports not named in the prompt: `VEHICLE_IDS`, `CARGO_CATEGORIES` (stable ordered lists for UI/generation later). No logic, no scope creep.
- Follow-ups:
  - Types are the shared contract — after merge, announce "types are locked" to the team. Any later change to `src/types/` needs a `[TYPES CHANGE]` PR title + team ping.
  - PR requires review by both other developers before merge (T02 acceptance criterion).

## [2026-07-13 22:14] T03 — Seeded RNG + demo fixtures
- Dev: ivan-mitovski · Model: Opus 4.8 (1M) · Branch: feat/T03-rng-fixtures
- Done: implemented `createRng` (xmur3 hash → mulberry32 PRNG) exposing `next/int/pick/shuffle/chance`, all deterministic per seed, no `Math.random`; added `downloadJson` browser util (DOM-exempt, noted in file); hand-authored `demoScenario` + `demoResult` fixtures for the box-truck with the 9-placement layout verbatim from the prompt table + 1 deferred beverage pallet. 17 new tests (RNG determinism/bounds/permutation + fixture structure). typecheck + lint + test all green (28 total).
- Files: src/utils/rng.ts, src/utils/rng.test.ts, src/utils/download.ts, src/fixtures/demo.ts, src/fixtures/demo.test.ts, docs/TASKS.md
- Decisions/deviations:
  - Fixture metrics: `totalWeightKg` (1482), utilizations, used/empty volume computed by hand from the layout and matched the prompt's targets (weightUtil ≈ 0.296 → hard-coded 0.30; volUtil ≈ 0.153 → 0.15). Balance figures (`leftRightBalance` 0.62, `frontRearBalance` 0.71) are plausible hand-picked placeholders — T08 owns their real semantics; per the prompt these are "fill in the rest plausibly" fields.
  - `elapsedMs: 0` — this is authored data, not a timed optimizer run; no `Date.now()` (determinism rule).
  - `demoScenario.vehicle` is built via `buildScenarioVehicle('box-truck','none')` (rear door only) rather than a re-hand-authored door array, so it stays consistent with the vehicle catalog.
  - `demo.test.ts` carries a `TODO(T05)` marker for the future `validateLoad` assertion, as the prompt requires.
- Follow-ups:
  - Once T05 lands, wire the `validateLoad(demoScenario, ...)` assertion in `demo.test.ts` (currently a commented TODO).
  - Tracks B & C: fixtures (`@/fixtures/demo`) are ready — ping them once this is on `main`.

## [2026-07-13 22:22] T04 — Scenario generator
- Dev: ivan-mitovski · Model: Opus 4.8 (1M) · Branch: feat/T04-scenario-generator
- Done: implemented pure/deterministic `generateScenario` in `src/features/scenario/generate.ts` — one `createRng(seed)` threaded through a documented single-pass call order (shuffle delivery orders → per shop: type, name, door, cargo). Encoded the quantity+mix table, name pools, clamp bounds, and the side-door/zero-cargo probabilities as data in `profiles.ts` (no per-type branching in the generator). 14 new tests (deep-equal determinism across seeds incl. empty/unicode, seed variance, shopCount respected + clamped to 3–8, deliveryOrder permutation, side-door preference distribution, deterministic cargo IDs, beverage-mix dominance over ~400 seeds, zero-cargo shop within 200 seeds). typecheck + lint + test all green (52 total).
- Files: src/features/scenario/generate.ts, src/features/scenario/profiles.ts, src/features/scenario/generate.test.ts, docs/TASKS.md
- Decisions/deviations:
  - Cargo mix encoded with **zero-weight templates omitted** from each type's `mix[]` (a 0 weight is never picked, so listing it would be dead data). Weights within a mix sum to 1; `weightedPick` samples `rng.next()` in `[0,1)` with a last-entry fallback for the float-rounding edge.
  - Generation call order is load-bearing and documented in the `generateScenario` JSDoc: delivery-order shuffle first (top of stream), then per-shop type → name → door → cargo. Zero-cargo roll happens before the quantity roll and short-circuits it, so no `int()` is consumed for empty shops.
  - `pickDoor` returns the *config's* chosen side (`left`/`right`) with prob 0.4 else `rear`; `none` → always `rear`. Verified in a distribution test (never emits the opposite side).
- Follow-ups:
  - None. Generator is self-contained; T06 placement heuristic will consume `Scenario.shops[].requestedCargo`.

## [2026-07-13 22:40] T05 — Geometry & constraint validation core
- Dev: ivan-mitovski · Model: Opus 4.8 (1M) · Branch: feat/T05-validation-core
- Done: implemented the pure geometry/constraint core in `src/features/optimizer/` — `geometry.ts` (`PlacedBox`, `toPlacedBox`, `boxesOverlap`, `insideVehicle`, `footprintOverlapArea`, `fitsThroughDoor` + `boxTop`/`baseArea` helpers), `support.ts` (`computeSupport`, `directLoadOnSupporter` with proportional weight attribution), `validate.ts` (`ConstraintViolation`, `validateCandidate` hot path, `validateLoad` full re-check). All 8 rules enforced + tested both directions; wired the T03 fixture `validateLoad` assertion in `demo.test.ts` (replaced the TODO marker). 44 new tests. typecheck + lint + test all green (72 total).
- Files: src/features/optimizer/{geometry,support,validate}.ts, src/features/optimizer/{geometry,support,validate}.test.ts, src/fixtures/demo.test.ts, docs/TASKS.md
- Decisions/deviations:
  - **Duplicate cargoId → reported under `'overlap'`.** The contract's `ConstraintViolation.code` union (fixed by the prompt) has no dedicated duplicate code, and adding one is a `src/types`-adjacent contract change I avoided. `validateLoad` detects a cargoId placed twice and emits an `overlap` violation with an explicit `"placed more than once"` detail. Faithful to "catches duplicate cargoIds" without touching the type union.
  - **Rule 7 weight attribution:** a resting box's weight is split across its supporters proportional to each contact area, normalized by the box's *total* contact area (so full weight is conserved across supporters, not diluted by base area). Matches "proportional to contact area" and gives the expected 50/50 on two equal supporters. Direct load only — no transitive propagation.
  - **`computeSupport` supporters** are boxes with top face flush at `box.min.y` **and** non-zero footprint overlap (a same-height neighbour with no overlap isn't a supporter). Consistent with the ratio sum and the weight/stackable checks.
  - **`validateCandidate` returns all violations** (no short-circuit) but orders checks cheapest-first (bounds → overlap → payload → support chain); callers use `.length === 0`. Door-fit is deliberately excluded from the hot path (rule 8) and only checked in `validateLoad` as the self-check against a bad T06/T07 door assignment.
  - Support-ratio uses exact float division vs `config.supportThreshold` (no epsilon, per "exact comparisons"); the 70%/69% test constructs integer areas so the boundary is exact.
  - Test note: rule-7 uses a synthetic `weightKg` on a `PlacedBox` literal to isolate supporter-overweight — the real cargo templates can't overload a supporter with a single fully-supported candidate (heavy items all have large footprints), so a unit-level construction is the clean way to exercise the check.
- Follow-ups:
  - T06/T07 own door assignment; `validateLoad` rule 8 will flag any placement whose `assignedDoor` can't pass its opening in either rotation.
  - Unknown cargoIds in a placement list (not requested by any shop in the scenario) are silently skipped by `validateLoad` — acceptable for MVP; revisit if T18 needs it surfaced.

## [2026-07-13 22:52] T06 — Placement heuristic (single trip)
- Dev: ivan-mitovski · Model: Opus 4.8 (1M) · Branch: feat/T06-placement-heuristic
- Done: implemented the core greedy best-fit placer `planSingleTrip` in `src/features/optimizer/placeTrip.ts` (door assignment → reverse-delivery insertion order → extreme-point candidates with wall-flush variants → both orientations → T05 `validateCandidate` on every candidate → 6-component weighted score → best-of selection with tiebreaks → per-item unplaced classification) plus the `findBlockers` geometry helper in `accessibility.ts` for T08/T15. Pure, no RNG, no React/Three. 12 new tests (everything-fits + validateLoad-clean, rear-door depth ordering, side-door routing + z-band, floor-only/fragile temptation cases, determinism deep-equal, exceeds-payload, exceeds-vehicle-dimensions, findBlockers per door, perf smoke). typecheck + lint + test all green (84 total).
- Files: src/features/optimizer/placeTrip.ts, src/features/optimizer/accessibility.ts, src/features/optimizer/{placeTrip,accessibility}.test.ts, docs/TASKS.md
- Decisions/deviations:
  - **`idealZ` term — resolved a self-contradiction in the prompt.** Rule 6 names the variable `stopsAfterThisShop` but its parenthetical ("later deliveries → deeper ideal band") and rule 2 ("last stop ends up deepest") require the opposite of what that name yields. Implemented the stated *intent*: `idealZ = depth × (deliveryRank + 0.5) / stopCount` where `deliveryRank` is the 0-based ascending delivery position (rank 0 = first stop, shallow near the rear door; last stop → deepest). Verified by the rear-door ordering test.
  - **Candidate points = classic extreme points only** ((x+w,y,z),(x,y,z+d),(x,y+h,z)), seeded from (0,0,0). Per-item, each stored point is expanded into base + three wall-flush variants (max-z→cabin, min-x→left wall, min-x→right wall); overlaps/out-of-bounds are dropped by `validateCandidate`, not pre-checked beyond a cheap `insideVehicle` guard. Points strictly inside a placed box are pruned after each placement.
  - **Deterministic candidate eviction order** documented in `updateCandidatePoints`: dedupe → drop interior points → sort by (y asc, z desc, x asc) → keep first `candidatePointCap` (600). Same sorted order drives evaluation, so results are stable.
  - **`weightBalance` uses projected mass**, not center-of-box bucketing: each box's weight is split across the vehicle's X midline in proportion to how much of its width lies on each side ("projected left/right delta"). Computed incrementally via running `projLeft`/`projRight`.
  - **`compactness`** counts the three min/max faces the prompt names — x-min, y-min, z-max(cabin) — touching a wall or a flush neighbour, in thirds.
  - **Unplaced classification order** exactly per rule 8: exceeds-vehicle-dimensions (fails empty-vehicle bounds in both rotations) → exceeds-payload (item weight alone > payload) → exceeds-payload (remaining payload insufficient, detail "payload remaining") → stacking-constraint (only support-chain violation codes seen: insufficient-support/floor-only-violated/unstackable-support/support-overweight) → no-valid-placement. `TripPlanOutput.unplaced` omits `permanent` (T07 wraps into `UnplacedCargo`).
  - **`findBlockers(target, targetDoor, others)`** returns cargoIds sorted asc. Rear: blocker `min.z < target.min.z` with X&Y overlap; left: `min.x < target.min.x` with Z&Y overlap; right mirrored (`min.x > target.min.x`). Pure geometry; "delivered later" filtering left to the caller.
  - **Oversized/overweight tests use hand-built `VehicleDefinition`s** (tiny cargo space / 100 kg payload). With the real catalog every template fits every vehicle's dimensions and no single template exceeds any vehicle's payload, so those two `classifyUnplaced` branches are otherwise unreachable from real data.
  - **Perf smoke test is non-CI-gating**: it asserts only that every item is accounted for exactly once and logs elapsed time (no hard time bound, so slow runners can't flake it). Observed 100 mixed items in ~173 ms locally (target ≤ ~3 s).
- Follow-ups:
  - T07 (multi-trip) consumes `planSingleTrip`, assigns `tripId`/`loadingOrder` globally if needed, and owns the `accessibility-constraint` / `trip-limit-reached` unplaced reasons + the improvement pass (explicitly out of scope here).
  - Side-door clustering is limited by extreme-point reachability: a door's mid-depth z-band is only populated once boxes chain into it, so few-item side-door loads still sit at the rear/cabin walls. Acceptable for MVP; a door-flush candidate seed could tighten it if T18 wants it.
