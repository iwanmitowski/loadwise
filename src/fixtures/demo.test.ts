import { describe, expect, it } from 'vitest'
import { demoResult, demoScenario } from './demo'

describe('demoScenario', () => {
  it('requests all 10 units across 3 shops (9 placed + 1 deferred)', () => {
    const requested = demoScenario.shops.flatMap((s) => s.requestedCargo)
    expect(requested).toHaveLength(10)
    expect(demoScenario.shops).toHaveLength(3)
  })

  it('resolves the box-truck with the rear door only', () => {
    expect(demoScenario.vehicle.id).toBe('box-truck')
    expect(demoScenario.vehicle.doors.map((d) => d.side)).toEqual(['rear'])
  })
})

describe('demoResult', () => {
  it('places 9 units and defers 1 in a single trip', () => {
    const [trip] = demoResult.trips
    expect(demoResult.trips).toHaveLength(1)
    expect(trip.placements).toHaveLength(9)
    expect(trip.deferredCargo).toHaveLength(1)
    expect(trip.deferredCargo[0].cargoId).toBe('shop-2-c4')
  })

  it('references only cargo that the scenario requested', () => {
    const requestedIds = new Set(
      demoScenario.shops.flatMap((s) => s.requestedCargo.map((c) => c.id)),
    )
    for (const p of demoResult.trips[0].placements) {
      expect(requestedIds.has(p.cargoId)).toBe(true)
    }
  })

  it('orders stops by delivery order (first unloaded first)', () => {
    expect(demoResult.trips[0].stops.map((s) => s.shopId)).toEqual([
      'shop-3',
      'shop-2',
      'shop-1',
    ])
  })

  // TODO(T05): once validateLoad exists, assert the fixture passes it:
  //   expect(validateLoad(demoScenario, demoResult.trips[0].placements).ok).toBe(true)
})
