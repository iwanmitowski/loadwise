import { describe, expect, it } from 'vitest'
import { getTemplate } from '@/features/cargo/templates'
import { buildScenarioVehicle } from '@/features/vehicles/vehicles'
import type {
  CargoCategory,
  DeliveryTrip,
  DoorSide,
  OptimizationResult,
  Scenario,
  VehicleDefinition,
} from '@/types'
import { generateScenario } from '@/features/scenario/generate'
import type { VehicleId } from '@/types'
import { DEFAULT_OPTIMIZER_CONFIG as CFG } from './config'
import { optimize } from './optimize'
import { validateLoad } from './validate'

// --- Builders -------------------------------------------------------------

function makeShop(
  id: string,
  deliveryOrder: number,
  preferredDoor: DoorSide,
  cargos: CargoCategory[],
) {
  return {
    id,
    name: id,
    type: 'general-store' as const,
    deliveryOrder,
    preferredDoor,
    requestedCargo: cargos.map((templateId, i) => ({
      id: `${id}-c${i + 1}`,
      templateId,
      shopId: id,
    })),
  }
}

function makeScenario(
  shops: ReturnType<typeof makeShop>[],
  vehicle: VehicleDefinition,
  sideDoor: Scenario['config']['sideDoor'] = 'none',
): Scenario {
  return {
    config: { seed: 'seed-1', vehicleId: vehicle.id, sideDoor, shopCount: shops.length },
    vehicle,
    shops,
  }
}

/** Every cargoId placed across every trip. */
function placedIds(result: OptimizationResult): string[] {
  return result.trips.flatMap((t) => t.placements.map((p) => p.cargoId))
}

/** Sum of template weights of a trip's placements. */
function tripWeight(trip: DeliveryTrip): number {
  return trip.placements.reduce((kg, p) => {
    // cargoId is `${shopId}-c${n}`; we look the template up via the requested id map below.
    return kg + weightByCargo.get(p.cargoId)!
  }, 0)
}

// Populated per-test where weight assertions are needed.
const weightByCargo = new Map<string, number>()
function indexWeights(scenario: Scenario) {
  weightByCargo.clear()
  for (const shop of scenario.shops) {
    for (const item of shop.requestedCargo) {
      weightByCargo.set(item.id, getTemplate(item.templateId).weightKg)
    }
  }
}

// --- Tests ----------------------------------------------------------------

describe('optimize — single trip', () => {
  it('everything fits → one trip, all placed, nothing deferred or unplaceable', () => {
    const vehicle = buildScenarioVehicle('box-truck', 'none')
    const shops = [
      makeShop('shop-1', 1, 'rear', ['medium-box', 'large-box']),
      makeShop('shop-2', 2, 'rear', ['medium-box', 'medium-box', 'large-box']),
    ]
    const scenario = makeScenario(shops, vehicle)
    const result = optimize(scenario, CFG)

    expect(result.trips).toHaveLength(1)
    expect(result.unplaceableCargo).toHaveLength(0)

    const trip = result.trips[0]
    expect(trip.id).toBe('trip-1')
    expect(trip.tripNumber).toBe(1)
    expect(trip.deferredCargo).toHaveLength(0)
    expect(trip.placements).toHaveLength(5)

    // tripId stamped, loadingOrder is a gapless 1..k.
    expect(trip.placements.every((p) => p.tripId === 'trip-1')).toBe(true)
    expect(trip.placements.map((p) => p.loadingOrder)).toEqual([1, 2, 3, 4, 5])

    // Two stops, renumbered 1..2 in delivery order.
    expect(trip.stops.map((s) => s.stopNumber)).toEqual([1, 2])
    expect(trip.stops.map((s) => s.shopId)).toEqual(['shop-1', 'shop-2'])
    expect(trip.metrics.loadedUnits).toBe(5)
    expect(trip.metrics.requestedUnits).toBe(5)
  })
})

