// A tiny wall-clock seam. The optimizer needs to measure elapsed time and honour
// a safety time limit, but the domain layer is otherwise strictly deterministic
// (CLAUDE.md §Determinism). Funnelling the one unavoidable clock read through
// this injectable function keeps that nondeterminism contained: it appears only
// in `OptimizationResult.elapsedMs` (documented) and behind the time-limit guard,
// and tests can pass a fake `Clock` for fully reproducible runs.
//
// `performance.now()` is monotonic and is NOT covered by the ESLint `Date.now`
// ban — but we still route it through here so there is exactly one seam.

export type Clock = () => number

export const performanceClock: Clock = () => performance.now()
