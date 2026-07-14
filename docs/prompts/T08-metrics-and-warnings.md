# T08 — Metrics, warnings, report data

Track A · Depends: T07 (integrates into it) · Branch: `feat/T08-metrics-warnings`

## Context

Read `idea.md` §Optimization Report (formulas + example) and §Placement Scoring. Pure calculation layer in `src/features/reports/` — turns placements into `OptimizationMetrics`, warnings, and the overall score. Every number the UI shows comes from here; deterministic, div-by-zero-proof.

## Contracts

```ts
// src/features/reports/metrics.ts
export function buildTripMetrics(trip: { placements: CargoPlacement[]; deferredCargo: UnplacedCargo[]; stops: DeliveryStop[] }, scenario: Scenario, requestedUnitsForTrip: number, config: OptimizerConfig): OptimizationMetrics;

// src/features/reports/warnings.ts
export function buildWarnings(result: OptimizationResult, scenario: Scenario): OptimizationWarning[];

// src/features/reports/score.ts
export function overallScore(metrics: OptimizationMetrics[], unplaceable: UnplacedCargo[]): number; // 0..100 clamped
```

## Formulas (from idea.md, with guards — decisions already made)

- `volumeUtilization = loadedVolume / vehicleVolume`; `weightUtilization = loadedWeight / maxPayload`.
- `leftRightBalance = totalWeight === 0 ? 1 : 1 − |leftW − rightW| / totalWeight`. Weight split by the x-midplane **proportionally**: an item spanning the midplane contributes each side its overlapping width fraction × weight. Same for `frontRearBalance` with the z-midplane (rear half = z < depth/2).
- `blockedCargoCount`: for each placed item, blockers = `findBlockers(...)` (T06) filtered to items delivered at a **later stop** (same-stop items don't block each other). Count items with ≥ 1 blocker.
- `extraUnloadingMoves`: per stop, the set of distinct blocking items (delivered later, blocking any of this stop's items); sum of set sizes across stops.
- `accessibilityScore = loadedCount === 0 ? 0 : 1 − blockedCount / loadedCount` (used in overall score, not stored).
- Overall score (per trip, then result = mean over trips, minus penalty): weighted sum with `SCORE_WEIGHTS` from T02 config — volume 25 + weight 15 + balance 20 (mean of LR/FR) + accessibility 25 + delivery 15 (delivery component = 1 − splitShops/stops, floor 0). Result-level: subtract 5 per permanently unplaceable item (floor 0). Clamp 0–100, round to integer.
- `constraintViolations = validateLoad(trip.placements, scenario, config).length` (T05) — a final self-check per trip. Normally 0; anything else means an optimizer bug and must surface in the report, not be hidden.
- Zero-cargo trip (possible if T07 emits an empty trip): all ratios 0, balances 1, score 0, plus `empty-trip` warning.

## Warnings (exact trigger list)

| code | trigger | message template |
|---|---|---|
| weight-limited | trip weightUtil ≥ 0.9 and volumeUtil < 0.7 | "Trip N reached weight capacity before volume capacity." |
| volume-limited | volumeUtil ≥ 0.9 and weightUtil < 0.7 | "Trip N reached volume capacity before weight capacity." |
| imbalance | LR balance < 0.85, or FR balance below an asymmetric threshold: 0.9 when rear-heavy, 0.75 when front-heavy (post-T13 stability work — rear bias unloads the steering axle). Rear-heavy + weightUtil < 0.5 appends a steering-axle note. | "The right side is 12% heavier than the left." (compute side + %) |
| shop-split | splitShopIds non-empty | "Order for {shop} was split between trips N and M." |
| deferred-cargo | trip has deferredCargo | "{n} item(s) moved to trip N+1." |
| unplaceable-cargo | permanent unplaceables exist | "{n} item(s) cannot be loaded: {reason summary}." |
| blocked-cargo | blockedCargoCount > 0 | "{n} item(s) require moving other cargo when unloading." |
| unsecured-cargo | items with no forward blocking chain to the front wall (optimizer `bracing.ts`; added post-T13, code added to WarningCode) | "{n} item(s) have no forward blocking against braking — secure with lashings." |
| empty-trip | trip with 0 placements | "Trip N is empty." |
| time-limit | passed through from T07 | "Optimization stopped at the time limit; result may be partial." |

Messages are user-facing: plain language, name shops by name not id.

## Integration

Wire into T07's `optimize()` so `OptimizationResult` ships fully populated (replace its placeholders). Also export `buildReportModel(result, scenario)` assembling everything the report screen (T16) needs per trip — including resolved shop names/colors order — so the UI does zero math.

## Tests

Hand-computed fixture: build a tiny trip (3–4 placements with known numbers) and assert every metric exactly. Guards: zero weight, zero items, single item spanning midplane. Warning triggers: one test per code. T03's demo fixture: metrics computed ≈ hard-coded ones (replace fixture's approximations with computed values in this PR).

## Out of scope

No UI rendering (T16). No new placement logic.

## Wrap up

TASKS.md, worklog, commits `T08:`.
