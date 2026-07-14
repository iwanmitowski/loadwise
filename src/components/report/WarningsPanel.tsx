// Warnings list. Text comes verbatim from T08 (plain-language, math-explaining);
// this only picks the severity icon/color per warning code.

import type { OptimizationWarning } from '@/types'
import { warningSeverity } from './reportView'

export function WarningsPanel({ warnings }: { warnings: OptimizationWarning[] }) {
  if (warnings.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-400">
        <span className="text-emerald-400">✓</span> No warnings for this trip.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {warnings.map((w, i) => {
        const error = warningSeverity(w.code) === 'error'
        return (
          <li
            key={`${w.code}-${i}`}
            className={[
              'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
              error
                ? 'border-red-500/40 bg-red-500/10 text-red-200'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-200',
            ].join(' ')}
          >
            <span aria-hidden className="mt-0.5">
              {error ? '⛔' : '⚠'}
            </span>
            <span>{w.message}</span>
          </li>
        )
      })}
    </ul>
  )
}