describe('optimize — overflow', () => {
  it('volume overflow → two trips; trip-1 deferred cargo is exactly trip-2 input', () => {
    const vehicle = buildScenarioVehicle('cargo-van', 'none')
    // Many light, unstackable boxes: one van layer cannot hold them all, so they
    // overflow to a second trip without ever hitting the weight ceiling.
    const shops = [makeShop('shop-1', 1, 'rear', Array<CargoCategory>(40).fill('fragile-box'))]
    const scenario = makeScenario(shops, vehicle)
    const result = optimize(scenario, CFG)

    expect(result.trips).toHaveLength(2)
    expect(result.unplaceableCargo).toHaveLength(0)
    expect(placedIds(result).sort()).toEqual(scenario.shops[0].requestedCargo.map((c) => c.id).sort())

    const [t1, t2] = result.trips
    expect(t2.deferredCargo).toHaveLength(0)
    // Deferred from trip 1 == placed in trip 2 (its extra input).
    expect(t1.deferredCargo.map((d) => d.cargoId).sort()).toEqual(
      t2.placements.map((p) => p.cargoId).sort(),
    )
    expect(t1.deferredCargo.every((d) => d.permanent === false)).toBe(true)
  })

  it('weight overflow → beverage pallets split across trips by payload', () => {
    const vehicle = buildScenarioVehicle('cargo-van', 'none') // payload 1200
    const shops = [makeShop('shop-1', 1, 'rear', Array<CargoCategory>(5).fill('beverage-pallet'))]
    const scenario = makeScenario(shops, vehicle)
    indexWeights(scenario)
    const result = optimize(scenario, CFG)

    // All five 600kg pallets eventually load; none are permanently unplaceable.
    expect(result.unplaceableCargo).toHaveLength(0)
    expect(placedIds(result)).toHaveLength(5)
    expect(result.trips.length).toBeGreaterThanOrEqual(3) // 2 + 2 + 1 by weight

    // No trip ever exceeds the payload — weight is the binding constraint.
    for (const trip of result.trips) {
      expect(tripWeight(trip)).toBeLessThanOrEqual(vehicle.maxPayloadKg)
    }
  })
})

describe('optimize — anti-split rule', () => {
  it('a barely-fitting shop is deferred whole; trip-1 records no split', () => {
    // Five single-slot bays along X. Only rotation-0 fits (depth 40), so packing
    // is an exact 5-across tiling — fully deterministic.
    const vehicle: VehicleDefinition = {
      id: 'box-truck',
      name: 'Five-bay',
      cargoSpace: { width: 250, height: 40, depth: 40 },
      maxPayloadKg: 10000,
      doors: [{ id: 'r', side: 'rear', width: 250, height: 40, position: { x: 0, y: 0, z: 0 } }],
    }
    // shop-A is the LATER delivery, so it is inserted first and fills 4 of 5 bays.
    // shop-B (earlier) then gets a single foothold: 1/5 = 20% < 50% → deferred whole.
    const shopA = makeShop('shop-a', 2, 'rear', Array<CargoCategory>(4).fill('fragile-box'))
    const shopB = makeShop('shop-b', 1, 'rear', Array<CargoCategory>(5).fill('fragile-box'))
    const scenario = makeScenario([shopA, shopB], vehicle)
    const result = optimize(scenario, CFG)

    expect(result.trips).toHaveLength(2)
    expect(result.unplaceableCargo).toHaveLength(0)

    const [t1, t2] = result.trips
    // Trip 1 has only shop-A; shop-B was pulled back out.
    expect(t1.metrics.splitShopIds).toEqual([])
    expect(t1.placements.every((p) => p.cargoId.startsWith('shop-a'))).toBe(true)
    expect(t1.placements).toHaveLength(4)
    // All five shop-B items were deferred as one block…
    expect(t1.deferredCargo.map((d) => d.cargoId).sort()).toEqual(
      shopB.requestedCargo.map((c) => c.id).sort(),
    )
    // …and land, whole, in trip 2.
    expect(t2.placements.map((p) => p.cargoId).sort()).toEqual(
      shopB.requestedCargo.map((c) => c.id).sort(),
    )
  })

  it('a genuine split (no rescue possible) is recorded in splitShopIds', () => {
    // A single shop overflowing a van cannot be anti-split away (no other shop
    // placed cargo) → it stays split and is recorded.
    const vehicle = buildScenarioVehicle('cargo-van', 'none')
    const shops = [makeShop('shop-1', 1, 'rear', Array<CargoCategory>(40).fill('fragile-box'))]
    const result = optimize(makeScenario(shops, vehicle), CFG)
    expect(result.trips[0].metrics.splitShopIds).toEqual(['shop-1'])
  })
})

