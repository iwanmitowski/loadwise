# T21 — Axle-load physics + door-true animation paths

Track A+B · Depends: T07, T14 · Branch: `feat/T21-axle-physics`

## Context

Owner-directed post-MVP hardening driven by [docs/deep-research-cargo-loading.md](../deep-research-cargo-loading.md) and [docs/physics.md](../physics.md). Two deliverables: (1) replace the geometric CoG proxy with a real (planning-estimate) axle-load model — beam statics for rigid vehicles, kingpin/axle-group for the semi — with hard rejection at plated maxima and per-stop recalculation; (2) make the loading/delivery animations route cargo through the door openings instead of clipping walls.

Key doc mandates implemented: "Do not assume that cargo should always be placed near the cab — determine the correct position from axle limits"; "Hard rejection when an axle or gross-weight limit is exceeded"; "Recalculation of axle loads after every delivery stop"; "Detection of configurations that are initially legal but become unsafe after partial unloading"; securing-force estimates per EN 12195-1 (0.8g/0.5g, μ); "Clear separation between estimated generic calculations and manufacturer data" (everything is labelled *planning estimate* — the fleet's axle geometry is invented-but-plausible).

## Deliverables (as built)

- **[TYPES CHANGE]** `VehicleDefinition.axles?: AxleModel` (`rigid` beam / `semi` kingpin models) — additive optional field; axle-less vehicles (all test literals) keep the previous behavior everywhere.
- `features/optimizer/axles.ts` — `supportLoads` (superposed per-item contributions; negative contributions model rear-overhang levering), `overloadBreaches`, `underloadBreach` (steer/kingpin min share), `axleScore`. Unit-tested against the research doc's worked examples (5.6t/5.4t rigid; 6.17t/3.83t semi).
- `validate.ts`: `axle-overload` violation — hard reject at candidate time (sound for maxima: additions superpose monotonically) and in `validateLoad`. Min-share is deliberately NOT a violation (its ratio moves both ways mid-pack) — it is warned on drive states.
- `placeTrip.ts`: when axle data exists the longitudinal stability term becomes `axleScore` (envelope margin × steer-share guard) — the CoG target now follows the plated limits instead of "as far forward as possible". Front-pack contiguity (band boundary) unchanged.
- `optimize.ts`: anti-split defer is abandoned when its removals breach an axle max (removals are NOT monotonic — dropping a rear-overhang box raises the front axle; found live on box-truck seed-34/5shops).
- `warnings.ts`: `axle-limit` (departure breach), `unsafe-after-stop` (axle maxima + min share + lateral re-checked after every stop; lateral gated to ≥25% payload remaining), securing-force estimate in the unsecured-cargo message (`(0.8−μ)·m·g` daN at μ≈0.3), lateral warn threshold 0.85→0.90 (doc: red at 10% side difference).
- `features/optimizer/reachability.ts` — the shared **loading-corridor planner** (owner escalation: replayed flights passed through placed cargo, and some placements were unreachable through the door entirely). Routes are forklift L-chains (cross the door frame low → drive the lane → turn in the free strip → lift → push) or crane chains (rise in the doorway → travel above the corridor → drop), entry swept across the opening, all verified by swept-AABB tests against placed cargo. Used by BOTH sides: `placeTrip` rejects candidates with no clear route (ranked walk, cap 200, then defer `accessibility-constraint`) — so the insertion sequence = `loadingOrder` is **physically executable by construction** — and the animation replays the same routes (`buildItemPath` delegates; `DeliveryAnimator` runs them reversed with sequence-aware obstacle sets). Side-door scoring gained far-side-first so early boxes don't wall off their own opening. Cost: 2.28→2.55 trips/scenario (+12%) — unreachable slots defer instead of teleporting; placed totals unchanged.

## Acceptance criteria

- [x] Doc worked examples reproduced exactly by `axles.ts` unit tests
- [x] Axle scan (240 scenarios, 1,170 departure+post-stop states): **0** axle-overload states, **0** underload states
- [x] Flight scan (300 configs, **6,956 dense-sampled flights**): **0** interpenetrations of placed cargo; every wall-plane crossing inside the door frame
- [x] Visual browser verification via the project `verify` skill (Playwright, frozen mid-flight frames): movers carried low in free lanes beside placed cargo
- [x] typecheck / lint / 333 tests / build green

## Out of scope (follow-ups)

Tractor-side kingpin redistribution (stage-2 semi model); manufacturer load-distribution chart ingestion; CoG-height/tipping proxy; report-screen UI rows for axle numbers (Track C); anti-slip-mat μ toggle.
