# LoadWise

Plan how cargo is loaded into a delivery vehicle and watch every trip in
interactive 3D. LoadWise is a frontend-only web app: a deterministic heuristic
optimizer decides how boxes are packed into a van, then renders the loading
sequence and a stop-by-stop delivery simulation — no backend, no API keys, no
LLM.

**Live demo:** _TBD — Vercel production URL added once the project is connected
in the Vercel dashboard (framework preset: Vite)._

## Demo mode

Click **Load demo** on the Setup screen for a curated, one-click walkthrough:
box truck with a left side door, 6 shops, then **Optimize**. It reliably shows
two trips, side-door loading, mixed cargo and a deferred item. It is fully
reproducible — the demo uses the fixed seed `demo-1` (see
[`src/fixtures/demoConfig.ts`](src/fixtures/demoConfig.ts); the seed was picked
by the dev script [`scripts/findDemoSeed.ts`](scripts/findDemoSeed.ts)). Any
scenario is reproducible from its seed shown on the Planning and Report screens.

## Quickstart

```bash
npm install
npm run dev        # Vite dev server
```

## Scripts

```bash
npm run dev        # start the dev server
npm run build      # typecheck (tsc -b) + production build
npm run preview    # preview the production build
npm run test       # run unit tests (vitest)
npm run test:watch # watch mode
npm run typecheck  # type-check without emitting
npm run lint       # eslint
npm run format     # prettier --write
```

## Tech stack

React 19 + TypeScript (strict) + Vite · React Three Fiber + drei · Zustand ·
Tailwind CSS v4 · Vitest · deployed on Vercel.

## Docs

- [idea.md](idea.md) — full product spec (source of truth)
- [docs/PLAN.md](docs/PLAN.md) — 48h execution plan
- [docs/TASKS.md](docs/TASKS.md) — task board
- [CLAUDE.md](CLAUDE.md) — conventions & workflow for Claude Code sessions