describe('optimize — permanently unplaceable', () => {
  it('oversized and overweight items are permanent and appear in no trip', () => {
    const vehicle: VehicleDefinition = {
      id: 'cargo-van',
      name: 'Odd-payload',
      cargoSpace: { width: 200, height: 200, depth: 70 },
      maxPayloadKg: 40,
      doors: [{ id: 'r', side: 'rear', width: 60, height: 110, position: { x: 0, y: 0, z: 0 } }],
    }
    const shops = [
      makeShop('shop-1', 1, 'rear', [
        'standard-pallet', // depth 80 (120 rotated) > 70 → oversized
        'beverage-stack', // 45kg > 40 payload → overweight
        'fragile-box', // 12kg, fits → the one placeable item
      ]),
    ]
    const result = optimize(makeScenario(shops, vehicle), CFG)

    expect(result.trips).toHaveLength(1)
    expect(result.trips[0].placements.map((p) => p.cargoId)).toEqual(['shop-1-c3'])

    const byId = new Map(result.unplaceableCargo.map((u) => [u.cargoId, u]))
    expect(byId.get('shop-1-c1')?.reason).toBe('exceeds-vehicle-dimensions')
    expect(byId.get('shop-1-c2')?.reason).toBe('exceeds-payload')
    expect(result.unplaceableCargo.every((u) => u.permanent)).toBe(true)

    // The bad items are in NO trip.
    expect(placedIds(result)).not.toContain('shop-1-c1')
    expect(placedIds(result)).not.toContain('shop-1-c2')
  })

  it('zero placeable cargo → no infinite loop, ≤1 trip, everything permanent', () => {
    const vehicle: VehicleDefinition = {
      id: 'cargo-van',
      name: 'Shoebox',
      cargoSpace: { width: 100, height: 100, depth: 100 },
      maxPayloadKg: 10000,
      doors: [{ id: 'r', side: 'rear', width: 90, height: 90, position: { x: 0, y: 0, z: 0 } }],
    }
    const shops = [makeShop('shop-1', 1, 'rear', Array<CargoCategory>(3).fill('standard-pallet'))]
    const result = optimize(makeScenario(shops, vehicle), CFG)

    expect(result.trips.length).toBeLessThanOrEqual(1)
    expect(result.unplaceableCargo).toHaveLength(3)
    expect(result.unplaceableCargo.every((u) => u.permanent)).toBe(true)
    expect(placedIds(result)).toHaveLength(0)
  })

  it('maxTrips reached → leftovers get trip-limit-reached', () => {
    const vehicle = buildScenarioVehicle('cargo-van', 'none')
    const shops = [makeShop('shop-1', 1, 'rear', Array<CargoCategory>(40).fill('fragile-box'))]
    const result = optimize(makeScenario(shops, vehicle), { ...CFG, maxTrips: 1 })

    expect(result.trips).toHaveLength(1)
    const leftover = result.unplaceableCargo.filter((u) => u.reason === 'trip-limit-reached')
    expect(leftover.length).toBeGreaterThan(0)
    expect(leftover.every((u) => u.permanent)).toBe(true)
    // Everything is accounted for exactly once.
    expect(placedIds(result).length + result.unplaceableCargo.length).toBe(40)
  })
})

