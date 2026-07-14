import { useMemo } from 'react'
import { useOptimizationStore } from '@/state/optimizationStore'
import { useScenarioStore } from '@/state/scenarioStore'
import { useUiStore } from '@/state/uiStore'
import { buildReportModel } from '@/features/reports/reportModel'
import { validateLoad } from '@/features/optimizer/validate'
import { DEFAULT_OPTIMIZER_CONFIG } from '@/features/optimizer/config'
import { DEMO_SEED } from '@/fixtures/demoConfig'
import { SeedBadge } from '@/components/planning/SeedBadge'
import { TripSelector } from '@/components/simulation/TripSelector'
import {
  buildPlacementTripNumbers,
  buildTemplateNames,
} from '@/components/report/reportView'
import { ScoreBadge } from '@/components/report/ScoreBadge'
import { MetricGrid } from '@/components/report/MetricGrid'
import { WarningsPanel } from '@/components/report/WarningsPanel'
import { DeferredTable } from '@/components/report/DeferredTable'
import { UnplaceableTable } from '@/components/report/UnplaceableTable'
import { ExportButtons } from '@/components/report/ExportButtons'

/**
 * Optimization Report — pure presentation over T08's `buildReportModel`. The UI
 * does no metric math; it only formats, picks colors/icons, and derives each
 * deferred item's destination trip. Selected-trip view driven by the shared
 * TripSelector (also on the Simulation screen).
 */
export function ScreenReport() {
  const result = useOptimizationStore((s) => s.result)
  const scenario = useScenarioStore((s) => s.scenario)
  const selectedTripId = useUiStore((s) => s.selectedTripId)

  const model = useMemo(
    () => (result && scenario ? buildReportModel(result, scenario) : null),
    [result, scenario],
  )
  const templateNames = useMemo(
    () => (scenario ? buildTemplateNames(scenario) : new Map<string, string>()),
    [scenario],
  )
  const tripByCargo = useMemo(
    () => (result ? buildPlacementTripNumbers(result) : new Map<string, number>()),
    [result],
  )

  // Defensive re-validation (idea.md edge case): the optimizer should never
  // emit an invalid load, but if it does we surface it loudly instead of
  // rendering a wrong-but-confident report. Details go to the console.
  const violationCount = useMemo(() => {
    if (!result || !scenario) return 0
    let total = 0
    for (const trip of result.trips) {
      const violations = validateLoad(trip.placements, scenario, DEFAULT_OPTIMIZER_CONFIG)
      if (violations.length > 0) {
        total += violations.length
        console.error(`[report] Trip ${trip.tripNumber} validation failed:`, violations)
      }
    }
    return total
  }, [result, scenario])

  // Screen is gated on a result, but stay defensive.
  if (!result || !scenario || !model) {
    return (
      <div className="p-8 text-sm text-slate-400">
        No optimization result yet — run the optimizer on the Planning screen.
      </div>
    )
  }

  const selectedTrip =
    model.trips.find((t) => t.tripId === selectedTripId) ?? model.trips[0] ?? null

  // Result-level warnings apply to every trip; append the selected trip's own.
  const warnings = selectedTrip
    ? [...model.warnings, ...selectedTrip.warnings]
    : model.warnings

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-8">
      {/* Overall header */}
      <header className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <ScoreBadge score={model.overallScore} label="Overall score" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-xl font-semibold text-slate-100">{model.vehicleName}</h2>
          <p className="text-sm text-slate-400">
            {model.tripCount} trip{model.tripCount === 1 ? '' : 's'} ·{' '}
            {model.totals.loadedUnits} / {model.totals.requestedUnits} units loaded ·
            optimized in {Math.round(model.elapsedMs)} ms
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <SeedBadge seed={model.seed} />
          </div>
        </div>
        <ExportButtons scenario={scenario} result={result} />
      </header>

      {violationCount > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-red-700 bg-red-950/50 p-4 text-sm text-red-200"
        >
          <p className="font-semibold text-red-100">
            Internal validation failed ({violationCount} violation
            {violationCount === 1 ? '' : 's'})
          </p>
          <p className="mt-1 text-red-300/90">
            The plan below breaks one or more loading constraints — see the
            browser console for details. This should not happen; please report it.
          </p>
        </div>
      )}

      {/* Trip selector (selected-trip view) */}
      {model.trips.length > 0 && (
        <section className="flex flex-col gap-3">
          <TripSelector trips={result.trips} />
        </section>
      )}

      {selectedTrip ? (
        <>
          <section>
            <SectionTitle>Trip {selectedTrip.tripNumber} metrics</SectionTitle>
            <MetricGrid trip={selectedTrip} />
          </section>

          <section>
            <SectionTitle>Warnings</SectionTitle>
            <WarningsPanel warnings={warnings} />
          </section>

          <section>
            <SectionTitle>Deferred cargo</SectionTitle>
            <DeferredTable
              items={selectedTrip.deferredCargo}
              templateNames={templateNames}
              tripByCargo={tripByCargo}
            />
          </section>
        </>
      ) : null}

      {/* Unplaceable is permanent and result-level — always shown. */}
      <section>
        <SectionTitle>Unplaceable cargo</SectionTitle>
        <UnplaceableTable items={model.unplaceableCargo} templateNames={templateNames} />
      </section>

      <footer className="border-t border-slate-800 pt-4 text-xs text-slate-500">
        Deterministic report — same seed + config always reproduces this plan.
        Reproduce the built-in walkthrough any time with demo seed{' '}
        <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-300">
          {DEMO_SEED}
        </code>
        .
      </footer>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </h3>
  )
}
