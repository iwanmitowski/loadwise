// Trip selector tabs — shared by the Simulation and Report screens. Bound to
// `uiStore.selectedTripId`; each tab carries a micro-summary (stops · units ·
// weight%) so the user can compare trips at a glance. Reads straight off the
// trips array (metrics come from T08) — the UI does no math here.

import type { DeliveryTrip } from '@/types'
import { useUiStore } from '@/state/uiStore'
import { fmtPctSafe } from '@/utils/format'

/**
 * Renders one tab per trip. A single trip still renders (a lone "Trip 1" tab)
 * so both screens have a consistent header; callers may choose to hide it.
 */
export function TripSelector({ trips }: { trips: DeliveryTrip[] }) {
  const selectedTripId = useUiStore((s) => s.selectedTripId)
  const setSelectedTrip = useUiStore((s) => s.setSelectedTrip)

  if (trips.length === 0) return null

  // Fall back to the first trip when nothing (or a stale id) is selected, so a
  // tab always reads as active.
  const activeId = trips.some((t) => t.id === selectedTripId)
    ? selectedTripId
    : trips[0].id

  return (
    <div role="tablist" aria-label="Trips" className="flex flex-wrap gap-2">
      {trips.map((trip) => {
        const active = trip.id === activeId
        return (
          <button
            key={trip.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setSelectedTrip(trip.id)}
            className={[
              'flex flex-col items-start rounded-md border px-3 py-1.5 text-left transition',
              active
                ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                : 'border-slate-700/60 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50',
            ].join(' ')}
          >
            <span className="text-sm font-medium">Trip {trip.tripNumber}</span>
            <span className="text-[11px] tabular-nums text-slate-400">
              {trip.stops.length} stop{trip.stops.length === 1 ? '' : 's'} ·{' '}
              {trip.metrics.loadedUnits} unit{trip.metrics.loadedUnits === 1 ? '' : 's'} ·{' '}
              {fmtPctSafe(trip.metrics.weightUtilization)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
