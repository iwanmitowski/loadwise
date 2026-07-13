# Worklog — who did what, when, and why

This directory is the team's traceability record. Every Claude Code working session ends by appending an entry to the developer's personal log file. Combined with `Txx:`-prefixed commits and the task board, this answers "who changed what and why" at any point in the hackathon — and makes hand-offs between developers painless.

## Your log file

One append-only file per developer — no merge conflicts, ever. The file name comes from your git identity:

1. Run `git config user.name`.
2. Slugify it: lowercase, drop any `DOMAIN\` prefix, replace non-alphanumerics with `-`.
   - `GBP\ivan.mitovski` → `docs/worklog/ivan-mitovski.md`
3. Create the file on first use with a `# Worklog — <Name>` heading.

Claude Code sessions do this automatically (instructed in CLAUDE.md) — the entry is written *by Claude* before it finishes a task, so the log reflects what was actually done, not what someone remembers later.

## Entry template

```markdown
## [2026-07-18 14:30] T06 — Placement heuristic
- Dev: ivan-mitovski · Model: Opus 4.8 · Branch: feat/T06-placement-heuristic
- Done: implemented candidate-point generation, scoring, and selection loop; 14 unit tests passing.
- Files: src/features/optimizer/placement.ts, scoring.ts, candidates.ts, placement.test.ts
- Decisions/deviations: capped candidate points at 600 (prompt said "cap"; picked value after perf test at 100 items ≈ 1.8s).
- Follow-ups: side-door corridor scoring is naive — revisit in T18 if demo seed looks odd.
```

Keep entries short but never skip **Decisions/deviations** — that line is what saves the next person hours. If a session is paused mid-task, log an entry anyway with status and where to pick up.

## When to write

- Task completed → entry (always).
- Session paused / handing off → entry with "state + next step".
- Touched files owned by another track → say so explicitly.
- Changed `src/types/` after T02 → entry **plus** immediate team ping.
