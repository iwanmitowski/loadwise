// Shop legend — shared by the Simulation and Report screens. One row per shop in
// the selected trip: color dot + stop number + name. Clicking a row toggles
// `uiStore.shopFilter`, which dims non-matching cargo in the 3D scene (T13).
// Colors come from the same `shopColorById` the 3D layer uses, so a legend dot
// always matches its boxes. Shops with deferred/unplaced items get a ⚠ badge.

import { useMemo } from 'react'
import type { DeliveryTrip, Scenario } from '@/types'
import { useUiStore } from '@/state/uiStore'
import { shopColorById } from '@/utils/shopColors'

type ShopLegendProps = {
  trip: DeliveryTrip
  scenario: Scenario
  /**
   * Extra shop ids to flag with the ⚠ badge on top of this trip's own deferred
   * cargo — the Report screen passes shops with permanently unplaceable items.
   */
  alsoWarnShopIds?: readonly string[]
}

type LegendRow = {
  shopId: string
  name: string
  color: string
  stopNumber: number
  warn: boolean
}

export function ShopLegend({ trip, scenario, alsoWarnShopIds }: ShopLegendProps) {
  const shopFilter = useUiStore((s) => s.shopFilter)
  const setShopFilter = useUiStore((s) => s.setShopFilter)

  const rows = useMemo<LegendRow[]>(() => {
    const shopIds = scenario.shops.map((s) => s.id)
    const nameById = new Map(scenario.shops.map((s) => [s.id, s.name]))
    const warnIds = new Set<string>(alsoWarnShopIds ?? [])
    for (const d of trip.deferredCargo) warnIds.add(d.shopId)

    return [...trip.stops]
      .sort((a, b) => a.stopNumber - b.stopNumber)
      .map((stop) => ({
        shopId: stop.shopId,
        name: nameById.get(stop.shopId) ?? stop.shopId,
        color: shopColorById(stop.shopId, shopIds),
        stopNumber: stop.stopNumber,
        warn: warnIds.has(stop.shopId),
      }))
  }, [trip, scenario, alsoWarnShopIds])

  if (rows.length === 0) return null

  const toggle = (shopId: string) =>
    setShopFilter(shopFilter === shopId ? null : shopId)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Shops
        </span>
        {shopFilter !== null && (
          <button
            type="button"
            onClick={() => setShopFilter(null)}
            className="text-xs text-slate-400 underline-offset-2 hover:text-slate-100 hover:underline"
          >
            clear filter
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => {
          const active = shopFilter === row.shopId
          const dimmed = shopFilter !== null && !active
          return (
            <li key={row.shopId}>
              <button
                type="button"
                onClick={() => toggle(row.shopId)}
                aria-pressed={active}
                title={active ? 'Clear filter' : `Filter to ${row.name}`}
                className={[
                  'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition',
                  active
                    ? 'bg-slate-700/70 text-slate-100 ring-1 ring-inset ring-slate-500/60'
                    : 'text-slate-300 hover:bg-slate-800/70',
                  dimmed ? 'opacity-50' : '',
                ].join(' ')}
              >
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-white/20"
                  style={{ backgroundColor: row.color }}
                />
                <span className="w-6 shrink-0 tabular-nums text-slate-500">
                  #{row.stopNumber}
                </span>
                <span className="flex-1 truncate">{row.name}</span>
                {row.warn && (
                  <span
                    title="Some items for this shop were deferred or could not be placed"
                    className="shrink-0 text-amber-400"
                  >
                    ⚠
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
