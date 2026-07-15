import { describe, expect, it } from 'vitest'
import type { RigidAxleModel, SemiAxleModel } from '@/types'
import type { PlacedBox } from './geometry'
import {
  axleScore,
  itemSupportDelta,
  overloadBreaches,
  supportLoads,
  underloadBreach,
} from './axles'

// The rigid worked example from docs/deep-research-cargo-loading.md:
// WB = 5.0m, empty front 3.8t / rear 2.2t; item A 2t at 2.0m behind the front
// axle, item B 3t at 4.0m → front 5.6t, rear 5.4t.
// Mapped to cargo-space z (rear axle at z=0, front axle at z=500cm):
const RIGID: RigidAxleModel = {
  kind: 'rigid',
  frontAxleZ: 500,
  rearAxleZ: 0,
  emptyFrontKg: 3800,
  emptyRearKg: 2200,
  maxFrontKg: 7500,
  maxRearKg: 11500,
  minSteerShare: 0.2,
}

// The semi worked example: Lk = 8.1m, 10t crate 5.0m behind the kingpin →
// trailer axles ≈ 6.17t, kingpin ≈ 3.83t. Kingpin at z=1060, axle group z=250.
const SEMI: SemiAxleModel = {
  kind: 'semi',
  kingpinZ: 1060,
  axleGroupZ: 250,
  emptyKingpinKg: 3000,
  emptyAxleGroupKg: 4500,
  maxKingpinKg: 12000,
  maxAxleGroupKg: 27000,
  minKingpinShare: 0.15,
}

function box(id: string, zCenter: number, weightKg: number, depth = 100): PlacedBox {
  return {
    cargoId: id,
    templateId: 'standard-pallet',
    min: { x: 0, y: 0, z: zCenter - depth / 2 },
    size: { width: 100, height: 100, depth },
    weightKg,
  }
}

describe('supportLoads — rigid beam formula (doc worked example)', () => {
  it('reproduces front 5.6t / rear 5.4t', () => {
    // 2.0m behind front axle → z = 500-200 = 300; 4.0m → z = 100.
    const boxes = [box('a', 300, 2000), box('b', 100, 3000)]
    const loads = supportLoads(boxes, RIGID)
    expect(loads.aKg).toBeCloseTo(5600, 6)
    expect(loads.bKg).toBeCloseTo(5400, 6)
    expect(loads.totalKg).toBeCloseTo(11000, 6)
  })

  it('an item behind the rear axle UNLOADS the front axle (negative delta)', () => {
    // z = -100 (rear overhang): lever arm past the rear axle.
    const d = itemSupportDelta(-100, 1000, RIGID)
    expect(d.aKg).toBeLessThan(0)
    expect(d.aKg + d.bKg).toBeCloseTo(1000, 9)
  })
})

describe('supportLoads — semi kingpin formula (doc worked example)', () => {
  it('reproduces axles ≈ 6.17t / kingpin ≈ 3.83t for the 10t crate', () => {
    // 5.0m behind kingpin → z = 1060 - 500 = 560.
    const d = itemSupportDelta(560, 10000, SEMI)
    expect(d.bKg).toBeCloseTo((10000 * 500) / 810, 6) // ≈ 6172.8
    expect(d.aKg).toBeCloseTo(10000 - (10000 * 500) / 810, 6) // ≈ 3827.2
  })
})

describe('overloadBreaches', () => {
  it('is empty inside the envelope and names the breached support', () => {
    expect(overloadBreaches(supportLoads([], RIGID), RIGID)).toEqual([])
    // 12t right on top of the rear axle → rear = 2.2 + 12 = 14.2t > 11.5t.
    const loads = supportLoads([box('h', 0, 12000)], RIGID)
    const breaches = overloadBreaches(loads, RIGID)
    expect(breaches).toHaveLength(1)
    expect(breaches[0]).toContain('rear axle')
  })
})

describe('underloadBreach', () => {
  it('null when the steer share is healthy, message when it collapses', () => {
    expect(underloadBreach(supportLoads([], RIGID), RIGID)).toBeNull()
    // Mass far behind the rear axle levers the front axle down toward zero.
    const loads = supportLoads([box('o', -150, 6000)], RIGID)
    expect(loads.aKg / loads.totalKg).toBeLessThan(0.2)
    expect(underloadBreach(loads, RIGID)).toContain('front axle')
  })
})

describe('axleScore', () => {
  it('prefers the position that relieves the tighter support', () => {
    // This model's FRONT axle is the tighter constraint when empty (3.8/7.5t
    // = 51% used vs 2.2/11.5t = 19%), so the same 3t scores higher placed
    // toward the rear axle than toward the front — the score follows the
    // envelope, not a fixed "always forward" or "always mid" rule.
    const rear = axleScore(supportLoads([box('x', 50, 3000)], RIGID), RIGID)
    const forward = axleScore(supportLoads([box('x', 350, 3000)], RIGID), RIGID)
    expect(rear).toBeGreaterThan(forward)
  })

  it('degrades toward zero as an axle approaches its plated max', () => {
    const light = axleScore(supportLoads([box('x', 250, 1000)], RIGID), RIGID)
    const heavy = axleScore(supportLoads([box('x', 0, 9000)], RIGID), RIGID)
    expect(light).toBeGreaterThan(heavy)
    expect(heavy).toBeLessThanOrEqual(0.05)
  })
})
