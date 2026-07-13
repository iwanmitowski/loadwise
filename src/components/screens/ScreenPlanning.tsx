import { useOptimizationStore } from '@/state/optimizationStore'
import { useScenarioStore } from '@/state/scenarioStore'
import { useUiStore } from '@/state/uiStore'

/**
 * Planning screen — placeholder shell (T10 + Track B fill in the real content).
 *
 * Layout slots to own later:
 *  - 3D loading preview (Track B) as the primary panel
 *  - trip selector, shop legend/filter, cargo list
 *  - optimize / cancel controls with a live progress bar
 *
 * For now it drives the happy path: run the (fixture-backed) optimizer and, once
 * a result exists, advance to simulation or report.
 */
export function ScreenPlanning() {
  const scenario = useScenarioStore((s) => s.scenario)
  const { status, progress, result, run, cancel } = useOptimizationStore()
  const goTo = useUiStore((s) => s.goTo)

  if (!scenario) {
    return (
      <div className="p-8 text-sm text-slate-400">
        No scenario yet — generate one on the Setup screen.
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div>
        <h2 className="text-xl font-semibold">Plan the load</h2>
        <p className="mt-1 text-sm text-slate-400">
          Placeholder — the 3D loading view and controls arrive with Track B / T10.
        </p>
      </div>

      <div className="rounded-lg bg-slate-900 p-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="text-slate-400">Optimizer:</span>
          <span className="font-medium">{status}</span>
          {progress && (
            <span className="text-slate-400">
              {progress.stage} ({progress.percent}%)
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => run(scenario)}
          disabled={status === 'running'}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          Optimize
        </button>
        {status === 'running' && (
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Cancel
          </button>
        )}
      </div>

      {result && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-emerald-400">
            {result.trips.length} trip(s), score {result.overallScore}.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => goTo('simulation')}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
            >
              View simulation →
            </button>
            <button
              type="button"
              onClick={() => goTo('report')}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              View report →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
