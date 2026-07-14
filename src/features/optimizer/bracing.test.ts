import { describe, expect, it } from 'vitest'
import type { Dimensions } from '@/types'
import type { PlacedBox } from './geometry'
import { unbracedCargo } from './bracing'

const space: Dimensions = { width: 200, height: 200, depth: 400 }

function box(cargoId: string, x: number, y: number, z: number, w = 50, h = 50, d = 50): PlacedBox {
  return {
    cargoId,
    templateId: 'medium-box',
    min: { x, y, z },
    size: { width: w, height: h, depth: d },
    weightKg: 20,
  }
}

describe('unbracedCargo', () => {
  it('a box flush against the front wall is braced', () => {
    expect(unbracedCargo([box('a', 0, 0, 350)], space)).toEqual([])
  })

  it('a box with a gap to the front wall is unbraced', () => {
    expect(unbracedCargo([box('a', 0, 0, 300)], space)).toEqual(['a'])
  })

  it('a blocking chain transmits bracing back from the wall', () => {
    // c ← b ← a ← front wall: each face-flush with the next.
    const boxes = [box('a', 0, 0, 350), box('b', 0, 0, 300), box('c', 0, 0, 250)]
    expect(unbracedCargo(boxes, space)).toEqual([])
  })

  it('a gap anywhere in the chain leaves the tail unbraced', () => {
    // a at the wall; b flush behind a; c separated from b by 10cm.
    const boxes = [box('a', 0, 0, 350), box('b', 0, 0, 300), box('c', 0, 0, 240)]
    expect(unbracedCargo(boxes, space)).toEqual(['c'])
  })

  it('requires cross-section overlap: a beside-neighbour does not brace', () => {
    // b sits behind the wall-braced a but fully to its side (no x overlap).
    const boxes = [box('a', 0, 0, 350), box('b', 50, 0, 300)]
    expect(unbracedCargo(boxes, space)).toEqual(['b'])
  })

  it('an item stacked on a braced item is not braced by it', () => {
    // b rests on top of a (same z, higher y): under braking it slides off the
    // top — only a box in FRONT at its own level (or the wall) braces it.
    const boxes = [box('a', 0, 0, 350), box('b', 0, 50, 300)]
    expect(unbracedCargo(boxes, space)).toEqual(['b'])
  })

  it('a stacked item is braced by a wall-flush item at its own level', () => {
    // b rests on a (y=50) and t stands in front of b at y=50, flush to the wall.
    const boxes = [
      box('a', 0, 0, 300, 50, 50, 100), // floor support, z 300..400
      box('t', 0, 50, 350), // upper level, flush to wall
      box('b', 0, 50, 300), // upper level, braced by t
    ]
    expect(unbracedCargo(boxes, space)).toEqual([])
  })

  it('returns unbraced ids sorted for determinism', () => {
    const boxes = [box('z-item', 0, 0, 0), box('a-item', 100, 0, 0)]
    expect(unbracedCargo(boxes, space)).toEqual(['a-item', 'z-item'])
  })

  it('empty trip has nothing to brace', () => {
    expect(unbracedCargo([], space)).toEqual([])
  })
})
