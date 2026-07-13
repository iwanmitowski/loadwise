import { useOptimizationStore } from '@/state/optimizationStore'

/**
 * Report screen — placeholder shell (T16 fills in the real report).
 *
 * Layout slots to own later:
 *  - overall score + per-trip metric cards
 *  - warnings list, unplaceable/deferred cargo breakdown
 *  - export / share actions
 */
export function ScreenReport() {
  const result = useOptimizationStore((s) => s.result)

  if (!result) {
    return (
      <div className="p-8 text-sm text-slate-400">
        No optimization result yet — run the optimizer on the Planning screen.
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <div>
        <h2 className="text-xl font-semibold">Report</h2>
        <p className="mt-1 text-sm text-slate-400">
          Placeholder — the full report arrives with T16.
        </p>
      </div>
      <div className="rounded-lg bg-slate-900 p-4 text-sm">
        Overall score: <span className="font-semibold">{result.overallScore}</span> ·{' '}
        {result.trips.length} trip(s) · {result.warnings.length} warning(s) ·{' '}
        {result.unplaceableCargo.length} unplaceable
      </div>
    </div>
  )
}
