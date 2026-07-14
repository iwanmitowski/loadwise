import { useOptimizationStore } from '@/state/optimizationStore'
import { useScenarioStore } from '@/state/scenarioStore'
import { useUiStore } from '@/state/uiStore'
import { VehicleScene } from '@/three/VehicleScene'
import { SceneToolbar } from '@/components/simulation/SceneToolbar'

/**
 * Simulation screen — the interactive 3D view of the loaded vehicle.
 *
 * T12 lands the vehicle shell + doors + camera controls (empty cargo space).
 * Still to own here: cargo meshes (T13), loading animation (T14), stop-by-stop
 * delivery simulation + playback transport (T15).
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
      <VehicleScene vehicle={scenario.vehicle} />

      {/* View controls (walls/roof/doors/reset). */}
      <div className="pointer-events-none absolute right-4 top-4">
        <SceneToolbar />
      </div>

      {/* Trip caption — cargo + full transport arrive with T13–T15. */}
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
