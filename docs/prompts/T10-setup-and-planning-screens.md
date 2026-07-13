# T10 — Scenario Setup & Planning screens

Track C · Depends: T09 · Branch: `feat/T10-setup-planning-screens`

## Context

Read `idea.md` §Required Screens (Scenario Setup, Planning View) and §Functional Requirements/Scenario generation. Build the two pre-simulation screens on top of T09's stores. Tailwind, dark theme, keyboard-friendly. Everything works against fixture data until T04/T11 land — the stores hide that.

## Screen 1 — Scenario Setup

- **Vehicle selection**: three cards (name, cargo space dims in metres — display conversion cm→m with 1 decimal —, payload in kg, small schematic proportions drawn with divs/SVG; no 3D here). Selected card highlighted.
- **Side door**: radio group none / left / right, with a top-view mini diagram showing which wall the door sits on.
- **Shop count**: slider or stepper, 3–8, value visible.
- **Seed**: text input (shown at all times — idea.md requires displaying the seed), "randomize" button (`randomizeSeed`), helper text "same seed + settings = same scenario".
- **Generate scenario** button → `generate()` + navigate to Planning. Also a subtle "Load demo" placeholder button (disabled, tooltip "coming soon") — T17 activates it.

## Screen 2 — Planning View

- Header: vehicle summary + seed badge (click = copy seed).
- **Shop list** ordered by `deliveryOrder`: card per shop with color dot (`shopColor`), name, type badge, delivery position ("Stop 3"), preferred door chip, and requested cargo summarized as `template × count` chips with total weight/volume per shop. Zero-cargo shop → card shows "No cargo requested" (don't hide it).
- Totals bar: shops, total units, total weight, total volume vs vehicle capacity (two mini progress bars: weight %, volume % — may exceed 100%, style overflow in amber; this foreshadows multi-trip).
- **Regenerate** (same config, new random seed) and **Back** (edit config, keep seed).
- **Optimize** button → `optimizationStore.run(scenario)` → navigate to Simulation. While `status === 'running'`: full-width progress bar with `stage` text and a **Cancel** button (idea.md: progress + cancellation). On `error`: inline alert with message + retry.

## Decisions already made

- No form library, no router. Local component state only for ephemeral UI, everything meaningful in stores.
- Number formatting helper `src/utils/format.ts`: `fmtM(cm)`, `fmtKg`, `fmtPct` — reused by T16.
- Component files under `src/components/setup/` and `src/components/planning/`.

## Tests

RTL (jsdom pragma): setup renders 3 vehicles, generate navigates; planning renders shop cards from a fixture scenario incl. zero-cargo shop; optimize button disabled when no scenario.

## Out of scope

3D (Track B), report screen (T16), real worker behavior (T11 — the store contract is enough), demo mode activation (T17).

## Acceptance criteria

- [ ] Full click-through: configure → generate → planning list → optimize → lands on simulation placeholder with fake result
- [ ] Seed visible + copyable on both screens; regenerate produces a different seed, same config
- [ ] typecheck/lint/test green

## Wrap up

TASKS.md, worklog, commits `T10:`.
