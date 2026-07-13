# T18 — Integration hardening (all hands, lead: Track A)

Depends: T04–T16 merged · Branch: `feat/T18-hardening` (or small fix branches per bug)

## Context

Read `idea.md` §Important Edge Cases and §Acceptance Criteria. The app is feature-complete on the happy path; this task walks every edge case and acceptance criterion end-to-end in the REAL app (not just unit tests), fixes what breaks, and locks the demo.

## Procedure

1. **Acceptance sweep**: go through idea.md's acceptance criteria list top to bottom in the deployed preview (not just dev). Check each off in the PR description with evidence (screenshot or seed).
2. **Edge-case sweep**: for each of the 15 idea.md edge cases, record: trigger used (seed/config or manual fixture), observed behavior, verdict. Use T17's table as the expected-behavior spec. File/fix bugs as `T18:` commits.
3. **Determinism audit**: run the demo seed twice in two browsers → identical report numbers; add the full-pipeline determinism test if T19 hasn't yet (generate+optimize deep-equal, excluding elapsedMs). Grep `src/features src/utils` for `Math.random|Date.now|new Date` — must be clean (lint should already enforce; verify).
4. **Cross-vehicle audit**: demo-ish scenario on all 3 vehicles × side door none/left/right → no visual glitches (doors in right walls, cargo inside bounds), sane reports.
5. **Perf audit**: warehouse-heavy 8-shop seed (~100 items): optimize < 5s, UI stays responsive (worker), 3D smooth. Record timings in worklog.
6. **Demo lock**: confirm DEMO_SEED still satisfies all §Demo Mode criteria after any optimizer fixes (re-run T17's finder script if weights changed). Freeze optimizer weights after this — changes past here invalidate the rehearsed demo.
7. Fix priority: crashes > wrong math in report > misleading UI > visual polish (polish belongs to T20).

## Coordination

Lead (Track A) triages found bugs into the three tracks; fixes happen in parallel on small branches, merged fast. Keep a running checklist in the PR description — that's the traceability record for this phase (plus individual worklog entries as usual).

## Acceptance criteria

- [ ] All idea.md acceptance criteria checked with evidence
- [ ] All 15 edge cases verified with recorded triggers
- [ ] Determinism + perf audits pass and are recorded
- [ ] DEMO_SEED locked and documented

## Wrap up

TASKS.md, worklog entries from everyone involved, commits `T18:`.
