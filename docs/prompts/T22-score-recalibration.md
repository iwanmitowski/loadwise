# T22 — Score recalibration (research-doc aligned)

Track A+C · Depends: T08, T21 · Branch: `feat/T22-score-recalibration`

## Context

Owner flagged that good plans scored ~51/100 — the headline made the app look useless. Decomposition across 899 trips showed the score was **miscalibrated**, not the plans bad:

- volume util 0.26 → 6.6/25 and weight util 0.59 → 8.8/15: **40% of the score was raw utilisation**, which is mostly dictated by *what the shops ordered vs. the vehicle size*, not packing skill. Contradicts docs/deep-research-cargo-loading.md ("the densest plan is not the best plan"; rank trips/accessibility/compliance above utilisation).
- balance 0.45 → 9.0/20: `frontRearBalance` rewards a 50/50 front↔rear split, but T21's front-pack + axle work loads mass **forward on purpose** (CoG / steering-axle safety). The metric was penalising the correct behaviour.
- accessibility 0.99 → 24.8/25: plans were genuinely fine.

## Deliverables (as built)

- `axles.ts` — `axleComplianceScore`: full marks while both supports sit within their plated maxima with healthy steer share; falls off only near/over a limit. (Distinct from `axleScore`, which rewards *margin* — right for choosing placements, wrong for grading a finished load.)
- `score.ts` — recalibrated `computeTripScore`: **accessibility 25 · stability 25 · lateral balance 15 · utilisation 20 · delivery 15**. Longitudinal quality is `longitudinalStability` (axle compliance, or a forward-CoG proxy without axle data) — NOT a 50/50 split. Utilisation is `max(volume, weight)` so a weight-limited dense load isn't double-penalised for low volume.
- `metrics.ts` — computes `longitudinalStabilityScore` (axle compliance / forward-CoG proxy) and exposes it as a new metric.
- **[TYPES CHANGE]** `OptimizationMetrics.longitudinalStability: number` (additive); `SCORE_WEIGHTS` keys renamed (`volume/weight/balance` → `accessibility/stability/lateralBalance/utilization/delivery`).
- T16 `MetricGrid` — "Front/rear balance" bar → **"Load stability (axle/CoG)"** (`longitudinalStability`), so the report number agrees with the score instead of contradicting it.

## Acceptance criteria

- [x] Decomposition scan (899 trips): avg per-trip score **59 → 79**, overall **59 → 78**; 92% of trips ≥ 70, 195 ≥ 85
- [x] Good plans (accessible, axle-legal, forward-CoG) land in the 80s; blocked/imbalanced/split loads still score lower — the number discriminates quality
- [x] Report agrees with itself: score + "Load stability" bar tell the same story (browser-verified; demo scenario 51→76)
- [x] typecheck / lint / 335 tests / build green

## Out of scope (follow-ups)

Lateral balance is still ~0.58 (single wide pallets can't centre on extreme-point candidates) — improving it needs a centred-candidate generator in the heuristic, not a scoring change. CoG-height penalty (doc lists it) folded into neither term yet. Trip-count efficiency vs. an optimal baseline not scored (can't fairly without solving optimally).
