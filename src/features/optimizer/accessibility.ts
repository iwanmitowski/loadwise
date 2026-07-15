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
 * cargoIds of boxes that block `target` from leaving through `targetDoor`, in
 * ascending id order (deterministic). Y (height) intervals must always overlap.
 *
 *  - rear door (z=0 wall): slide along −Z; a blocker sits nearer the door
 *    (`min.z < target.min.z`) with overlapping X intervals. The rear opening is
 *    effectively the full back face, so its span is not gated.
 *  - side door (x=0 left / x=width right wall): the door is only an opening over
 *    `z ∈ [position.z, position.z + width]`. A box behind that span cannot slide
 *    straight sideways through solid wall — it exits via an **L-corridor**: drive
 *    along Z in its own x-lane to reach the opening (longitudinal leg), then
 *    slide along the exit axis to the wall at a z within the opening (lateral
 *    leg). A box blocks iff it intrudes on either leg. Left and right mirror.
 *
 * This is a deliberately simple corridor approximation (idea.md §Door-aware
 * loading), not full pathfinding — a single own-x-lane, nearest exit z-band.
 */
export function findBlockers(
  target: PlacedBox,
  targetDoor: VehicleDoor,
  others: PlacedBox[],
): string[] {
  const blockers: string[] = []
  for (const b of others) {
    if (b.cargoId === target.cargoId) continue
    if (!intervalsOverlap(b.min.y, b.size.height, target.min.y, target.size.height)) continue
    const blocks =
      targetDoor.side === 'rear' ? blocksRear(b, target) : blocksSide(b, target, targetDoor)
    if (blocks) blockers.push(b.cargoId)
  }
  return blockers.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/** Rear door: a box nearer the door (lower z) sharing the target's X column. */
function blocksRear(b: PlacedBox, target: PlacedBox): boolean {
  return (
    b.min.z < target.min.z &&
    intervalsOverlap(b.min.x, b.size.width, target.min.x, target.size.width)
  )
}

/**
 * Side door: L-corridor test. The exit z-band is the target's depth clamped into
 * the opening (nearest edge when the target sits fully behind/in front of it).
 *  - lateral leg: the box is between the target and the wall (along the exit
 *    axis) and overlaps that exit z-band;
 *  - longitudinal leg: the box shares the target's own x-lane and lies in the Z
 *    span the target sweeps travelling from its slot to the exit z-band.
 */
function blocksSide(b: PlacedBox, target: PlacedBox, door: VehicleDoor): boolean {
  const zLo = door.position.z
  const zHi = door.position.z + door.width
  const tZ0 = target.min.z
  const tZ1 = target.min.z + target.size.depth
  const depth = target.size.depth

  let exitZ0: number
  let exitZ1: number
  if (tZ1 <= zLo) {
    // target fully rear of the opening → drive +Z, exit at the opening's near edge
    exitZ0 = zLo
    exitZ1 = zLo + depth
  } else if (tZ0 >= zHi) {
    // target fully deep of the opening → drive −Z, exit at the opening's near edge
    exitZ1 = zHi
    exitZ0 = zHi - depth
  } else {
    // target already spans the opening → slide straight out over the overlap
    exitZ0 = Math.max(tZ0, zLo)
    exitZ1 = Math.min(tZ1, zHi)
  }
  const longZ0 = Math.min(tZ0, exitZ0)
  const longZ1 = Math.max(tZ1, exitZ1)

  const tX0 = target.min.x
  const tX1 = target.min.x + target.size.width
  const inExitBand = intervalsOverlap(b.min.z, b.size.depth, exitZ0, exitZ1 - exitZ0)
  const inOwnLane =
    intervalsOverlap(b.min.x, b.size.width, tX0, tX1 - tX0) &&
    intervalsOverlap(b.min.z, b.size.depth, longZ0, longZ1 - longZ0)

  const bX1 = b.min.x + b.size.width
  const lateral =
    door.side === 'left'
      ? b.min.x < tX0 && inExitBand
      : bX1 > tX1 && inExitBand
  return lateral || inOwnLane
}
