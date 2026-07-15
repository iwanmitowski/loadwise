# T23 — Side-door unload blockers respect the door opening

Track A · Depends: T08, T15, T21 · Branch: `feat/T23-side-door-unload-blockers`

## Context

Owner-reported defect from a demo run (`loadwise-result-demo-1.json`): the report says
"2 item(s) require moving other cargo when unloading" (`blockedCargoCount: 2`,
`extraUnloadingMoves: 3`) but in the 3D view the move looks unnecessary.

Root cause (traced in [accessibility.ts](../../src/features/optimizer/accessibility.ts)):
`findBlockers` models a **side-door** exit as a straight sideways slide along the
whole wall (`b.min.x < target.min.x` + Z/Y overlap). It never looks at the door's
actual opening span (`door.position.z … door.position.z + door.width`). For the
box-truck left door the opening is `z∈[210,410]`, but the two flagged items —
Fresh Foods `shop-6-c1`/`shop-6-c2` (small boxes at `z≈480–540`) — sit **behind**
the opening. A real exit drives them along the corridor to the opening and out;
they never pass the later-delivered Nova Electronics (`shop-2`) cargo to their
left. The naive model slides them straight through solid wall, so it (a) counts
them as blocked by shop-2 and (b) makes the delivery animation slide blockers
"out the door" at wall positions where there is no door.

Loading already respects the opening (`reachability.planLoadingRoute` sweeps entry
across `door.position.z … +width`); only the unloading blocker check did not.

Decision (already made): keep this a **simple geometric approximation** per
idea.md §Door-aware loading ("simple clear corridor", "do not implement complex
forklift pathfinding") — NOT a reuse of the full route planner (its single fixed
turn-lane gives wrong unload verdicts, e.g. it would crane items over cargo).
Rear-door behaviour is unchanged.

## Deliverables

- `features/optimizer/accessibility.ts`: side-door branch of `findBlockers`
  becomes door-opening-aware via an **L-corridor** model. The target exits by
  (1) a *longitudinal* leg — driving along Z, in its own x-lane, to bring it into
  the opening's z-band (only when it isn't already in front of the opening); then
  (2) a *lateral* leg — sliding along the exit axis to the wall, at a z within the
  opening. A box blocks iff it intersects either leg (Y-overlap required for both).
  Left and right doors mirror. Rear door logic untouched. No signature change —
  the `VehicleDoor` argument already carries the opening span, so `metrics.ts` and
  `deliveryTimeline.ts` need no edits.

## Acceptance criteria

- [ ] `shop-6-c1`/`shop-6-c2` in the demo-1 layout report **0** later-stop blockers
      (`blockedCargoCount 2→0`, `extraUnloadingMoves 3→0` for that trip).
- [ ] Rear-door blocking unchanged: `metrics.test.ts` (1 blocked / 2 moves) and
      `deliveryTimeline.test.ts` (blocker `shop-2-c1`, extraMoves 1) still pass.
- [ ] `accessibility.test.ts` updated to the corrected side-door contract:
      within-opening lateral blocking still detected; a smaller-x box at the
      target's own z **behind** the opening no longer counts; a box in the
      near-wall Z-corridor does.
- [ ] `typecheck`, `lint`, `test`, `build` green.
- [ ] Visual check via the `verify` skill: side-door delivery no longer slides
      blockers through the wall for demo-1.

## Out of scope (follow-ups)

Multi-lane / swept-lane unload routing; making the delivery blocker MOVE-OUT
animation path itself route through the opening (delivered-item path already does
via T21 reachability); revisiting the anti-split planner now that fewer trips are
flagged as blocked.
