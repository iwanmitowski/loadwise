// Per-trip metric grid. Every number is read straight off T08's TripReport
// (metrics + resolved stops) — no math here. Utilizations and balances render as
// percent bars; scalar counts as labeled stat cards; the trip score keeps its
// color band via ScoreBadge.

import type { TripReport } from '@/features/reports/reportModel'
import { fmtKg, fmtM3, fmtPctSafe } from '@/utils/format'
import { ScoreBadge } from './ScoreBadge'

export function MetricGrid({ trip }: { trip: TripReport }) {
  const m = trip.metrics
  const violations = m.constraintViolations

  return (
    <div className="flex flex-col gap-5">
      {/* Utilizations & balances — percent bars, not bare numbers. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <PercentBar label="Weight utilization" ratio={m.weightUtilization} />
        <PercentBar label="Volume utilization" ratio={m.volumeUtilization} />
        <PercentBar label="Left/right balance" ratio={m.leftRightBalance} />
        {/* Longitudinal quality is axle/CoG compliance (forward loading is
            good), not a 50/50 split — so it agrees with the trip score. */}
        <PercentBar label="Load stability (axle/CoG)" ratio={m.longitudinalStability} />
      </div>

      {/* Scalar metrics. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Shops served" value={String(trip.stops.length)} />
        <StatCard label="Requested units" value={String(m.requestedUnits)} />
        <StatCard label="Loaded units" value={String(m.loadedUnits)} />
        <StatCard label="Deferred units" value={String(m.deferredUnits)} />
        <StatCard label="Total weight" value={fmtKg(m.totalWeightKg)} />
        <StatCard label="Used volume" value={fmtM3(m.usedVolumeCm3)} />
        <StatCard label="Empty volume" value={fmtM3(m.emptyVolumeCm3)} />
        <StatCard label="Blocked cargo" value={String(m.blockedCargoCount)} />
        <StatCard label="Extra unloading moves" value={String(m.extraUnloadingMoves)} />
        <StatCard label="Split shop orders" value={String(m.splitShopIds.length)} />
        <StatCard
          label="Constraint violations"
          value={String(violations)}
          danger={violations > 0}
        />
        <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
          <span className="text-xs text-slate-400">Trip score</span>
          <ScoreBadge score={m.overallScore} size="sm" />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div
      className={[
        'flex flex-col gap-1 rounded-lg border px-3 py-2',
        danger ? 'border-red-500/50 bg-red-500/10' : 'border-slate-800 bg-slate-900',
      ].join(' ')}
    >
      <span className="text-xs text-slate-400">{label}</span>
      <span
        className={[
          'text-lg font-semibold tabular-nums',
          danger ? 'text-red-300' : 'text-slate-100',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  )
}

function PercentBar({ label, ratio }: { label: string; ratio: number }) {
  const finite = Number.isFinite(ratio)
  const width = finite ? Math.min(100, Math.max(0, ratio * 100)) : 0
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-medium tabular-nums text-slate-200">
          {fmtPctSafe(ratio)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-indigo-500"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}
