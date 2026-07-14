// Forward-blocking (bracing) analysis — the braking case. Under braking the
// load is thrown toward the cabin (+Z, the 0.8g forward case in EN 12195-1,
// the toughest securing direction; friction alone can never hold it since
// μ < 0.8). An item counts as *braced* when its cabin-side (max-z) face is
// blocked: either flush against the front wall, or in face contact with an
// item that is itself braced — a blocking chain transmitting the load into the
// headboard. Everything else must be secured by lashing, which the MVP does not
// model — so unbraced items are reported as a warning, never a hard violation.
//
// Simplifications (documented): any positive-area face contact counts as
// blocking (no minimum blocking-height rule), and stacked items are judged by
// the same face-contact rule at their own level — an item resting on a braced
// item is NOT braced by it (it would slide off the top under braking).
//
// Pure and deterministic, integer-cm exact comparisons. No React/Three imports
// — runs in the optimizer worker like the rest of this module.

import type { Dimensions } from '@/types'
import type { PlacedBox } from './geometry'

/** Length of overlap of two intervals (0 when they only touch or are disjoint). */
function overlapLength(aMin: number, aLen: number, bMin: number, bLen: number): number {
  return Math.max(0, Math.min(aMin + aLen, bMin + bLen) - Math.max(aMin, bMin))
}

/**
 * The cargoIds with NO forward blocking chain to the front wall, sorted
 * ascending for determinism. Fixed-point propagation from the wall backwards:
 * a box is braced when its max-z face touches the front wall or a braced box
 * with overlapping x/y cross-section.
 */
export function unbracedCargo(boxes: PlacedBox[], space: Dimensions): string[] {
  const braced = new Set<string>()
  for (const b of boxes) {
    if (b.min.z + b.size.depth === space.depth) braced.add(b.cargoId)
  }

  // Propagate until no box changes state (≤ n passes; n ≤ ~100 in practice).
  let changed = true
  while (changed) {
    changed = false
    for (const b of boxes) {
      if (braced.has(b.cargoId)) continue
      const faceZ = b.min.z + b.size.depth
      const blocker = boxes.some(
        (f) =>
          braced.has(f.cargoId) &&
          f.min.z === faceZ &&
          overlapLength(b.min.x, b.size.width, f.min.x, f.size.width) > 0 &&
          overlapLength(b.min.y, b.size.height, f.min.y, f.size.height) > 0,
      )
      if (blocker) {
        braced.add(b.cargoId)
        changed = true
      }
    }
  }

  return boxes
    .map((b) => b.cargoId)
    .filter((id) => !braced.has(id))
    .sort()
}
