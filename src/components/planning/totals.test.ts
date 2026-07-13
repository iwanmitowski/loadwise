import { describe, expect, it } from 'vitest'
import { buildScenarioVehicle } from '@/features/vehicles/vehicles'
import type { CargoCategory, Scenario, Shop } from '@/types'
import { scenarioTotals, shopsByDeliveryOrder, summarizeShop } from './totals'

const makeShop = (
  id: string,
  deliveryOrder: number,
  templateIds: CargoCategory[],
): Shop => ({
  id,
  name: `Shop ${id}`,
  type: 'general-store',
  deliveryOrder,
  preferredDoor: 'rear',
  requestedCargo: templateIds.map((templateId, i) => ({
    id: `${id}-c${i + 1}`,
    templateId,
    shopId: id,
  })),
})

const makeScenario = (shops: Shop[]): Scenario => ({
  config: { seed: 't', vehicleId: 'cargo-van', sideDoor: 'none', shopCount: shops.length },
  vehicle: buildScenarioVehicle('cargo-van', 'none'),
  shops,
})

describe('summarizeShop', () => {
  it('groups cargo into template × count chips sorted by template id', () => {
    const shop = makeShop('shop-1', 1, [
      'medium-box',
      'standard-pallet',
      'medium-box',
      'large-box',
    ])
    const summary = summarizeShop(shop)

    expect(summary.units).toBe(4)
    expect(summary.chips).toEqual([
      { templateId: 'large-box', name: 'Large box', count: 1 },
      { templateId: 'medium-box', name: 'Medium box', count: 2 },
      { templateId: 'standard-pallet', name: 'Standard pallet', count: 1 },
    ])
    // large-box 40 + 2 × medium-box 20 + standard-pallet 350
    expect(summary.weightKg).toBe(430)
    // 80·60·60 + 2 × 60·40·40 + 120·150·80
    expect(summary.volumeCm3).toBe(288_000 + 192_000 + 1_440_000)
  })

  it('handles a zero-cargo shop', () => {
    const summary = summarizeShop(makeShop('shop-1', 1, []))
    expect(summary).toEqual({ chips: [], units: 0, weightKg: 0, volumeCm3: 0 })
  })
})

describe('scenarioTotals', () => {
  it('sums across shops and relates to vehicle capacity', () => {
    const scenario = makeScenario([
      makeShop('shop-1', 1, ['medium-box']), // 20 kg
      makeShop('shop-2', 2, ['large-box']), // 40 kg
    ])
    const totals = scenarioTotals(scenario)

    expect(totals.shops).toBe(2)
    expect(totals.units).toBe(2)
    expect(totals.weightKg).toBe(60)
    expect(totals.volumeCm3).toBe(288_000 + 96_000)
    // cargo-van payload 1200 kg, space 180·180·320 cm³
    expect(totals.weightRatio).toBeCloseTo(60 / 1200)
    expect(totals.volumeRatio).toBeCloseTo(384_000 / 10_368_000)
  })

  it('reports ratios above 1 when the request exceeds capacity', () => {
    // 3 beverage pallets = 1800 kg on a 1200 kg cargo van → weight overflows
    // while volume still fits: the two ratios are independent.
    const scenario = makeScenario([
      makeShop('shop-1', 1, ['beverage-pallet', 'beverage-pallet', 'beverage-pallet']),
    ])
    const totals = scenarioTotals(scenario)

    expect(totals.weightRatio).toBeCloseTo(1800 / 1200)
    expect(totals.weightRatio).toBeGreaterThan(1)
    expect(totals.volumeRatio).toBeLessThan(1)
  })
})

describe('shopsByDeliveryOrder', () => {
  it('sorts by deliveryOrder with id as tiebreaker', () => {
    const scenario = makeScenario([
      makeShop('shop-3', 2, []),
      makeShop('shop-1', 3, []),
      makeShop('shop-2', 1, []),
    ])
    expect(shopsByDeliveryOrder(scenario).map((s) => s.id)).toEqual([
      'shop-2',
      'shop-3',
      'shop-1',
    ])
  })
})
