import { describe, expect, it } from 'vitest'
import { demoResult, demoScenario } from '@/fixtures/demo'
import type { CargoItem, DeliveryTrip, Scenario, Shop } from '@/types'
import {
  buildCargoRenderItems,
  centerOfMass,
  darkenHex,
  type CargoRenderItem,
} from './cargoModel'

const demoTrip = demoResult.trips[0]

describe('buildCargoRenderItems', () => {
  it('resolves every demo placement with shop + template metadata', () => {
    const items = buildCargoRenderItems(demoTrip, demoScenario)
    expect(items).toHaveLength(demoTrip.placements.length) // 9

    const pallet = items.find((i) => i.cargoId === 'shop-1-c1')!
    expect(pallet.templateName).toBe('Standard pallet')
    expect(pallet.shopName).toBe('Metro Market')
    expect(pallet.weightKg).toBe(350)
    expect(pallet.stopNumber).toBe(3) // shop-1 delivered last
    expect(pallet.assignedDoor).toBe('rear')
    expect(pallet.fragile).toBe(false)
  })

  it('assigns the same colour to cargo from the same shop and distinct across shops', () => {
    const items = buildCargoRenderItems(demoTrip, demoScenario)
    const byShop = new Map<string, Set<string>>()
    for (const i of items) {
      if (!byShop.has(i.shopId)) byShop.set(i.shopId, new Set())
      byShop.get(i.shopId)!.add(i.color)
    }
    for (const colors of byShop.values()) expect(colors.size).toBe(1)
    const shopColors = [...byShop.values()].map((s) => [...s][0])
    expect(new Set(shopColors).size).toBe(byShop.size) // all distinct
  })

  it('flags the fragile box', () => {
    const items = buildCargoRenderItems(demoTrip, demoScenario)
    const fragile = items.find((i) => i.cargoId === 'shop-3-c3')!
    expect(fragile.templateName).toBe('Fragile box')
    expect(fragile.fragile).toBe(true)
  })

  it('returns items sorted by loading order', () => {
    const items = buildCargoRenderItems(demoTrip, demoScenario)
    const orders = items.map((i) => i.loadingOrder)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('applies rotationY 90 by swapping the footprint before centering', () => {
    // medium-box is 60(w) × 40(h) × 40(d); rotate 90° → 40 × 40 × 60.
    const cargo: CargoItem = {
      id: 'r1',
      templateId: 'medium-box',
      shopId: 'shop-x',
    }
    const shop: Shop = {
      id: 'shop-x',
      name: 'Rotato',
      type: 'general-store',
      deliveryOrder: 1,
      preferredDoor: 'rear',
      requestedCargo: [cargo],
    }
    const scenario: Scenario = { ...demoScenario, shops: [shop] }
    const trip: DeliveryTrip = {
      ...demoTrip,
      stops: [{ shopId: 'shop-x', stopNumber: 1, door: 'rear' }],
      placements: [
        {
          cargoId: 'r1',
          tripId: demoTrip.id,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 90,
          loadingOrder: 1,
          assignedDoor: 'rear',
        },
      ],
    }
    const [item] = buildCargoRenderItems(trip, scenario)
    expect(item.size).toEqual({ width: 40, height: 40, depth: 60 })
    // Scene size is metres = cm * 0.01; centre = min + size/2 in metres.
    expect(item.sceneSize).toEqual([0.4, 0.4, 0.6])
    expect(item.center).toEqual([0.2, 0.2, 0.3])
  })

  it('skips placements whose cargo is not in the scenario', () => {
    const trip: DeliveryTrip = {
      ...demoTrip,
      placements: [
        ...demoTrip.placements,
        {
          cargoId: 'ghost',
          tripId: demoTrip.id,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
          loadingOrder: 99,
          assignedDoor: 'rear',
        },
      ],
    }
    const items = buildCargoRenderItems(trip, demoScenario)
    expect(items.some((i) => i.cargoId === 'ghost')).toBe(false)
    expect(items).toHaveLength(demoTrip.placements.length)
  })
})

describe('centerOfMass', () => {
  it('is null for an empty item list', () => {
    expect(centerOfMass([])).toBeNull()
  })

  it('is null when total weight is zero', () => {
    const weightless: CargoRenderItem[] = [
      {
        cargoId: 'w',
        templateId: 'medium-box',
        templateName: 'Medium box',
        shopId: 's',
        shopName: 'S',
        color: '#fff',
        weightKg: 0,
        loadingOrder: 1,
        assignedDoor: 'rear',
        stopNumber: 1,
        fragile: false,
        min: { x: 0, y: 0, z: 0 },
        size: { width: 10, height: 10, depth: 10 },
        center: [1, 1, 1],
        sceneSize: [0.1, 0.1, 0.1],
      },
    ]
    expect(centerOfMass(weightless)).toBeNull()
  })

  it('weights the centroid toward the heavier box', () => {
    const items = buildCargoRenderItems(demoTrip, demoScenario)
    const com = centerOfMass(items)!
    expect(com.totalWeightKg).toBeGreaterThan(0)
    // Fixture is loaded low and roughly centred on X — marker sits near the floor.
    const [x, y] = com.center
    const cargoWidthM = demoScenario.vehicle.cargoSpace.width / 100
    expect(x).toBeGreaterThan(0)
    expect(x).toBeLessThan(cargoWidthM)
    expect(y).toBeLessThan(1) // below 1 m — nothing is stacked high
  })

  it('places the centroid exactly between two equal-weight boxes', () => {
    const base = {
      templateId: 'medium-box' as const,
      templateName: 'Medium box',
      shopId: 's',
      shopName: 'S',
      color: '#fff',
      weightKg: 100,
      loadingOrder: 1,
      assignedDoor: 'rear' as const,
      stopNumber: 1,
      fragile: false,
      min: { x: 0, y: 0, z: 0 },
      size: { width: 10, height: 10, depth: 10 },
      sceneSize: [0.1, 0.1, 0.1] as [number, number, number],
    }
    const items: CargoRenderItem[] = [
      { ...base, cargoId: 'a', center: [0, 0, 0] },
      { ...base, cargoId: 'b', center: [2, 0, 4] },
    ]
    expect(centerOfMass(items)!.center).toEqual([1, 0, 2])
  })
})

describe('darkenHex', () => {
  it('darkens toward black by the given fraction', () => {
    expect(darkenHex('#ffffff', 0.5)).toBe('#808080')
    expect(darkenHex('#4f9dde', 1)).toBe('#000000')
    expect(darkenHex('#4f9dde', 0)).toBe('#4f9dde')
  })
})
