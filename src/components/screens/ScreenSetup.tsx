import { useScenarioStore } from '@/state/scenarioStore'
import { useUiStore } from '@/state/uiStore'

/**
 * Setup screen — placeholder shell (T10 fills in the real config form).
 *
 * Layout slots T10 will own:
 *  - vehicle picker, side-door choice, shop-count slider, seed field
 *  - "Generate" + "Randomize seed" actions
 *  - scenario preview / shop legend once generated
 *
 * For now it exposes just enough to drive the happy path: generate a scenario,
 * then advance to planning.
 */
export function ScreenSetup() {
  const config = useScenarioStore((s) => s.config)
  const scenario = useScenarioStore((s) => s.scenario)
  const generate = useScenarioStore((s) => s.generate)
  const randomizeSeed = useScenarioStore((s) => s.randomizeSeed)
  const goTo = useUiStore((s) => s.goTo)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div>
        <h2 className="text-xl font-semibold">Set up scenario</h2>
        <p className="mt-1 text-sm text-slate-400">
          Placeholder — the real configuration form arrives in T10.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 rounded-lg bg-slate-900 p-4 text-sm">
        <dt className="text-slate-400">Vehicle</dt>
        <dd>{config.vehicleId}</dd>
        <dt className="text-slate-400">Side door</dt>
        <dd>{config.sideDoor}</dd>
        <dt className="text-slate-400">Shops</dt>
        <dd>{config.shopCount}</dd>
        <dt className="text-slate-400">Seed</dt>
        <dd className="font-mono">{config.seed}</dd>
      </dl>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={randomizeSeed}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
        >
          Randomize seed
        </button>
        <button
          type="button"
          onClick={generate}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
        >
          Generate scenario
        </button>
        {scenario && (
          <button
            type="button"
            onClick={() => goTo('planning')}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
          >
            Continue to planning →
          </button>
        )}
      </div>

      {scenario && (
        <p className="text-sm text-emerald-400">
          Scenario ready: {scenario.shops.length} shop(s) on the{' '}
          {scenario.vehicle.name}.
        </p>
      )}
    </div>
  )
}
