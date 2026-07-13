# Task prompts — how to use these files

Each `Txx-*.md` file is a **self-contained kickoff prompt** for one task. It carries everything an implementation session needs: scope boundaries, exact contracts, decisions already made, file paths, acceptance criteria, and verification steps. That means any developer can start any task with a single line, and no session depends on chat history.

## Kickoff ritual (per task)

1. Claim the task in [../TASKS.md](../TASKS.md) (Status → `wip`), pull latest `main`, create `feat/Txx-slug`.
2. Open a **fresh** Claude Code session (use `/clear` if reusing a terminal). Model: **Opus 4.8**.
3. Type: `Read docs/prompts/Txx-<name>.md and implement it.`
4. For the hard four — **T06, T07, T14, T15** — start in plan mode (Shift+Tab) and approve the plan before implementation.
5. When Claude finishes it will run checks, update TASKS.md, and write your worklog entry (CLAUDE.md instructs it to). Verify, merge the PR when CI is green.

One task = one session = one branch = one prompt file. Don't chain two tasks in one session — context bleed causes scope creep, and traceability gets muddy.

## Why per-task prompts (and how they're written)

Implementation sessions start with zero memory. CLAUDE.md gives every session the conventions; the prompt file gives it the task. These prompts are optimized for an implementation model (Opus 4.8):

- **Decisions are pre-made.** Ambiguity is resolved here, at planning time (Fable 5), not re-debated during implementation. Sections titled "Decisions already made" are settled.
- **Contracts are exact.** Type signatures and file paths are spelled out so three parallel sessions produce code that composes.
- **Scope is fenced.** Every prompt lists what NOT to build, and which files it may touch.
- **Verification is explicit.** Every prompt ends with commands that must pass.

## Maintaining the prompts

Prompts are living documents. If implementation reveals a prompt is wrong (an interface had to change, a decision didn't survive contact with reality), the implementing session updates the prompt file in the same PR and notes the deviation in the worklog. Re-planning bigger than that (re-scoping, re-ordering tasks) → switch to Fable 5, update PLAN.md/TASKS.md/prompts together.

## Prompt index

Wave 0: T01 (scaffold) · T02 (types & data — the contract)
Track A: T03 (RNG/fixtures) · T04 (scenario gen) · T05 (validation) · T06 (placement) · T07 (multi-trip) · T08 (metrics)
Track B: T12 (vehicle scene) · T13 (cargo render) · T14 (loading anim) · T15 (delivery sim)
Track C: T09 (stores/shell) · T10 (setup/planning screens) · T11 (worker) · T16 (report) · T17 (demo/edge UX)
All: T18 (hardening) · T19 (tests) · T20 (ship)
