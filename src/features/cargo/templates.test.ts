import { describe, expect, it } from 'vitest'
import { getTemplate, itemDimensions, itemVolume } from './templates'

describe('itemDimensions', () => {
  it('returns the footprint unchanged at 0°', () => {
    const t = getTemplate('standard-pallet')
    expect(itemDimensions(t, 0)).toEqual({ width: 120, height: 150, depth: 80 })
  })

  it('swaps width and depth at 90° but keeps height', () => {
    const t = getTemplate('standard-pallet')
    expect(itemDimensions(t, 90)).toEqual({ width: 80, height: 150, depth: 120 })
  })
})

describe('itemVolume', () => {
  it('is the product of the template dimensions and rotation-independent', () => {
    const t = getTemplate('medium-box')
    expect(itemVolume(t)).toBe(60 * 40 * 40)
  })
})

describe('getTemplate', () => {
  it('encodes the beverage pallet as floor-only and non-stackable', () => {
    const t = getTemplate('beverage-pallet')
    expect(t.floorOnly).toBe(true)
    expect(t.stackable).toBe(false)
    expect(t.weightKg).toBe(600)
  })

  it('encodes the fragile box as non-stackable', () => {
    expect(getTemplate('fragile-box').stackable).toBe(false)
  })
})
