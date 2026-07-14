// Demo-mode scenario config (T17). One click on Setup → "Load demo" applies
// this, generates, and jumps to Planning. The seed is hard-coded so the demo is
// byte-for-byte reproducible (idea.md §Demo Mode); it is surfaced in the README
// and the report footer for that reason.
//
// DEMO_SEED was chosen by scripts/findDemoSeed.ts, which loops seeds through the
// real generator + optimizer and keeps only those satisfying every §Demo Mode
// criterion. `demo-1` on { box-truck, left side door, 6 shops } demonstrates:
//   - 2 trips (multi-trip planning)
//   - 2 deferred items moved to trip 2 (overflow handling)
//   - 2 shops unloaded through the LEFT side door (door-aware placement)
//   - all 6 cargo categories present (mixed cargo)
//   - 0 permanently unplaceable items (a clean, polished demo)
// It also exercises loading animation, delivery simulation and the full metrics
// report by virtue of being a normal (if hand-picked) scenario.

import type { ScenarioConfig } from '@/types'

export const DEMO_SEED = 'demo-1'

export const DEMO_CONFIG: ScenarioConfig = {
  seed: DEMO_SEED,
  vehicleId: 'box-truck',
  sideDoor: 'left',
  shopCount: 6,
}
