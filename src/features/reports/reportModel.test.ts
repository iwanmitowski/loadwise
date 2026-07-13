import { describe, expect, it } from 'vitest'
import { demoResult, demoScenario } from '@/fixtures/demo'
import { buildReportModel, SHOP_PALETTE } from './reportModel'

describe('buildReportModel', () => {
  const model = buildReportModel(demoResult, demoScenario)

  it('resolves vehicle and trip-count metadata', () => {
    expect(model.vehicleName).toBe('Box truck')
    expect(model.tripCount).toBe(1)
    expect(model.overallScore).toBe(demoResult.overallScore)
  })

  it('assigns a distinct palette color per shop by generation order', () => {
    expect(model.shopLegend.map((s) => s.shopId)).toEqual(['shop-1', 'shop-2', 'shop-3'])
    expect(model.shopLegend.map((s) => s.color)).toEqual([
      SHOP_PALETTE[0],
      SHOP_PALETTE[1],
      SHOP_PALETTE[2],
    ])
    expect(new Set(model.shopLegend.map((s) => s.color)).size).toBe(3)
  })

  it('resolves stops with shop names, colors and per-stop loaded counts', () => {
    const stops = model.trips[0].stops
    expect(stops.map((s) => s.shopName)).toEqual(['Volt Hub', 'Hop Cellar', 'Metro Market'])
    // shop-3 loads 4 units, shop-2 loads 3, shop-1 loads 2 (see demo layout).
    expect(stops.map((s) => s.loadedUnits)).toEqual([4, 3, 2])
    expect(stops[0].color).toBe(SHOP_PALETTE[2]) // shop-3
  })

  it('resolves deferred cargo with its shop name', () => {
    const deferred = model.trips[0].deferredCargo
    expect(deferred).toHaveLength(1)
    expect(deferred[0].cargoId).toBe('shop-2-c4')
    expect(deferred[0].shopName).toBe('Hop Cellar')
  })

  it('rolls up unit totals', () => {
    expect(model.totals).toEqual({
      requestedUnits: 10,
      loadedUnits: 9,
      deferredUnits: 1,
      unplaceableUnits: 0,
    })
  })

  it('partitions warnings: trip-scoped stay on the trip, result-level float up', () => {
    expect(model.warnings).toEqual([]) // the demo's only warning is trip-scoped
    expect(model.trips[0].warnings.map((w) => w.code)).toEqual(['deferred-cargo'])
  })
})
