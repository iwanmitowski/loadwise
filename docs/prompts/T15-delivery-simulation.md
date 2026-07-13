# T15 — Delivery simulation

Track B · Depends: T13 (+ T06's `findBlockers` once merged) · Branch: `feat/T15-delivery-simulation` · **Start Claude in plan mode.**

## Context

Read `idea.md` §Delivery Simulation. Simulate the delivery route stop by stop: open the door, highlight the stop's cargo, move blockers aside, remove delivered cargo, advance. Reuses the timeline approach from T14.

## Decisions already made

- **Stop sequence** from `trip.stops` (already delivery-ordered). Mode `delivery` in `uiStore.playback`; `index` = current stop (0-based); manual advance via "Next stop" button + optional "Auto-play" toggle that advances automatically after each stop's animation completes. "Restart route" resets to stop 0 with all cargo restored.
- **Unload order within a stop**: stop's items sorted by distance to their door, closest first (derived at runtime — matches idea.md's separate unloading order).
- **Blockers**: `findBlockers(item, door, othersStillLoaded)` from `src/features/optimizer/accessibility.ts` (T06), filtered to items delivered at LATER stops. If T06 isn't merged when you start, code against the signature with a local stub returning `[]` and a `TODO(T06)` — swap on merge.
- **Per-stop choreography** (each phase ~0.6s at 1× — reuse T14's ref-driven timeline pattern):
  1. Door opens (assigned door of this stop), camera gently pans toward that door (optional, only if trivial with controls target lerp).
  2. Stop's cargo pulses in shop color; HUD shows stop card.
  3. Blockers (if any) flash amber and slide out through the door to a staging row outside, one by one.
  4. Delivered items slide out through the door and fade/shrink away, in unload order.
  5. Blockers slide back to their original positions (they stay in the truck).
  6. Door closes; advance.
- **HUD** (`src/components/simulation/DeliveryPanel.tsx`): current shop (name, color, stop x/y), assigned door, units being unloaded, blocking cargo count ("2 items moved temporarily"), running total of extra moves, remaining stops list. Numbers must visibly match the report's `extraUnloadingMoves` (both derive from `findBlockers` — same source of truth).
- Trips are simulated independently; switching trip resets the route. Entering delivery mode restores all of the trip's cargo (undo any prior partial route).
- Scope guard (cut ladder #3): if time pressure hits, blocker slide-out/return animation degrades to highlight + counter only — keep the HUD numbers correct either way.

## Implementation shape

`src/three/Animations/useDeliveryTimeline.ts` — per-stop phase machine built on the same `transformAt`-style pure helpers (unit-test phase math: given stop items + blockers, the ordered op list `[{type: 'move-blocker-out', id}, {type: 'deliver', id}, ...]` is correct and deterministic). `src/three/Animations/DeliveryAnimator.tsx` executes it.

## Acceptance criteria

- [ ] Demo fixture route plays all 3 stops: door opens, correct color group leaves, truck is empty at the end
- [ ] A constructed blocking case (add fixture variant where a later-stop item sits in front of an earlier-stop item) shows the blocker moving out and back, counter incrementing
- [ ] Restart route restores everything; switching trips mid-route doesn't wedge
- [ ] Op-list unit tests green; typecheck/lint/test green

## Wrap up

TASKS.md, worklog, commits `T15:`.
