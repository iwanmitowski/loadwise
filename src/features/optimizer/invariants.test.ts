// T19 — the highest-value test in the repo. For a broad grid of seeds ×
// vehicles × side-door states, run the real pipeline and assert the invariants
// that protect every downstream feature (report, 3D, animation): geometric
// validity, item conservation, dense loading order, payload, and the trip cap.
// Any failure prints the exact (seed, vehicle, door) → instant repro.

import { describe, expect, it } from 'vitest'
import { generateScenario } from '@/features/scenario/generate'
import { optimize } from '@/features/optimizer/optimize'
import { DEFAULT_OPTIMIZER_CONFIG as CFG } from '@/features/optimizer/config'
import { validateLoad } from '@/features/optimizer/validate'
import { getTemplate } from '@/features/cargo/templates'
import type { SideDoorChoice, VehicleId } from '@/types'

const VEHICLES: VehicleId[] = ['cargo-van', 'box-truck', 'semi-trailer']
const DOORS: SideDoorChoice[] = ['none', 'left']
const SEEDS = Array.from({ length: 20 }, (_, i) => `inv-${i}`)

describe('optimizer invariants (20 seeds × 3 vehicles × door on/off)', () => {
  for (const vehicleId of VEHICLES) {
    for (const sideDoor of DOORS) {
      it(`${vehicleId} / side-door ${sideDoor}`, () => {
        for (const seed of SEEDS) {
          const where = `[${seed} ${vehicleId} door=${sideDoor}]`
          const scenario = generateScenario({ seed, vehicleId, sideDoor, shopCount: 6 })
          const result = optimize(scenario, CFG)

          const requested = scenario.shops.flatMap((s) => s.requestedCargo).map((c) => c.id)
          const requestedSet = new Set(requested)
          expect(requestedSet.size, `${where} duplicate requested ids`).toBe(requested.length)

          // --- trip cap ---
          expect(result.trips.length, `${where} maxTrips`).toBeLessThanOrEqual(CFG.maxTrips)

          const placedIds: string[] = []
          for (const trip of result.trips) {
            // --- geometric + constraint validity ---
            expect(validateLoad(trip.placements, scenario, CFG), `${where} ${trip.id} validateLoad`).toEqual([])

            // --- loadingOrder is a dense 1..n permutation ---
            const orders = trip.placements.map((p) => p.loadingOrder).sort((a, b) => a - b)
            expect(orders, `${where} ${trip.id} loadingOrder not dense 1..n`).toEqual(
              trip.placements.map((_, i) => i + 1),
            )

            // --- trip weight within payload ---
            const tripWeight = trip.placements.reduce(
              (sum, p) => sum + getTemplate(resolveTemplate(scenario, p.cargoId)).weightKg,
              0,
            )
            expect(tripWeight, `${where} ${trip.id} over payload`).toBeLessThanOrEqual(
              scenario.vehicle.maxPayloadKg,
            )

            // --- each stop's shop actually has cargo in this trip ---
            for (const stop of trip.stops) {
              const hasCargo = trip.placements.some(
                (p) => resolveShop(scenario, p.cargoId) === stop.shopId,
              )
              expect(hasCargo, `${where} ${trip.id} empty stop ${stop.shopId}`).toBe(true)
            }

            placedIds.push(...trip.placements.map((p) => p.cargoId))
          }

          // --- item conservation: every requested item is placed exactly once
          // OR permanently unplaceable; never both, never lost, never duplicated. ---
          expect(new Set(placedIds).size, `${where} an item is placed in two trips`).toBe(placedIds.length)
          const unplaceableIds = result.unplaceableCargo.map((u) => u.cargoId)
          expect(new Set(unplaceableIds).size, `${where} duplicate unplaceable`).toBe(unplaceableIds.length)

          const accounted = new Set([...placedIds, ...unplaceableIds])
          expect(accounted.size, `${where} placed ∩ unplaceable not disjoint`).toBe(
            placedIds.length + unplaceableIds.length,
          )
          expect([...accounted].sort(), `${where} item conservation violated`).toEqual([...requestedSet].sort())

          // --- permanently unplaceable items carry the permanent flag ---
          for (const u of result.unplaceableCargo) {
            expect(u.permanent, `${where} ${u.cargoId} in result.unplaceableCargo but not permanent`).toBe(true)
          }
        }
      })
    }
  }
})

function resolveTemplate(
  scenario: ReturnType<typeof generateScenario>,
  cargoId: string,
): ReturnType<typeof getTemplate>['id'] {
  return resolveItem(scenario, cargoId).templateId
}

function resolveShop(scenario: ReturnType<typeof generateScenario>, cargoId: string): string {
  return resolveItem(scenario, cargoId).shopId
}

function resolveItem(scenario: ReturnType<typeof generateScenario>, cargoId: string) {
  const item = scenario.shops.flatMap((s) => s.requestedCargo).find((c) => c.id === cargoId)
  if (!item) throw new Error(`cargo ${cargoId} not in scenario`)
  return item
}
