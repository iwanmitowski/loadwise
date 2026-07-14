import { useOptimizationStore } from '@/state/optimizationStore'
import { useScenarioStore } from '@/state/scenarioStore'
import { useUiStore } from '@/state/uiStore'
import { VehicleScene } from '@/three/VehicleScene'
import { CargoLayer } from '@/three/CargoLayer'
import { SceneToolbar } from '@/components/simulation/SceneToolbar'
import { CargoInfoPanel } from '@/components/simulation/CargoInfoPanel'
import { PlaybackControls } from '@/components/simulation/PlaybackControls'

/**
 * Simulation screen — the interactive 3D view of the loaded vehicle.
 *
 * T12 lands the vehicle shell + doors + camera controls (empty cargo space).
 * T13 adds the cargo layer (boxes, selection, filter, CoM) + info panel.
 * T14 adds the loading-animation replay + transport. Still to own here:
 * stop-by-stop delivery simulation (T15).
 */
export function ScreenSimulation() {
  const result = useOptimizationStore((s) => s.result)
  const scenario = useScenarioStore((s) => s.scenario)
  const selectedTripId = useUiStore((s) => s.selectedTripId)

  if (!result || !scenario) {
    return (
      <div className="p-8 text-sm text-slate-400">
        No optimization result yet — run the optimizer on the Planning screen.
      </div>
    )
  }

  const trip =
    result.trips.find((t) => t.id === selectedTripId) ?? result.trips[0]

  return (
    <div className="relative h-full w-full">
      <VehicleScene vehicle={scenario.vehicle}>
        {trip ? (
          // key by trip id so switching trips remounts the cargo cleanly.
          <CargoLayer key={trip.id} trip={trip} scenario={scenario} />
        ) : null}
      </VehicleScene>

      {/* View controls (walls/roof/doors/labels/balance/reset). */}
      <div className="pointer-events-none absolute right-4 top-4">
        <SceneToolbar />
      </div>

      {/* Selected-cargo metadata. */}
      {trip ? (
        <div className="pointer-events-none absolute bottom-4 right-4">
          <CargoInfoPanel trip={trip} scenario={scenario} />
        </div>
      ) : null}

      {/* Loading-animation transport (T14). */}
      {trip ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
          <PlaybackControls itemCount={trip.placements.length} />
        </div>
      ) : null}

      {/* Trip caption — full transport arrives with T14–T15. */}
      <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 backdrop-blur">
        <span className="font-semibold">{scenario.vehicle.name}</span>
        {trip ? (
          <span className="text-slate-400">
            {' · '}Trip {trip.tripNumber} · {trip.placements.length} placement(s) ·{' '}
            {trip.stops.length} stop(s)
          </span>
        ) : null}
      </div>
    </div>
  )
}
