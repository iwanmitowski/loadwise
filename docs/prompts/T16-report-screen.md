# T16 — Report screen, trip selector, shop legend

Track C · Depends: T09 (build vs fixture) → T08 (`buildReportModel`, re-wire on merge) · Branch: `feat/T16-report-screen`

## Context

Read `idea.md` §Optimization Report (display list + example) and §Required Screens. Pure presentation — every number comes from T08's `buildReportModel(result, scenario)`; the UI does **zero math**. Also builds two shared components used on the Simulation screen: trip selector and shop legend.

## Shared components (`src/components/simulation/`)

- **TripSelector**: tabs "Trip 1 / Trip 2 / …" bound to `uiStore.selectedTripId`; each tab shows a micro-summary (stops count, units, weight%). Rendered on both Simulation and Report screens.
- **ShopLegend**: color dot + shop name + stop number per shop in the selected trip; click = toggle `uiStore.shopFilter` (dims 3D cargo per T13); "clear filter" affordance. Shops with deferred/unplaced items get a small ⚠ badge.

## Report screen (`src/components/report/`)

- **Overall header**: big overall score badge (0–100, color-graded red→amber→green), vehicle name, trips count, seed badge (copyable), `elapsedMs`, and Export buttons: "Scenario JSON" + "Result JSON" (`downloadJson` from T03).
- **Per-trip sections** (or selected-trip view with the TripSelector — pick one, selected-trip view recommended for consistency): metric grid of labeled stat cards: shops served, requested / loaded / deferred units, total weight, weight utilization, used volume, volume utilization, empty volume, left/right balance, front/rear balance, blocked cargo, extra unloading moves, split shop orders, constraint violations (normally 0 — render in red when > 0), trip score. Utilizations & balances as percent bars, not just numbers.
- **Warnings panel**: T08 warnings as list items with severity icon (amber = info-ish: deferred, split; red: unplaceable, empty-trip, time-limit), plain-language text as provided.
- **Deferred cargo table**: item (template name), shop, reason, destination trip ("→ Trip 2" — derive by finding the item's placement trip; if none, "not placed").
- **Unplaceable cargo table** (permanent): item, shop, reason chip per `UnplacedReason`, detail text. Empty state: "All cargo was placed." with a ✓.
- Numbers formatted with `fmtM/fmtKg/fmtPct` (T10). Handle `result === null` (screen gated anyway) and empty-trip metrics without NaN — T08 guarantees the math, you guarantee no "NaN%" ever renders (fallback dash).

## Fixture-first

Build against `demoResult` immediately; when T08's `buildReportModel` merges, swap the data source (should be a one-line change if you type against the model). If T08 defines the model slightly differently than you guessed, **adopt T08's shape** — it owns the contract; note the adjustment in your worklog.

## Tests

RTL: renders all metric labels from idea.md's display list; warnings render; deferred table shows destination trip; export buttons call downloadJson (mock).

## Out of scope

Metric math (T08), 3D, demo-mode wiring (T17).

## Acceptance criteria

- [ ] Report matches idea.md's display list item-for-item (checklist them in the PR description)
- [ ] TripSelector + ShopLegend work on the Simulation screen too
- [ ] Export produces valid JSON files that re-import cleanly in devtools (`JSON.parse` sanity)
- [ ] typecheck/lint/test green

## Wrap up

TASKS.md, worklog, commits `T16:`.
