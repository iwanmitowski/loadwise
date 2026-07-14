import { useOptimizationStore } from '@/state/optimizationStore'
import { useScenarioStore } from '@/state/scenarioStore'
import { useUiStore } from '@/state/uiStore'
import { VehicleScene } from '@/three/VehicleScene'
import { CargoLayer } from '@/three/CargoLayer'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SceneToolbar } from '@/components/simulation/SceneToolbar'
import { CargoInfoPanel } from '@/components/simulation/CargoInfoPanel'
import { PlaybackControls } from '@/components/simulation/PlaybackControls'
import { DeliveryPanel } from '@/components/simulation/DeliveryPanel'
import { TripSelector } from '@/components/simulation/TripSelector'
import { ShopLegend } from '@/components/simulation/ShopLegend'

/**
 * Simulation screen — the interactive 3D view of the loaded vehicle.
 *
 * T12 lands the vehicle shell + doors + camera controls (empty cargo space).
 * T13 adds the cargo layer (boxes, selection, filter, CoM) + info panel.
 * T14 adds the loading-animation replay + transport; T15 the stop-by-stop
 * delivery simulation (route HUD, blockers, per-stop choreography).
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

  // Nothing was loadable (all cargo permanently unplaceable, or no valid
  // placement): still render the empty vehicle shell, but with an explaining
  // overlay instead of a blank scene (idea.md edge case).
  const nothingLoaded = !trip || trip.placements.length === 0

  return (
    <div className="relative h-full w-full">
      <ErrorBoundary label="VehicleScene" fallback={(reset) => <SceneFailed onReload={reset} />}>
        <VehicleScene vehicle={scenario.vehicle}>
          {trip ? (
            // key by trip id so switching trips remounts the cargo cleanly.
            <CargoLayer key={trip.id} trip={trip} scenario={scenario} />
          ) : null}
        </VehicleScene>
      </ErrorBoundary>

      {nothingLoaded ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
          <div className="pointer-events-auto max-w-sm rounded-lg border border-slate-700/70 bg-slate-900/85 p-5 text-center text-sm text-slate-300 backdrop-blur">
            <p className="text-base font-semibold text-slate-100">Nothing could be loaded</p>
            <p className="mt-1">
              No cargo could be placed in this vehicle. Check the report for why,
              or try a larger vehicle or a new scenario.
            </p>
          </div>
        </div>
      ) : null}

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

      {/* Playback transports: loading replay (T14) + delivery route (T15).
          In idle both entry buttons sit side by side; in either mode only the
          active transport renders. */}
      {trip && !nothingLoaded ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-end gap-2">
          <PlaybackControls itemCount={trip.placements.length} />
          <DeliveryPanel trip={trip} scenario={scenario} />
        </div>
      ) : null}

      {/* Trip selector + shop legend (shared with the Report screen). */}
      <div className="pointer-events-auto absolute left-4 top-4 flex w-56 flex-col gap-3 rounded-lg border border-slate-700/60 bg-slate-900/75 p-3 text-sm text-slate-200 backdrop-blur">
        <span className="font-semibold">{scenario.vehicle.name}</span>
        {result.trips.length > 1 ? <TripSelector trips={result.trips} /> : null}
        {trip ? (
          <ShopLegend
            trip={trip}
            scenario={scenario}
            alsoWarnShopIds={result.unplaceableCargo.map((u) => u.shopId)}
          />
        ) : null}
      </div>
    </div>
  )
}

/** Fallback when the 3D canvas throws (WebGL unavailable, R3F error, …). */
function SceneFailed({ onReload }: { onReload: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-5 text-center text-sm text-slate-300">
        <p className="text-base font-semibold text-slate-100">3D view failed to load</p>
        <p className="mt-1">
          The interactive scene couldn’t start (your browser may not support
          WebGL). The rest of the app still works — the report has the full plan.
        </p>
        <button
          type="button"
          onClick={onReload}
          className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Reload 3D view
        </button>
      </div>
    </div>
  )
}
