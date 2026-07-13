import { describe, expect, it } from 'vitest'
import type { CargoCategory, Dimensions, Vec3 } from '@/types'
import type { PlacedBox } from './geometry'
import { computeSupport, directLoadOnSupporter } from './support'

function box(
  cargoId: string,
  min: Vec3,
  size: Dimensions,
  weightKg = 10,
): PlacedBox {
  return { cargoId, templateId: 'medium-box' as CargoCategory, min, size, weightKg }
}

describe('computeSupport', () => {
  it('returns full support with no supporters for a box on the floor', () => {
    const b = box('b', { x: 10, y: 0, z: 10 }, { width: 50, height: 40, depth: 50 })
    expect(computeSupport(b, [])).toEqual({ ratio: 1, supporters: [] })
  })

  it('sums overlap area from every flush supporter', () => {
    const b = box('b', { x: 0, y: 10, z: 0 }, { width: 100, height: 40, depth: 100 })
    const s1 = box('s1', { x: 0, y: 0, z: 0 }, { width: 50, height: 10, depth: 100 })
    const s2 = box('s2', { x: 50, y: 0, z: 0 }, { width: 50, height: 10, depth: 100 })
    const info = computeSupport(b, [s1, s2])
    expect(info.ratio).toBe(1) // 5000 + 5000 = 10000 = base area
    expect(info.supporters.sort()).toEqual(['s1', 's2'])
  })

  it('ignores boxes whose top is not flush with the base', () => {
    const b = box('b', { x: 0, y: 10, z: 0 }, { width: 100, height: 40, depth: 100 })
    const tooLow = box('low', { x: 0, y: 0, z: 0 }, { width: 100, height: 9, depth: 100 })
    expect(computeSupport(b, [tooLow])).toEqual({ ratio: 0, supporters: [] })
  })

  it('passes at exactly 70% and fails just below', () => {
    const b = box('b', { x: 0, y: 10, z: 0 }, { width: 100, height: 40, depth: 100 })
    // base area = 10000. Supporter covering x 0..70, z 0..100 → 7000 = 0.70.
    const at70 = box('s', { x: 0, y: 0, z: 0 }, { width: 70, height: 10, depth: 100 })
    expect(computeSupport(b, [at70]).ratio).toBeCloseTo(0.7, 10)
    expect(computeSupport(b, [at70]).ratio >= 0.7).toBe(true)
    // Supporter covering x 0..69 → 6900 = 0.69 < 0.70.
    const at69 = box('s', { x: 0, y: 0, z: 0 }, { width: 69, height: 10, depth: 100 })
    expect(computeSupport(b, [at69]).ratio >= 0.7).toBe(false)
  })
})

describe('directLoadOnSupporter', () => {
  it('splits a box weight between two supporters by contact area', () => {
    const b = box('b', { x: 0, y: 10, z: 0 }, { width: 100, height: 40, depth: 100 }, 100)
    const s1 = box('s1', { x: 0, y: 0, z: 0 }, { width: 50, height: 10, depth: 100 })
    const s2 = box('s2', { x: 50, y: 0, z: 0 }, { width: 50, height: 10, depth: 100 })
    const all = [b, s1, s2]
    expect(directLoadOnSupporter(s1, all)).toBe(50)
    expect(directLoadOnSupporter(s2, all)).toBe(50)
  })

  it('attributes proportionally when contact areas differ', () => {
    const b = box('b', { x: 0, y: 10, z: 0 }, { width: 100, height: 40, depth: 100 }, 100)
    const s1 = box('s1', { x: 0, y: 0, z: 0 }, { width: 80, height: 10, depth: 100 })
    const s2 = box('s2', { x: 80, y: 0, z: 0 }, { width: 20, height: 10, depth: 100 })
    const all = [b, s1, s2]
    // contact 8000 vs 2000 → 80kg vs 20kg
    expect(directLoadOnSupporter(s1, all)).toBe(80)
    expect(directLoadOnSupporter(s2, all)).toBe(20)
  })

  it('sums the load from several boxes resting on one supporter', () => {
    const s = box('s', { x: 0, y: 0, z: 0 }, { width: 100, height: 10, depth: 100 })
    const a = box('a', { x: 0, y: 10, z: 0 }, { width: 50, height: 40, depth: 100 }, 30)
    const c = box('c', { x: 50, y: 10, z: 0 }, { width: 50, height: 40, depth: 100 }, 70)
    expect(directLoadOnSupporter(s, [s, a, c])).toBe(100)
  })
})
