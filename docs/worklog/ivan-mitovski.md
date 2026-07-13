# Worklog — ivan-mitovski

## [2026-07-13 21:56] T01 — Scaffold, tooling, CI, Vercel deploy
- Dev: ivan-mitovski · Model: Opus 4.8 (1M) · Branch: feat/T01-scaffold
- Done: scaffolded Vite + React 19 + TS (strict) app; installed three/@react-three/fiber/@react-three/drei/zustand + Tailwind v4 (Vite plugin), Vitest, Testing Library, jsdom, Prettier, ESLint stack; created the full `src/` folder skeleton (`.gitkeep` per dir); placeholder LoadWise page with an R3F `<Canvas>` spinning box; wired scripts (dev/build/preview/test/test:watch/typecheck/lint/format), ESLint flat config with the determinism guard, Vitest (node default env + jsdom opt-in) with one passing smoke test, GitHub Actions CI, `.gitignore` (+ `CLAUDE.local.md`, `.vercel`) and README stub. All gates green locally; determinism ban verified (temp `Math.random()` in `src/utils` → lint error, then removed); dev server serves 200 + module transform.
- Files: package.json, package-lock.json, vite.config.ts, tsconfig.app.json, index.html, eslint.config.js, .prettierrc.json, .prettierignore, .gitignore, .github/workflows/ci.yml, src/App.tsx, src/main.tsx, src/index.css, src/test/setup.ts, src/smoke.test.ts, src/**/.gitkeep, README.md, docs/TASKS.md
- Decisions/deviations:
  - **Node was not installed on this machine.** Installed Node.js LTS (v24.18.0) via `winget` (user scope, portable) to unblock the task. Repo requires Node ≥ 20 — satisfied.
  - **Linter: ESLint flat config, not the scaffolder default.** Current `create-vite` now ships **oxlint** (no ESLint). The prompt (req #5) mandates an ESLint per-path `no-restricted-properties` determinism guard, so I removed oxlint and set up the standard Vite ESLint flat-config stack (`eslint` + `typescript-eslint` + `react-hooks` + `react-refresh`). This matches CLAUDE.md ("ESLint enforces this").
  - **react-hooks config:** eslint-plugin-react-hooks v7's `recommended-latest` preset uses the legacy array-`plugins` format (rejected by ESLint 10) and enables very aggressive React-Compiler rules. Registered the plugin directly and enabled just `rules-of-hooks` (error) + `exhaustive-deps` (warn) — the classic Vite-template behaviour.
  - **tsconfig:** scaffold omitted `strict` — added it. TS 6.0 deprecates `baseUrl`, so the `@/` path alias uses `paths` only (resolves relative to tsconfig). `typecheck` uses `tsc -b --noEmit` (solution-style root tsconfig needs `-b` to typecheck referenced projects).
  - Dropped Vite demo assets (logos/hero/App.css); replaced favicon with an inline emoji data-URI.
- Follow-ups:
  - **Vercel deploy is not done** — it requires connecting the GitHub repo in the Vercel dashboard (framework preset: Vite), which needs the owner's authenticated account. README has a `_TBD_` live-URL placeholder to fill in once connected. Acceptance criteria "public Vercel URL" + "CI green on the PR" remain owner-actioned.
  - Production bundle is ~1 MB (three.js) → Vite chunk-size warning only. Fine for MVP; revisit code-splitting in T20 polish if needed.
  - Node was installed only to the user PATH (winget) — a fresh shell picks it up; this session prepends it manually.
