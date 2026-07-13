// Support geometry: how much of a box's base rests on the floor or on other
// boxes, and how much weight each supporter carries. Direct load only — no
// transitive propagation in MVP (documented simplification, see T05 prompt).

import {
  baseArea,
  boxTop,
  footprintOverlapArea,
  type PlacedBox,
} from './geometry'

export type SupportInfo = {
  /** Fraction 0..1 of the box's base area resting on the floor or on supporters. */
  ratio: number
  /** cargoIds of boxes whose top face is flush with this box's base. */
  supporters: string[]
}

/**
 * Support for a box against a set of already-placed boxes.
 *  - resting on the floor (min.y === 0) ⇒ ratio 1, no supporters.
 *  - otherwise supporters are boxes whose top face y === box.min.y and whose
 *    footprint overlaps; ratio = Σ footprintOverlapArea / baseArea.
 */
export function computeSupport(box: PlacedBox, placed: PlacedBox[]): SupportInfo {
  if (box.min.y === 0) return { ratio: 1, supporters: [] }

  const supporters: string[] = []
  let supported = 0
  for (const p of placed) {
    if (p.cargoId === box.cargoId) continue
    if (boxTop(p) !== box.min.y) continue
    const area = footprintOverlapArea(box, p)
    if (area <= 0) continue
    supporters.push(p.cargoId)
    supported += area
  }

  const base = baseArea(box)
  return { ratio: base === 0 ? 0 : supported / base, supporters }
}

/** The boxes in `all` that box `b` rests directly upon (top face flush, overlapping). */
function supportersOf(b: PlacedBox, all: PlacedBox[]): PlacedBox[] {
  if (b.min.y === 0) return []
  return all.filter(
    (s) =>
      s.cargoId !== b.cargoId &&
      boxTop(s) === b.min.y &&
      footprintOverlapArea(b, s) > 0,
  )
}

/**
 * Share of box `b`'s weight borne by supporter `s`, attributed proportionally to
 * contact area across all of `b`'s supporters (see rule 7 in the T05 prompt).
 */
function weightShareOnSupporter(
  b: PlacedBox,
  s: PlacedBox,
  all: PlacedBox[],
): number {
  const supporters = supportersOf(b, all)
  const totalContact = supporters.reduce(
    (sum, x) => sum + footprintOverlapArea(b, x),
    0,
  )
  if (totalContact === 0) return 0
  return (b.weightKg * footprintOverlapArea(b, s)) / totalContact
}

/**
 * Total weight resting **directly** on supporter `s` — the sum, over every box in
 * `all` that rests on `s`, of that box's contact-area-weighted share. No transitive
 * load: a box stacked two levels up does not add to `s`.
 */
export function directLoadOnSupporter(s: PlacedBox, all: PlacedBox[]): number {
  const sTop = boxTop(s)
  let total = 0
  for (const b of all) {
    if (b.cargoId === s.cargoId) continue
    if (b.min.y !== sTop) continue
    if (footprintOverlapArea(b, s) <= 0) continue
    total += weightShareOnSupporter(b, s, all)
  }
  return total
}
