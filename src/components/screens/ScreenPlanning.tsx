import { useEffect, useMemo, useState } from 'react'
import { SeedBadge } from '@/components/planning/SeedBadge'
import { ShopCard } from '@/components/planning/ShopCard'
import { TotalsBar } from '@/components/planning/TotalsBar'
import { scenarioTotals, shopsByDeliveryOrder } from '@/components/planning/totals'
import { prefilterPermanents } from '@/features/optimizer/optimize'
import { useOptimizationStore } from '@/state/optimizationStore'
import { useScenarioStore } from '@/state/scenarioStore'
import { useUiStore } from '@/state/uiStore'
import { fmtDims, fmtKg } from '@/utils/format'
import { shopColorById } from '@/utils/shopColors'

/**
 * Planning View — the generated shop list in delivery order, scenario totals
 * vs vehicle capacity, and the optimize entry point. Navigates to Simulation
 * when a run this screen started finishes.
 */
export function ScreenPlanning() {
  const scenario = useScenarioStore((s) => s.scenario)
  const generate = useScenarioStore((s) => s.generate)
  const randomizeSeed = useScenarioStore((s) => s.randomizeSeed)
  const status = useOptimizationStore((s) => s.status)
  const progress = useOptimizationStore((s) => s.progress)
  const error = useOptimizationStore((s) => s.error)
  const run = useOptimizationStore((s) => s.run)
  const cancel = useOptimizationStore((s) => s.cancel)
  const goTo = useUiStore((s) => s.goTo)

  // True only between "this screen started a run" and its terminal state, so
  // revisiting Planning with an old result doesn't bounce back to Simulation.
  const [awaitingRun, setAwaitingRun] = useState(false)
  useEffect(() => {
    if (!awaitingRun) return
    if (status === 'done') {
      setAwaitingRun(false)
      goTo('simulation')
    } else if (status === 'error' || status === 'cancelled' || status === 'idle') {
      setAwaitingRun(false)
    }
  }, [awaitingRun, status, goTo])

  // Cheap pre-check (reuses T07's pre-filter): items that can't fit the vehicle
  // at all, tallied per shop for the amber pre-warning chip.
  const shopUnfit = useMemo(() => {
    const counts = new Map<string, number>()
    if (!scenario) return counts
    const { permanent } = prefilterPermanents(
      scenario.shops.flatMap((s) => s.requestedCargo),
      scenario.vehicle,
    )
    for (const p of permanent) counts.set(p.shopId, (counts.get(p.shopId) ?? 0) + 1)
    return counts
  }, [scenario])

  if (!scenario) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 p-8">
        <h2 className="text-xl font-semibold">Planning</h2>
        <p className="text-sm text-slate-400">
          No scenario yet — configure and generate one on the Setup screen.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => goTo('setup')}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            ← Back to setup
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium opacity-50"
          >
            Optimize
          </button>
        </div>
      </div>
    )
  }

  const totals = scenarioTotals(scenario)
  const shops = shopsByDeliveryOrder(scenario)
  const shopIds = scenario.shops.map((s) => s.id)
  const vehicleDoorSides = scenario.vehicle.doors.map((d) => d.side)
  const running = status === 'running'
  // No shops, or every shop requested zero cargo → nothing to optimize.
  const nothingToDeliver = totals.units === 0

  const onOptimize = () => {
    run(scenario)
    setAwaitingRun(true)
  }

  // Same config, fresh random seed. generate() resets the UI back to the setup
  // screen (new-scenario semantics), so hop straight back onto planning.
  const onRegenerate = () => {
    randomizeSeed()
    generate()
    goTo('planning')
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-xl font-semibold">Planning</h2>
          <p className="mt-1 text-sm text-slate-400">
            {scenario.vehicle.name} · {fmtDims(scenario.vehicle.cargoSpace)} ·
            payload {fmtKg(scenario.vehicle.maxPayloadKg)}
          </p>
        </div>
        <SeedBadge seed={scenario.config.seed} />
      </div>

      <TotalsBar totals={totals} />

      {nothingToDeliver && (
        <div
          role="status"
          className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300"
        >
          <p className="font-medium text-slate-100">Nothing to deliver</p>
          <p className="mt-1 text-slate-400">
            No shop requested any cargo. Regenerate the scenario to get a
            deliverable load.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-3" aria-label="Shops in delivery order">
        {shops.map((shop) => (
          <li key={shop.id}>
            <ShopCard
              shop={shop}
              color={shopColorById(shop.id, shopIds)}
              vehicleDoorSides={vehicleDoorSides}
              unfittableCount={shopUnfit.get(shop.id) ?? 0}
            />
          </li>
        ))}
      </ul>

      {running && (
        <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between text-sm">
            <span>{progress?.stage ?? 'Optimizing…'}</span>
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress?.percent ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
          >
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width]"
              style={{ width: `${progress?.percent ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {status === 'error' && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300"
        >
          <span>Optimization failed: {error ?? 'unknown error'}</span>
          <button
            type="button"
            onClick={onOptimize}
            className="rounded-md border border-red-800 px-3 py-1.5 text-xs hover:bg-red-900/40"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-5">
        <button
          type="button"
          onClick={onOptimize}
          disabled={running || nothingToDeliver}
          title={nothingToDeliver ? 'Nothing to deliver — regenerate the scenario first' : undefined}
          className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Optimize
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={running}
          className="rounded-md border border-slate-700 px-4 py-2.5 text-sm hover:bg-slate-800 disabled:opacity-50"
        >
          Regenerate
        </button>
        <button
          type="button"
          onClick={() => goTo('setup')}
          disabled={running}
          className="rounded-md border border-slate-700 px-4 py-2.5 text-sm hover:bg-slate-800 disabled:opacity-50"
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
