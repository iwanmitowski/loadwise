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
