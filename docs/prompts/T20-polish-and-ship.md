# T20 — Polish, README, final deploy, demo script (all hands, lead: Track B)

Depends: T18 · Branch: `feat/T20-polish` (small PRs fine)

## Context

Final stretch. Feature freeze is in effect — this task makes what exists look and read great, ships it, and rehearses the demo. Resist every temptation to add features.

## Polish checklist

- **Visual pass** (lead): consistent spacing/typography via Tailwind, dark theme coherent across all 4 screens, empty states styled, buttons have loading/disabled states, favicon + page title, subtle app-wide transitions. 3D: nice default camera pose per vehicle, soft shadows on, shop palette double-checked for adjacent-color distinguishability.
- **Copy pass**: every user-facing string read aloud once — no dev jargon ("no-valid-placement" → "No valid position found"), reason chips humanized (map in one file `src/utils/labels.ts`).
- **Responsive sanity**: usable at 1280×720 (projector!) — the demo machine resolution. Mobile is out of scope; don't spend time there.
- **README** (this is judged): what LoadWise does (2 paragraphs + hero screenshot + GIF of loading animation if quick), live URL, demo seed, how it works (heuristic outline, determinism, worker), architecture sketch (the src/ tree from CLAUDE.md), tech stack, team, how to run. Screenshots of all 4 screens.
- **Final deploy**: production build verified on Vercel (worker functions in prod, 3D loads, no console errors), custom project name so the URL reads nicely.

## Demo script (`docs/DEMO.md`, ~3 minutes)

1. Setup screen: pick Box Truck + left side door — say the constraint story (doors matter).
2. Load demo → planning: point at shops, delivery order, seed ("fully reproducible — same seed, same plan, every time").
3. Optimize: progress bar (worker), then 3D: orbit, toggle walls, click a pallet (metadata), filter a shop.
4. Loading animation at 2×: "watch it load back-to-front for the delivery order".
5. Delivery simulation: first stop unloads through the side door; show the blocker counter if it fires.
6. Trip 2 tab: "didn't fit → automatic second trip", show deferred item in report, warnings, score.
7. Close on report: balance bars + "all deterministic math, no AI API in the loop".

Include a fallback plan: if live demo breaks, a pre-recorded 3-min screen capture (record it during rehearsal). Rehearse twice, timed, different driver each time.

## Acceptance criteria

- [ ] Production URL final, clean console, demo seed works there
- [ ] README complete with screenshots + live link
- [ ] DEMO.md written, rehearsed 2×, recording captured
- [ ] Submission requirements (whatever the hackathon asks: repo link, URL, description) double-checked and submitted before the deadline — not at it

## Wrap up

TASKS.md (all tasks final-statused), everyone's worklog closing entries, commits `T20:`. Ship it. 🚚
