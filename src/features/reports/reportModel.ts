// Report view-model (T08). `buildReportModel` resolves an `OptimizationResult`
// into exactly what the report screen (T16) renders — shop names, per-shop
// colors, per-trip stops with loaded counts, and resolved deferred/unplaceable
// lists — so the UI does zero math. Pure and deterministic; the shop palette is
// assigned by generation order. No React / Three imports.

import type {
  DoorSide,
  OptimizationResult,
  OptimizationWarning,
  Scenario,
  ShopType,
  UnplacedReason,
  VehicleId,
} from '@/types'
import { cargoShopMap } from './metrics'
import { SHOP_PALETTE } from '@/utils/shopColors'

/**
 * Shop colors — single source of truth is `@/utils/shopColors` (T09), shared by
 * the 3D scene, the report legend, and any per-shop UI. Assigned here by the
 * shop's index in `scenario.shops` (generation order), which equals id-sorted
 * order for generated scenarios. Re-exported for existing consumers/tests.
 */
export { SHOP_PALETTE }

export type ShopLegendEntry = {
  shopId: string
  name: string
  type: ShopType
  color: string
  deliveryOrder: number
}

export type ReportStop = {
  stopNumber: number
  shopId: string
  shopName: string
  color: string
  door: DoorSide
  loadedUnits: number
}

export type ReportUnplaced = {
  cargoId: string
  shopId: string
  shopName: string
  reason: UnplacedReason
  detail?: string
}

export type TripReport = {
  tripId: string
  tripNumber: number
  metrics: OptimizationResult['trips'][number]['metrics']
  stops: ReportStop[]
  deferredCargo: ReportUnplaced[]
  warnings: OptimizationWarning[]
}

export type ReportModel = {
  seed: string
  vehicleId: VehicleId
  vehicleName: string
  tripCount: number
  overallScore: number
  elapsedMs: number
  shopLegend: ShopLegendEntry[]
  trips: TripReport[]
  unplaceableCargo: ReportUnplaced[]
  /** Result-level warnings only (those with no `tripId`). */
  warnings: OptimizationWarning[]
  totals: {
    requestedUnits: number
    loadedUnits: number
    deferredUnits: number
    unplaceableUnits: number
  }
}

/** Assemble everything the report screen needs from a finished result. */
export function buildReportModel(result: OptimizationResult, scenario: Scenario): ReportModel {
  const shopById = new Map(scenario.shops.map((s) => [s.id, s]))
  const colorByShop = new Map<string, string>()
  scenario.shops.forEach((shop, i) => {
    colorByShop.set(shop.id, SHOP_PALETTE[i % SHOP_PALETTE.length])
  })
  const shopByCargo = cargoShopMap(scenario)
  const nameOf = (shopId: string): string => shopById.get(shopId)?.name ?? shopId
  const colorOf = (shopId: string): string => colorByShop.get(shopId) ?? SHOP_PALETTE[0]

  const shopLegend: ShopLegendEntry[] = scenario.shops.map((shop) => ({
    shopId: shop.id,
    name: shop.name,
    type: shop.type,
    color: colorOf(shop.id),
    deliveryOrder: shop.deliveryOrder,
  }))

  const trips: TripReport[] = result.trips.map((trip) => {
    // Loaded units per shop, so each stop shows its own count.
    const loadedByShop = new Map<string, number>()
    for (const p of trip.placements) {
      const shopId = shopByCargo.get(p.cargoId)
      if (shopId !== undefined) loadedByShop.set(shopId, (loadedByShop.get(shopId) ?? 0) + 1)
    }

    const stops: ReportStop[] = trip.stops.map((stop) => ({
      stopNumber: stop.stopNumber,
      shopId: stop.shopId,
      shopName: nameOf(stop.shopId),
      color: colorOf(stop.shopId),
      door: stop.door,
      loadedUnits: loadedByShop.get(stop.shopId) ?? 0,
    }))

    return {
      tripId: trip.id,
      tripNumber: trip.tripNumber,
      metrics: trip.metrics,
      stops,
      deferredCargo: trip.deferredCargo.map((d) => resolveUnplaced(d, nameOf)),
      warnings: result.warnings.filter((w) => w.tripId === trip.id),
    }
  })

  const totals = {
    requestedUnits: result.trips.reduce((sum, t) => sum + t.metrics.requestedUnits, 0),
    loadedUnits: result.trips.reduce((sum, t) => sum + t.metrics.loadedUnits, 0),
    deferredUnits: result.trips.reduce((sum, t) => sum + t.metrics.deferredUnits, 0),
    unplaceableUnits: result.unplaceableCargo.length,
  }

  return {
    seed: result.seed,
    vehicleId: result.vehicleId,
    vehicleName: scenario.vehicle.name,
    tripCount: result.trips.length,
    overallScore: result.overallScore,
    elapsedMs: result.elapsedMs,
    shopLegend,
    trips,
    unplaceableCargo: result.unplaceableCargo.map((u) => resolveUnplaced(u, nameOf)),
    warnings: result.warnings.filter((w) => w.tripId === undefined),
    totals,
  }
}

function resolveUnplaced(
  item: { cargoId: string; shopId: string; reason: UnplacedReason; detail?: string },
  nameOf: (shopId: string) => string,
): ReportUnplaced {
  return {
    cargoId: item.cargoId,
    shopId: item.shopId,
    shopName: nameOf(item.shopId),
    reason: item.reason,
    detail: item.detail,
  }
}
