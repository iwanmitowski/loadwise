// Blocking geometry: which already-placed boxes stand between a target box and
// the door it must exit through. Pure geometry — "is that blocker delivered
// later, so does it actually matter?" is the caller's (T08/T15) job. No React /
// Three imports; safe in the worker and the hot path.

import type { VehicleDoor } from '@/types'
import type { PlacedBox } from './geometry'

/** Strict overlap of two half-open intervals [aMin, aMin+aLen) and [bMin, bMin+bLen). */
function intervalsOverlap(
  aMin: number,
  aLen: number,
  bMin: number,
  bLen: number,
): boolean {
  return aMin < bMin + bLen && bMin < aMin + aLen
}

/**
 * cargoIds of boxes that block `target` from sliding straight out through
 * `targetDoor`, in ascending id order (deterministic).
 *
 *  - rear door (z=0 wall): slide along −Z; a blocker sits nearer the door
 *    (`min.z < target.min.z`) with overlapping X **and** Y intervals.
 *  - left door (x=0 wall): slide along −X; blocker has `min.x < target.min.x`
 *    with overlapping Z and Y intervals.
 *  - right door (x=width wall): mirrored — blocker has `min.x > target.min.x`
 *    with overlapping Z and Y intervals.
 */
export function findBlockers(
  target: PlacedBox,
  targetDoor: VehicleDoor,
  others: PlacedBox[],
): string[] {
  const blockers: string[] = []
  for (const b of others) {
    if (b.cargoId === target.cargoId) continue
    let blocks: boolean
    if (targetDoor.side === 'rear') {
      blocks =
        b.min.z < target.min.z &&
        intervalsOverlap(b.min.x, b.size.width, target.min.x, target.size.width) &&
        intervalsOverlap(b.min.y, b.size.height, target.min.y, target.size.height)
    } else if (targetDoor.side === 'left') {
      blocks =
        b.min.x < target.min.x &&
        intervalsOverlap(b.min.z, b.size.depth, target.min.z, target.size.depth) &&
        intervalsOverlap(b.min.y, b.size.height, target.min.y, target.size.height)
    } else {
      // right door — mirror of left
      blocks =
        b.min.x > target.min.x &&
        intervalsOverlap(b.min.z, b.size.depth, target.min.z, target.size.depth) &&
        intervalsOverlap(b.min.y, b.size.height, target.min.y, target.size.height)
    }
    if (blocks) blockers.push(b.cargoId)
  }
  return blockers.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}
