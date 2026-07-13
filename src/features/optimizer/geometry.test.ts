import { describe, expect, it } from 'vitest'
import { getTemplate } from '@/features/cargo/templates'
import { getVehicle } from '@/features/vehicles/vehicles'
import type { CargoCategory, CargoPlacement, Dimensions, Vec3 } from '@/types'
import {
  boxesOverlap,
  fitsThroughDoor,
  footprintOverlapArea,
  insideVehicle,
  toPlacedBox,
  type PlacedBox,
} from './geometry'

function box(
  min: Vec3,
  size: Dimensions,
  overrides: Partial<PlacedBox> = {},
): PlacedBox {
  return {
    cargoId: 'x',
    templateId: 'medium-box' as CargoCategory,
    min,
    size,
    weightKg: 10,
    ...overrides,
  }
}

describe('toPlacedBox', () => {
  it('copies dimensions at rotation 0', () => {
    const placement: CargoPlacement = {
      cargoId: 'c1',
      tripId: 'trip-1',
      position: { x: 5, y: 0, z: 10 },
      rotationY: 0,
      loadingOrder: 1,
      assignedDoor: 'rear',
    }
    const b = toPlacedBox(placement, getTemplate('standard-pallet'))
    expect(b.size).toEqual({ width: 120, height: 150, depth: 80 })
    expect(b.min).toEqual({ x: 5, y: 0, z: 10 })
    expect(b.weightKg).toBe(350)
    expect(b.templateId).toBe('standard-pallet')
  })

  it('swaps width and depth at rotation 90 (height unchanged)', () => {
    const placement: CargoPlacement = {
      cargoId: 'c1',
      tripId: 'trip-1',
      position: { x: 0, y: 0, z: 0 },
      rotationY: 90,
      loadingOrder: 1,
      assignedDoor: 'rear',
    }
    const b = toPlacedBox(placement, getTemplate('standard-pallet'))
    expect(b.size).toEqual({ width: 80, height: 150, depth: 120 })
  })
})

describe('boxesOverlap', () => {
  const a = box({ x: 0, y: 0, z: 0 }, { width: 100, height: 100, depth: 100 })
  const cases: Array<[string, PlacedBox, boolean]> = [
    ['interior intersection', box({ x: 50, y: 50, z: 50 }, { width: 100, height: 100, depth: 100 }), true],
    ['touching faces along X', box({ x: 100, y: 0, z: 0 }, { width: 50, height: 50, depth: 50 }), false],
    ['touching faces along Y (stacked)', box({ x: 0, y: 100, z: 0 }, { width: 50, height: 50, depth: 50 }), false],
    ['touching faces along Z', box({ x: 0, y: 0, z: 100 }, { width: 50, height: 50, depth: 50 }), false],
    ['fully separate', box({ x: 200, y: 0, z: 0 }, { width: 50, height: 50, depth: 50 }), false],
    ['overlap on X/Z but stacked above (no Y overlap)', box({ x: 10, y: 100, z: 10 }, { width: 50, height: 50, depth: 50 }), false],
  ]
  it.each(cases)('%s', (_label, b, expected) => {
    expect(boxesOverlap(a, b)).toBe(expected)
    expect(boxesOverlap(b, a)).toBe(expected) // symmetric
  })
})

describe('insideVehicle', () => {
  const space: Dimensions = { width: 240, height: 230, depth: 620 }
  it('accepts a box flush against the far corners', () => {
    expect(
      insideVehicle(box({ x: 120, y: 80, z: 540 }, { width: 120, height: 150, depth: 80 }), space),
    ).toBe(true)
  })
  it('rejects a box poking through a wall', () => {
    expect(
      insideVehicle(box({ x: 200, y: 0, z: 0 }, { width: 80, height: 50, depth: 50 }), space),
    ).toBe(false)
  })
  it('rejects a negative origin', () => {
    expect(
      insideVehicle(box({ x: -1, y: 0, z: 0 }, { width: 50, height: 50, depth: 50 }), space),
    ).toBe(false)
  })
})

describe('footprintOverlapArea', () => {
  it('computes the XZ intersection area in cm²', () => {
    const a = box({ x: 0, y: 0, z: 0 }, { width: 100, height: 40, depth: 100 })
    const b = box({ x: 30, y: 0, z: 20 }, { width: 100, height: 40, depth: 100 })
    // X overlap 30..100 = 70, Z overlap 20..100 = 80 → 5600
    expect(footprintOverlapArea(a, b)).toBe(5600)
  })
  it('is 0 for footprints that only touch', () => {
    const a = box({ x: 0, y: 0, z: 0 }, { width: 40, height: 40, depth: 40 })
    const b = box({ x: 40, y: 0, z: 0 }, { width: 40, height: 40, depth: 40 })
    expect(footprintOverlapArea(a, b)).toBe(0)
  })
})

describe('fitsThroughDoor', () => {
  const van = getVehicle('cargo-van')
  const rear = van.doors.find((d) => d.side === 'rear')! // 150 × 170
  const left = van.doors.find((d) => d.side === 'left')! // 110 × 150 (width along Z)
  const pallet = getTemplate('beverage-pallet').dimensions // 120 × 160 × 80

  it('passes the beverage pallet through the rear door', () => {
    expect(fitsThroughDoor(pallet, rear)).toBe(true)
  })

  it('fails the beverage pallet through the side door in both rotations', () => {
    // rotation 0: depth 80 ≤ 110 but height 160 > 150 → fail
    expect(fitsThroughDoor(pallet, left)).toBe(false)
    // rotation 90: depth becomes 120 > 110 → fail
    expect(
      fitsThroughDoor({ width: 80, height: 160, depth: 120 }, left),
    ).toBe(false)
  })
})
