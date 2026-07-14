---
name: verify
description: Build/launch/drive recipe to verify LoadWise changes in the running app (Vite + Playwright, headless Chromium with working WebGL).
---

# Verifying LoadWise in the running app

## Launch

```bash
npm run dev -- --port 5199 --strictPort   # run in background
```

First page load after a config change triggers a Vite dep re-optimization
**full page reload** that resets all zustand state mid-flow — load the page
once and discard that run, or wait for `networkidle` plus a couple of seconds
before driving.

## Drive (Playwright)

Playwright is not a repo dep. Install it in the session scratchpad
(`npm init -y && npm i playwright && npx playwright install chromium`) and
drive with a `.cjs` script. Headless Chromium's WebGL works fine — the R3F
scene renders and screenshots are meaningful.

Happy path to the 3D view: click `Generate scenario` → `Optimize` → the app
auto-navigates to Simulation when the run finishes (`waitForSelector('canvas')`).

Gotchas:

- Buttons expose behaviour via `aria-label` (transport controls) — match on
  those, not icon text.
- The side-door picker is a `radiogroup` of buttons whose accessible name
  includes an SVG diagram, so `name: /^left$/` does NOT match; use
  `page.getByRole('radiogroup', { name: 'Side door' }).getByText('Left')`.
- **Deterministic fixtures can be injected into the live app**: in dev, Vite
  serves the real module instances, so
  `await import('/src/state/uiStore.ts')` from `page.evaluate` returns the
  same store the app uses. Set `useScenarioStore`/`useOptimizationStore`
  state directly (e.g. `demoSideDoorResult` from `/src/fixtures/demo.ts`)
  and `goTo('simulation')` — no UI flow needed.
- **Injection breaks after HMR**: once a module hot-updates, the app's import
  graph uses `?t=<timestamp>` URLs while `page.evaluate` imports the bare URL
  — two separate module instances, so store writes go nowhere. After editing
  source with the server running, restart the dev server before injecting.
- The R3F canvas tree (CargoLayer, animators) mounts noticeably later than
  the DOM in headless — wait ~1–2s after `waitForSelector('canvas')` before
  poking playback clocks, or the animator mount effects will stomp your writes.

## Flows worth driving

- Loading replay (T14): `▶ Replay loading` → transport (Pause/Restart/speed
  cycle/`item k / N` + progress bar). Pause must freeze counter and bar;
  leaving the Simulation screen mid-playback and returning must land back in
  idle with the replay button.
- Delivery route (T15): `🚚 Simulate route` → per-stop choreography (door
  opens, blockers slide out amber, cargo delivers, blockers return, door
  closes). Use `demoBlockingResult` (injected) for a deterministic 1-blocker
  case; panel's "Extra moves" must equal the report's `extraUnloadingMoves`.
  Freeze mid-op deterministically by setting `deliveryClock.t` (import
  `/src/three/Animations/playbackClock.ts`) with `playing: false`.
