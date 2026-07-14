// Pure aggregation helpers for the Planning screen (and its tests): requested
// cargo rolled up per shop and across the whole scenario. Display-only numbers —
// the optimizer computes its own metrics from placements (features/reports).

import { getTemplate, itemVolume } from '@/features/cargo/templates'
import type { CargoItem, Scenario, Shop } from '@/types'

export type CargoChip = {
  templateId: CargoItem['templateId']
  name: string
  count: number
}

export type ShopSummary = {
  chips: CargoChip[]
  units: number
  weightKg: number
  volumeCm3: number
}

export type ScenarioTotals = {
  shops: number
  units: number
  weightKg: number
  volumeCm3: number
  /** Requested weight / vehicle payload — may exceed 1 (foreshadows multi-trip). */
  weightRatio: number
  /** Requested volume / cargo-space volume — may exceed 1. */
  volumeRatio: number
}

/** Roll one shop's requested cargo up into `template × count` chips + totals. */
export function summarizeShop(shop: Shop): ShopSummary {
  const counts = new Map<CargoItem['templateId'], number>()
  let weightKg = 0
  let volumeCm3 = 0
  for (const item of shop.requestedCargo) {
    counts.set(item.templateId, (counts.get(item.templateId) ?? 0) + 1)
    const template = getTemplate(item.templateId)
    weightKg += template.weightKg
    volumeCm3 += itemVolume(template)
  }
  // Sort chips by template id so the order is stable across renders and seeds.
  const chips: CargoChip[] = [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([templateId, count]) => ({
      templateId,
      name: getTemplate(templateId).name,
      count,
    }))
  return { chips, units: shop.requestedCargo.length, weightKg, volumeCm3 }
}

/** Whole-scenario totals vs the vehicle's payload and cargo-space capacity. */
export function scenarioTotals(scenario: Scenario): ScenarioTotals {
  let units = 0
  let weightKg = 0
  let volumeCm3 = 0
  for (const shop of scenario.shops) {
    const summary = summarizeShop(shop)
    units += summary.units
    weightKg += summary.weightKg
    volumeCm3 += summary.volumeCm3
  }
  const space = scenario.vehicle.cargoSpace
  const capacityCm3 = space.width * space.height * space.depth
  return {
    shops: scenario.shops.length,
    units,
    weightKg,
    volumeCm3,
    weightRatio: scenario.vehicle.maxPayloadKg === 0 ? 0 : weightKg / scenario.vehicle.maxPayloadKg,
    volumeRatio: capacityCm3 === 0 ? 0 : volumeCm3 / capacityCm3,
  }
}

/** Shops in delivery order (stop 1 first), tiebreak by id for stability. */
export function shopsByDeliveryOrder(scenario: Scenario): Shop[] {
  return [...scenario.shops].sort(
    (a, b) =>
      a.deliveryOrder - b.deliveryOrder ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}
