import { useOptimizationStore } from '@/state/optimizationStore'
import { useUiStore } from '@/state/uiStore'

/**
 * Simulation screen — placeholder shell (Track B fills in the 3D delivery sim).
 *
 * Layout slots to own later:
 *  - full-height 3D scene with loading + stop-by-stop delivery animation
 *  - playback transport (play/pause, speed, scrubber) bound to ui.playback
 *  - trip selector + door/wall/roof view toggles
 */
export function ScreenSimulation() {
  const result = useOptimizationStore((s) => s.result)
  const selectedTripId = useUiStore((s) => s.selectedTripId)

  if (!result) {
    return (
      <div className="p-8 text-sm text-slate-400">
        No optimization result yet — run the optimizer on the Planning screen.
      </div>
    )
  }

  const trip =
    result.trips.find((t) => t.id === selectedTripId) ?? result.trips[0]

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <div>
        <h2 className="text-xl font-semibold">Delivery simulation</h2>
        <p className="mt-1 text-sm text-slate-400">
          Placeholder — the interactive 3D simulation arrives with Track B.
        </p>
      </div>
      <div className="rounded-lg bg-slate-900 p-4 text-sm">
        Trip {trip?.tripNumber} · {trip?.placements.length} placement(s) ·{' '}
        {trip?.stops.length} stop(s)
      </div>
    </div>
  )
}
