// Export the raw scenario and optimization result as pretty JSON (T03's
// downloadJson). Re-importable — `JSON.parse` round-trips cleanly (both are
// plain data). Filenames carry the seed for traceability.

import type { OptimizationResult, Scenario } from '@/types'
import { downloadJson } from '@/utils/download'

export function ExportButtons({
  scenario,
  result,
}: {
  scenario: Scenario
  result: OptimizationResult
}) {
  const seed = result.seed || 'scenario'
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => downloadJson(`loadwise-scenario-${seed}.json`, scenario)}
        className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
      >
        Scenario JSON
      </button>
      <button
        type="button"
        onClick={() => downloadJson(`loadwise-result-${seed}.json`, result)}
        className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
      >
        Result JSON
      </button>
    </div>
  )
}
