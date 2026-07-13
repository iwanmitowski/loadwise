# Worklog — Daniel Dimitrov

## [2026-07-14 00:30] T10 — Scenario Setup & Planning screens
- Dev: daniel-dimitrov · Model: Fable 5 · Branch: feat/T10-setup-planning-screens
- Done: real Setup screen (3 vehicle cards with proportional SVG side-view schematics, side-door radio group with top-view diagrams, shop-count slider 3–8, seed field + randomize + helper text, disabled "Load demo" placeholder) and Planning View (header with vehicle summary + copyable seed badge, shop cards in delivery order with color dot / type badge / stop number / door chip / template × count chips / per-shop weight+volume, totals bar with weight & volume capacity bars that go amber past 100%, Optimize with progress bar + Cancel, inline error alert with Retry, Regenerate and Back). Added `src/utils/format.ts` + RTL tests for both screens; 160 tests green.
- Files: src/utils/format.ts(+test), src/components/setup/{VehiclePicker,SideDoorPicker,ShopCountField,SeedField}.tsx, src/components/planning/{ShopCard,TotalsBar,SeedBadge}.tsx, src/components/planning/totals.ts, src/components/screens/ScreenSetup.tsx(+test), src/components/screens/ScreenPlanning.tsx(+test), src/App.test.tsx, docs/TASKS.md, docs/prompts/T10-setup-and-planning-screens.md
- Decisions/deviations:
  - format.ts grew `fmtM3(cm3)` and `fmtDims(dims)` beyond the three helpers the prompt named — needed for volume totals and W×H×D lines; prompt file updated to stay truthful. T16 can reuse all five.
  - Auto-advance to Simulation happens only for runs *started from Planning* (local `awaitingRun` flag watching store status) — revisiting Planning with an existing result must not bounce the user back to Simulation.
  - Regenerate = `randomizeSeed() → generate() → goTo('planning')`: `generate()` intentionally resets the UI to setup (new-scenario semantics from T09), so Planning re-navigates onto itself.
  - Planning with no scenario renders an empty state that still contains a disabled Optimize button (the prompt's test spec requires "optimize disabled when no scenario", not a hidden one).
  - Touched T09's `src/App.test.tsx` (Track C, same track): the shell happy path changed because Generate now navigates straight to Planning and a finished run auto-advances to Simulation.
  - Seed copy uses `navigator.clipboard?.writeText` with silent fallback — jsdom/insecure contexts have no clipboard, and the seed is visible on the badge anyway.
- Follow-ups: T11 should set `progress.percent`/`stage` for a real progress bar (UI already binds both) and populate `error` (alert + Retry are wired but only reachable via store state today). T17 activates the "Load demo" placeholder button on Setup.
