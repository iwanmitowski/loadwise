import { describe, expect, it } from 'vitest'
import { boxCenter, CM, m, sizeToScene, toScene } from './units'

describe('units', () => {
  it('CM converts 1 cm to 0.01 m', () => {
    expect(CM).toBe(0.01)
    expect(m(100)).toBeCloseTo(1)
    expect(m(0)).toBe(0)
  })

  it('toScene scales a min-corner point', () => {
    expect(toScene({ x: 0, y: 0, z: 0 })).toEqual([0, 0, 0])
    expect(toScene({ x: 240, y: 0, z: 620 })).toEqual([2.4, 0, 6.2])
  })

  it('sizeToScene scales dimensions', () => {
    const [w, h, d] = sizeToScene({ width: 240, height: 230, depth: 620 })
    expect(w).toBeCloseTo(2.4)
    expect(h).toBeCloseTo(2.3)
    expect(d).toBeCloseTo(6.2)
  })

  it('boxCenter returns the scene-space centre of a cuboid', () => {
    // A 120×60×80 box at the origin centres at half its extents.
    const [x, y, z] = boxCenter(
      { x: 0, y: 0, z: 0 },
      { width: 120, height: 60, depth: 80 },
    )
    expect(x).toBeCloseTo(0.6)
    expect(y).toBeCloseTo(0.3)
    expect(z).toBeCloseTo(0.4)
  })

  it('boxCenter offsets by the min-corner', () => {
    // Box placed deep and up: centre = (min + size/2) * CM.
    const [x, y, z] = boxCenter(
      { x: 120, y: 60, z: 460 },
      { width: 100, height: 100, depth: 80 },
    )
    expect(x).toBeCloseTo(1.7)
    expect(y).toBeCloseTo(1.1)
    expect(z).toBeCloseTo(5.0)
  })
})
