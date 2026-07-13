import { describe, expect, it } from 'vitest'
import type { ScenarioConfig } from '@/types'
import { generateScenario } from './generate'

function config(overrides: Partial<ScenarioConfig> = {}): ScenarioConfig {
  return {
    seed: 'seed-1',
    vehicleId: 'box-truck',
    sideDoor: 'none',
    shopCount: 5,
    ...overrides,
  }
}

describe('generateScenario — determinism', () => {
  it('produces deep-equal scenarios for the same config (multiple seeds)', () => {
    for (const seed of ['a', 'seed-42', 'hackathon', '', 'ünïcödé']) {
      const c = config({ seed, shopCount: 7 })
      expect(generateScenario(c)).toEqual(generateScenario(c))
    }
  })

  it('varies with the seed', () => {
    const a = generateScenario(config({ seed: 'seed-a' }))
    const b = generateScenario(config({ seed: 'seed-b' }))
    const d = generateScenario(config({ seed: 'seed-c' }))
    // Allow rare pairwise collisions, but not all three identical.
    const allEqual =
      JSON.stringify(a.shops) === JSON.stringify(b.shops) &&
      JSON.stringify(b.shops) === JSON.stringify(d.shops)
    expect(allEqual).toBe(false)
  })
})

describe('generateScenario — shop count & delivery order', () => {
  it('respects a valid shopCount', () => {
    for (let count = 3; count <= 8; count++) {
      const s = generateScenario(config({ shopCount: count, seed: `n-${count}` }))
      expect(s.shops).toHaveLength(count)
      expect(s.shops.map((sh) => sh.id)).toEqual(
        Array.from({ length: count }, (_, i) => `shop-${i + 1}`),
      )
    }
  })

  it('clamps shopCount to 3..8', () => {
    expect(generateScenario(config({ shopCount: 0 })).shops).toHaveLength(3)
    expect(generateScenario(config({ shopCount: 2 })).shops).toHaveLength(3)
    expect(generateScenario(config({ shopCount: 100 })).shops).toHaveLength(8)
    expect(generateScenario(config({ shopCount: -5 })).shops).toHaveLength(3)
  })

  it('assigns deliveryOrder as a permutation of 1..n', () => {
    for (const seed of ['p1', 'p2', 'p3']) {
      const s = generateScenario(config({ seed, shopCount: 6 }))
      const orders = s.shops.map((sh) => sh.deliveryOrder).sort((x, y) => x - y)
      expect(orders).toEqual([1, 2, 3, 4, 5, 6])
    }
  })
})

describe('generateScenario — vehicle & doors', () => {
  it('carries the resolved vehicle with only the rear door when sideDoor is none', () => {
    const s = generateScenario(config({ sideDoor: 'none' }))
    expect(s.vehicle.doors.map((d) => d.side)).toEqual(['rear'])
    expect(s.shops.every((sh) => sh.preferredDoor === 'rear')).toBe(true)
  })

  it('lets shops prefer the chosen side door', () => {
    // Over many seeds some shops should prefer the side door, some the rear.
    const doors = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const s = generateScenario(config({ seed: `door-${i}`, sideDoor: 'left' }))
      for (const sh of s.shops) doors.add(sh.preferredDoor)
    }
    expect(doors.has('rear')).toBe(true)
    expect(doors.has('left')).toBe(true)
    expect(doors.has('right')).toBe(false)
  })
})

describe('generateScenario — cargo', () => {
  it('generates deterministic cargo IDs per shop', () => {
    const s = generateScenario(config({ seed: 'ids', shopCount: 4 }))
    for (const shop of s.shops) {
      shop.requestedCargo.forEach((item, idx) => {
        expect(item.id).toBe(`${shop.id}-c${idx + 1}`)
        expect(item.shopId).toBe(shop.id)
      })
    }
  })

  it('beverage stores are dominated by beverage templates', () => {
    let beverage = 0
    let other = 0
    let seen = 0
    for (let i = 0; i < 400 && seen < 60; i++) {
      const s = generateScenario(config({ seed: `bev-${i}`, shopCount: 8 }))
      for (const shop of s.shops) {
        if (shop.type !== 'beverage-store') continue
        seen++
        for (const item of shop.requestedCargo) {
          if (
            item.templateId === 'beverage-pallet' ||
            item.templateId === 'beverage-stack'
          ) {
            beverage++
          } else {
            other++
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(0)
    // Spec weights: 0.4 + 0.4 = 0.8 beverage. Loose lower bound.
    expect(beverage).toBeGreaterThan(other)
  })

  it('produces a zero-cargo shop across ~200 seeds', () => {
    let found = false
    for (let i = 0; i < 200 && !found; i++) {
      const s = generateScenario(config({ seed: `zero-${i}`, shopCount: 8 }))
      found = s.shops.some((sh) => sh.requestedCargo.length === 0)
    }
    expect(found).toBe(true)
  })
})
