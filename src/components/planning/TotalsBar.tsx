import type { ScenarioTotals } from '@/components/planning/totals'
import { fmtKg, fmtM3, fmtPct } from '@/utils/format'

/**
 * Scenario totals vs vehicle capacity. The weight/volume bars may exceed 100%
 * of capacity — overflow renders amber instead of clipping, foreshadowing that
 * the optimizer will split the load into multiple trips.
 */
export function TotalsBar({ totals }: { totals: ScenarioTotals }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <Stat label="Shops" value={String(totals.shops)} />
        <Stat label="Units" value={String(totals.units)} />
        <Stat label="Weight" value={fmtKg(totals.weightKg)} />
        <Stat label="Volume" value={fmtM3(totals.volumeCm3)} />
      </div>
      <CapacityBar label="Weight" ratio={totals.weightRatio} />
      <CapacityBar label="Volume" ratio={totals.volumeRatio} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-slate-400">{label} </span>
      <span className="font-medium tabular-nums">{value}</span>
    </span>
  )
}

function CapacityBar({ label, ratio }: { label: string; ratio: number }) {
  const over = ratio > 1
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-14 text-slate-400">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className={['h-full rounded-full', over ? 'bg-amber-500' : 'bg-indigo-500'].join(' ')}
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>
      <span
        className={['w-12 text-right tabular-nums', over ? 'font-medium text-amber-400' : 'text-slate-400'].join(' ')}
      >
        {fmtPct(ratio)}
      </span>
      {over && <span className="text-amber-400">exceeds capacity → multiple trips</span>}
    </div>
  )
}
