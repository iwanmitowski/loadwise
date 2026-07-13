# T14 — Loading animation

Track B · Depends: T13 · Branch: `feat/T14-loading-animation` · **Start Claude in plan mode.**

## Context

Read `idea.md` §Loading Animation. Replay how the truck gets loaded: boxes fly in through their assigned door in `loadingOrder`, with play/pause/restart/speed and progress. This is a headline demo feature — smoothness matters.

## Decisions already made

- **Animation driver**: single timeline in `useFrame`, advancing a `progressRef` (seconds) by `delta × speed` when playing. **No per-frame React state.** React state changes only on discrete events (item index changes, play/pause) — and even the index can live in a ref with the HUD reading it via a lightweight subscription or rAF-throttled state sync.
- Timeline: item k occupies `[k × STEP, k × STEP + DUR]` seconds (STEP 0.6, DUR 0.55 at speed 1 — overlap-free, tweak to taste). Total = N × STEP.
- **Path per item** (dog-leg, 2 segments, no physics): start at a staging point outside the assigned door — rear: `(doorCenterX, finalY, −150cm)`; side: 150cm out along ±X from the door center at final Y and the door's z-center. Segment 1: staging → a waypoint inside the doorway at final Y and the item's final x (rear) / final z (side). Segment 2: waypoint → final position. Ease-in-out per segment (smoothstep). Items not yet loaded: invisible; finished: exact final transform (snap at segment end — no drift).
- **Highlight** current item: emissive pulse while moving (reuse selection highlight material logic from T13).
- `doorsOpen` forced true while mode is `loading` (doors visually open before first item).
- **Controls** (React overlay `src/components/simulation/PlaybackControls.tsx`): Play/Pause, Restart, speed cycle 0.5×/1×/2×/4× (uiStore.playback), progress: "item 12 / 26" + thin progress bar (fraction of timeline). Entering loading mode: cargo layer starts empty; leaving it (mode → idle): all items shown placed.
- Scrubbing is OUT of scope (cut-ladder adjacent) — restart + speed covers the demo.
- State machine guard: switching trips or regenerating during playback → mode reset to `idle` cleanly (no orphaned refs). Playback state lives in `uiStore.playback` (T09 shape).

## Implementation shape

`src/three/Animations/useLoadingTimeline.ts` — pure-ish hook: takes placements (sorted by loadingOrder) + staging/waypoint calculator, exposes per-item transform for time t. Unit-test the math (pure function `transformAt(t, item)` extracted): before window = staging/hidden, mid = between points, after = exact final. `src/three/Animations/LoadingAnimator.tsx` applies it to CargoBox refs.

## Acceptance criteria

- [ ] Demo fixture: 9 items fly in rear door in loadingOrder, deepest first, smooth at all 4 speeds
- [ ] Pause freezes mid-flight; restart replays; leaving/re-entering simulation screen doesn't wedge state
- [ ] Side-door staging verified with a side-door fixture variant (add one)
- [ ] `transformAt` unit tests green; typecheck/lint/test green

## Wrap up

TASKS.md, worklog, commits `T14:`.
