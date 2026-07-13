import type { Screen } from '@/state/uiStore'
import { useUiStore } from '@/state/uiStore'
import { useScenarioStore } from '@/state/scenarioStore'
import { useOptimizationStore } from '@/state/optimizationStore'
import { isScreenEnabled, SCREEN_ORDER } from '@/state/navigation'

const LABELS: Record<Screen, string> = {
  setup: 'Setup',
  planning: 'Planning',
  simulation: 'Simulation',
  report: 'Report',
}

/**
 * App header: name + screen stepper. Steps gate on prerequisites —
 * planning needs a scenario; simulation and report need an optimization result.
 */
export function AppHeader() {
  const screen = useUiStore((s) => s.screen)
  const goTo = useUiStore((s) => s.goTo)
  const hasScenario = useScenarioStore((s) => s.scenario !== null)
  const hasResult = useOptimizationStore((s) => s.result !== null)

  const isEnabled = (target: Screen): boolean =>
    isScreenEnabled(target, { hasScenario, hasResult })

  return (
    <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
      <div className="flex items-baseline gap-3">
        <span className="text-lg font-semibold tracking-tight">LoadWise</span>
        <span className="hidden text-xs text-slate-500 sm:inline">
          cargo load planner
        </span>
      </div>
      <nav className="flex items-center gap-1">
        {SCREEN_ORDER.map((target, i) => {
          const enabled = isEnabled(target)
          const active = screen === target
          return (
            <div key={target} className="flex items-center">
              {i > 0 && <span className="mx-1 text-slate-600">›</span>}
              <button
                type="button"
                disabled={!enabled}
                onClick={() => goTo(target)}
                aria-current={active ? 'step' : undefined}
                className={[
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-indigo-600 font-medium text-white'
                    : enabled
                      ? 'text-slate-300 hover:bg-slate-800'
                      : 'cursor-not-allowed text-slate-600',
                ].join(' ')}
              >
                {LABELS[target]}
              </button>
            </div>
          )
        })}
      </nav>
    </header>
  )
}