describe('optimize — determinism & metadata', () => {
  it('identical input twice ⇒ deep-equal result (excluding elapsedMs)', () => {
    const vehicle = buildScenarioVehicle('box-truck', 'left')
    const shops = [
      makeShop('shop-1', 1, 'left', ['beverage-pallet', 'large-box', 'medium-box', 'fragile-box']),
      makeShop('shop-2', 2, 'rear', ['standard-pallet', 'standard-pallet', 'medium-box']),
      makeShop('shop-3', 3, 'rear', ['large-box', 'large-box', 'fragile-box']),
    ]
    const scenario = makeScenario(shops, vehicle, 'left')
    const a = optimize(scenario, CFG)
    const b = optimize(scenario, CFG)
    expect({ ...a, elapsedMs: 0 }).toEqual({ ...b, elapsedMs: 0 })
  })

  it('reports the scenario seed and vehicle, and a non-negative elapsedMs', () => {
    const vehicle = buildScenarioVehicle('box-truck', 'none')
    const scenario = makeScenario([makeShop('shop-1', 1, 'rear', ['medium-box'])], vehicle)
    const result = optimize(scenario, CFG)
    expect(result.seed).toBe('seed-1')
    expect(result.vehicleId).toBe('box-truck')
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it('progress is reported, ends at 100%, and is not called excessively', () => {
    const vehicle = buildScenarioVehicle('box-truck', 'none')
    const shops = [makeShop('shop-1', 1, 'rear', Array<CargoCategory>(25).fill('medium-box'))]
    const calls: Array<{ percent: number; stage: string }> = []
    optimize(makeScenario(shops, vehicle), CFG, (percent, stage) => calls.push({ percent, stage }))

    expect(calls.length).toBeGreaterThan(0)
    expect(calls.length).toBeLessThanOrEqual(50)
    expect(calls.at(-1)).toEqual({ percent: 100, stage: 'Done' })
    expect(calls.every((c) => c.percent >= 0 && c.percent <= 100)).toBe(true)
  })
})

describe('optimize — safety time limit', () => {
  it('aborts on the injected clock: keeps best-so-far, flags the rest, warns', () => {
    const vehicle = buildScenarioVehicle('cargo-van', 'none')
    const shops = [makeShop('shop-1', 1, 'rear', Array<CargoCategory>(5).fill('fragile-box'))]
    // Clock jumps 10ms per read; limit 5ms → the first per-item check trips it.
    let t = 0
    const clock = () => {
      t += 10
      return t
    }
    const result = optimize(makeScenario(shops, vehicle), { ...CFG, safetyTimeLimitMs: 5 }, undefined, clock)

    expect(result.warnings.some((w) => w.code === 'time-limit')).toBe(true)
    expect(placedIds(result)).toHaveLength(1) // finished the current item only
    const timed = result.unplaceableCargo.filter((u) => u.detail === 'time-limit')
    expect(timed).toHaveLength(4)
    expect(timed.every((u) => u.permanent && u.reason === 'no-valid-placement')).toBe(true)
  })
})

describe('optimize — every committed trip is physically valid', () => {
  // Regression: the anti-split rule defers a whole shop by stripping its boxes
  // from the trip, which could leave another shop's box — packed on top of a
  // deferred box — floating with zero support (caught in the 3D view; e.g.
  // cargo-van seed-6 shop-3-c9 sat at y=40 on nothing). Every final trip must
  // pass validateLoad, so no box is ever left unsupported after the fact.
  const vehicles: VehicleId[] = ['cargo-van', 'box-truck', 'semi-trailer']

  for (const vehicleId of vehicles) {
    for (const shopCount of [3, 4, 5]) {
      it(`${vehicleId} / ${shopCount} shops: no trip has support/overlap/bounds violations`, () => {
        for (let s = 0; s < 20; s++) {
          const scenario = generateScenario({
            seed: `seed-${s}`,
            vehicleId,
            sideDoor: 'none',
            shopCount,
          })
          const result = optimize(scenario, CFG)
          for (const trip of result.trips) {
            const violations = validateLoad(trip.placements, scenario, CFG)
            expect(
              violations,
              `seed-${s} ${trip.id}: ${violations.map((v) => `${v.code}:${v.cargoId}`).join(', ')}`,
            ).toEqual([])
          }
        }
      })
    }
  }

  it('regenerates support after anti-split defers a supporting shop (cargo-van seed-6)', () => {
    const scenario = generateScenario({
      seed: 'seed-6',
      vehicleId: 'cargo-van',
      sideDoor: 'none',
      shopCount: 3,
    })
    const result = optimize(scenario, CFG)
    for (const trip of result.trips) {
      const support = validateLoad(trip.placements, scenario, CFG).filter(
        (v) => v.code === 'insufficient-support',
      )
      expect(support).toEqual([])
    }
  })
})
