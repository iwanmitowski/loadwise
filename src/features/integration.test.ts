// T18 integration hardening — the full generate→optimize→metrics→warnings
// pipeline exercised end-to-end for determinism, cross-vehicle validity, the
// idea.md edge cases, and performance. Complements the per-module unit tests:
// these are the whole-pipeline invariants that must never regress.

import { describe, expect, it } from 'vitest'
import { generateScenario } from '@/features/scenario/generate'
import { optimize } from '@/features/optimizer/optimize'
import { DEFAULT_OPTIMIZER_CONFIG as CFG } from '@/features/optimizer/config'
import { validateLoad } from '@/features/optimizer/validate'
import { insideVehicle, toPlacedBox } from '@/features/optimizer/geometry'
import { getTemplate } from '@/features/cargo/templates'
import { buildScenarioVehicle } from '@/features/vehicles/vehicles'
import { buildTripMetrics } from '@/features/reports/metrics'
import { buildWarnings } from '@/features/reports/warnings'
import type {
  CargoItem,
  Scenario,
  ScenarioConfig,
  Shop,
  SideDoorChoice,
  VehicleId,
} from '@/types'

const VEHICLES: VehicleId[] = ['cargo-van', 'box-truck', 'semi-trailer']
const DOORS: SideDoorChoice[] = ['none', 'left', 'right']

/** Serialize a result for deep-equality, zeroing the one documented seam. */
const canonical = (r: unknown) => JSON.stringify(r, (k, v) => (k === 'elapsedMs' ? 0 : v))

function makeScenario(shops: Shop[], vehicleId: VehicleId = 'cargo-van', sideDoor: SideDoorChoice = 'none'): Scenario {
  return {
    config: { seed: 'edge', vehicleId, sideDoor, shopCount: shops.length },
    vehicle: buildScenarioVehicle(vehicleId, sideDoor),
    shops,
  }
}

function shop(id: string, order: number, cargo: CargoItem[], preferredDoor: Shop['preferredDoor'] = 'rear'): Shop {
  return { id, name: id, type: 'general-store', deliveryOrder: order, preferredDoor, requestedCargo: cargo }
}

describe('integration — determinism (idea.md §Determinism)', () => {
  it('same seed + config ⇒ bit-identical result (excluding elapsedMs)', () => {
    for (const vehicleId of VEHICLES) {
      for (let s = 0; s < 4; s++) {
        const config: ScenarioConfig = { seed: `det-${s}`, vehicleId, sideDoor: 'left', shopCount: 5 }
        const a = optimize(generateScenario(config), CFG)
        const b = optimize(generateScenario(config), CFG)
        expect(canonical(a), `${vehicleId} det-${s}`).toBe(canonical(b))
      }
    }
  })
})

describe('integration — cross-vehicle validity (all 3 vehicles × side door)', () => {
  for (const vehicleId of VEHICLES) {
    for (const sideDoor of DOORS) {
      it(`${vehicleId} / ${sideDoor}: every trip validates, cargo in bounds, doors on the right wall`, () => {
        for (let s = 0; s < 5; s++) {
          const scenario = generateScenario({ seed: `xv-${s}`, vehicleId, sideDoor, shopCount: 5 })

          if (sideDoor !== 'none') {
            const door = scenario.vehicle.doors.find((d) => d.side === sideDoor)
            expect(door, 'side door present').toBeDefined()
            const expectedX = sideDoor === 'left' ? 0 : scenario.vehicle.cargoSpace.width
            expect(door!.position.x).toBe(expectedX)
          }

          const cargoById = new Map(
            scenario.shops.flatMap((sh) => sh.requestedCargo.map((c) => [c.id, c] as const)),
          )
          const result = optimize(scenario, CFG)
          for (const trip of result.trips) {
            expect(validateLoad(trip.placements, scenario, CFG), `${vehicleId}/${sideDoor} ${trip.id}`).toEqual([])
            for (const p of trip.placements) {
              const box = toPlacedBox(p, getTemplate(cargoById.get(p.cargoId)!.templateId))
              expect(insideVehicle(box, scenario.vehicle.cargoSpace), `${p.cargoId} in bounds`).toBe(true)
            }
          }
        }
      })
    }
  }
})

