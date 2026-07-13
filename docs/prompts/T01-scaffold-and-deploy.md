# T01 — Scaffold, tooling, CI, Vercel deploy

Track C · Depends: none · Branch: `feat/T01-scaffold`

## Context

First code task of the hackathon. Read `CLAUDE.md` first. Goal: a building, testing, linting, deploying skeleton within ~90 minutes so all three tracks can fork off it.

## Objective

A Vite + React + TypeScript app with all project dependencies installed, the folder skeleton in place, quality gates wired (typecheck/lint/test in CI), and a placeholder page deployed to a public Vercel URL.

## Decisions already made

- Package manager: **npm**. Node ≥ 20.
- Scaffold: `npm create vite@latest . -- --template react-ts` (adjust for non-empty dir: scaffold to a temp dir and move, or use current CLI flags).
- Dependencies: `three @react-three/fiber @react-three/drei zustand`
- Dev deps: `tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom jsdom prettier` plus ESLint as scaffolded by Vite (flat config). Do **not** install Playwright now (T19 does).
- Tailwind v4 via the Vite plugin (`@tailwindcss/vite` + `@import "tailwindcss";` in index.css) — no PostCSS config, no tailwind.config unless needed.
- TypeScript strict mode on. Path alias `@/` → `src/`.

## Requirements

1. Scaffold the app; verify `npm run dev` serves a page.
2. Create the folder skeleton with `.gitkeep` or placeholder `index.ts` files:
   `src/types`, `src/utils`, `src/fixtures`, `src/features/scenario`, `src/features/vehicles`, `src/features/cargo`, `src/features/optimizer`, `src/features/reports`, `src/workers`, `src/state`, `src/components`, `src/three`.
3. Placeholder page: app title "LoadWise", one-line tagline, and a `<Canvas>` from R3F rendering a single spinning box — proves the whole 3D toolchain works in production build.
4. Scripts in package.json: `dev`, `build` (`tsc -b && vite build`), `preview`, `test` (`vitest run`), `test:watch`, `typecheck` (`tsc --noEmit`), `lint`, `format`.
5. ESLint determinism guard — add an override for `src/features/**`, `src/utils/**`, `src/types/**`:
   ```js
   'no-restricted-properties': ['error',
     { object: 'Math', property: 'random', message: 'Use the seeded RNG (src/utils/rng.ts).' },
     { object: 'Date', property: 'now', message: 'Domain code must be deterministic.' }]
   ```
6. Vitest config: default environment `node` (domain tests); component tests opt into jsdom via `// @vitest-environment jsdom`. Add one trivial passing test so `npm run test` is green.
7. GitHub Actions: `.github/workflows/ci.yml` — on push/PR to main: install (npm ci, cache), typecheck, lint, test, build.
8. `.gitignore` (Vite default) + ensure `CLAUDE.local.md` is ignored.
9. Deploy: push the repo to GitHub, connect it to Vercel via dashboard (framework preset: Vite). Confirm the production URL renders the spinning box. Record the URL in the README stub.
10. README stub: project name, one paragraph, live URL, `npm run dev` quickstart, link to `idea.md` and `docs/PLAN.md`.

## Out of scope

No domain types (T02), no real UI screens (T10), no vehicle geometry (T12). Keep the placeholder page throwaway-simple.

## Acceptance criteria

- [ ] `npm run dev`, `build`, `test`, `typecheck`, `lint` all succeed locally
- [ ] CI workflow green on the PR
- [ ] Public Vercel URL shows the page with a rendering R3F canvas
- [ ] Folder skeleton matches CLAUDE.md architecture map
- [ ] ESLint ban verified: a temporary `Math.random()` in `src/utils` produces a lint error (then remove it)

## Wrap up

Update `docs/TASKS.md` (T01 → done), append worklog entry per CLAUDE.md, commits prefixed `T01:`.