describe('integration — idea.md §Important Edge Cases (no crash, sane result)', () => {
  const sane = (scenario: Scenario) => {
    const result = optimize(scenario, CFG)
    expect(Number.isFinite(result.overallScore)).toBe(true)
    // Re-metric + warn each trip: the report path must never NaN or throw.
    for (const trip of result.trips) {
      const m = buildTripMetrics(trip, scenario, trip.placements.length + trip.deferredCargo.length, CFG)
      expect(Number.isFinite(m.overallScore)).toBe(true)
      expect(Number.isFinite(m.leftRightBalance)).toBe(true)
      expect(Number.isFinite(m.frontRearBalance)).toBe(true)
      expect(Number.isFinite(m.longitudinalStability)).toBe(true)
    }
    expect(() => buildWarnings(result, scenario)).not.toThrow()
    return result
  }

  it('empty scenario / no shops → 0 trips, score 0, no warnings', () => {
    const result = sane(makeScenario([]))
    expect(result.trips).toEqual([])
    expect(result.overallScore).toBe(0)
    expect(buildWarnings(result, makeScenario([]))).toEqual([])
  })

  it('all shops request zero cargo → 0 trips, nothing unplaceable', () => {
    const result = sane(makeScenario([shop('shop-1', 1, []), shop('shop-2', 2, [])]))
    expect(result.trips).toEqual([])
    expect(result.unplaceableCargo).toEqual([])
  })

  it('one shop with cargo, one with zero → the empty shop yields no stop', () => {
    const scenario = makeScenario([
      shop('shop-1', 1, [{ id: 'shop-1-c1', templateId: 'medium-box', shopId: 'shop-1' }]),
      shop('shop-2', 2, []),
    ])
    const result = sane(scenario)
    expect(result.trips).toHaveLength(1)
    const stopShops = result.trips[0].stops.map((s) => s.shopId)
    expect(stopShops).toEqual(['shop-1'])
  })

  it('cargo larger than the vehicle (degenerate tiny bay) → permanent, nothing placed', () => {
    const van = buildScenarioVehicle('cargo-van', 'none')
    const scenario: Scenario = {
      config: { seed: 'big', vehicleId: 'cargo-van', sideDoor: 'none', shopCount: 1 },
      vehicle: { ...van, cargoSpace: { width: 30, height: 30, depth: 30 } },
      shops: [shop('shop-1', 1, [{ id: 'shop-1-c1', templateId: 'standard-pallet', shopId: 'shop-1' }])],
    }
    const result = sane(scenario)
    expect(result.trips.every((t) => t.placements.length === 0)).toBe(true)
    expect(result.unplaceableCargo).toHaveLength(1)
    expect(result.unplaceableCargo[0]).toMatchObject({ permanent: true, reason: 'exceeds-vehicle-dimensions' })
  })

  it('single item heavier than payload → permanent exceeds-payload', () => {
    const van = buildScenarioVehicle('cargo-van', 'none')
    const scenario: Scenario = {
      config: { seed: 'ow', vehicleId: 'cargo-van', sideDoor: 'none', shopCount: 1 },
      vehicle: { ...van, maxPayloadKg: 100 }, // < 350 kg standard pallet
      shops: [shop('shop-1', 1, [{ id: 'shop-1-c1', templateId: 'standard-pallet', shopId: 'shop-1' }])],
    }
    const result = sane(scenario)
    expect(result.unplaceableCargo).toHaveLength(1)
    expect(result.unplaceableCargo[0]).toMatchObject({ permanent: true, reason: 'exceeds-payload' })
  })

  it('more than one trip required (weight forces a split across trips)', () => {
    const heavy = Array.from({ length: 6 }, (_, i) => ({
      id: `shop-1-c${i + 1}`, templateId: 'beverage-pallet' as const, shopId: 'shop-1',
    }))
    const result = sane(makeScenario([shop('shop-1', 1, heavy)]))
    expect(result.trips.length).toBeGreaterThan(1)
    // Every unit is placed somewhere across the trips (none permanently unplaceable).
    expect(result.unplaceableCargo).toEqual([])
  })

  it('preferred side door unavailable → silently falls back to rear', () => {
    const scenario = makeScenario(
      [shop('shop-1', 1, [{ id: 'shop-1-c1', templateId: 'medium-box', shopId: 'shop-1' }], 'left')],
      'cargo-van',
      'none', // no side door fitted
    )
    const result = sane(scenario)
    const doors = new Set(result.trips.flatMap((t) => t.placements.map((p) => p.assignedDoor)))
    expect(doors.has('left')).toBe(false)
    expect(doors).toContain('rear')
  })
})

describe('integration — performance (idea.md §Performance)', () => {
  it('100 mixed units optimize well under the 5s budget and within the trip cap', () => {
    const cats = ['medium-box', 'large-box', 'fragile-box', 'beverage-stack', 'standard-pallet'] as const
    const cargo: CargoItem[] = Array.from({ length: 100 }, (_, i) => ({
      id: `c${i + 1}`, templateId: cats[i % cats.length], shopId: 'shop-1',
    }))
    const scenario = makeScenario([shop('shop-1', 1, cargo)], 'semi-trailer', 'left')
    const t0 = performance.now()
    const result = optimize(scenario, CFG)
    const ms = performance.now() - t0
    expect(ms).toBeLessThan(5000)
    expect(result.trips.length).toBeLessThanOrEqual(CFG.maxTrips)
    const placed = result.trips.reduce((n, t) => n + t.placements.length, 0)
    expect(placed + result.unplaceableCargo.length).toBeLessThanOrEqual(100)
  })
})
