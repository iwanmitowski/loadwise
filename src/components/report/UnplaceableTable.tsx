// Permanently unplaceable cargo (result-level): items no trip could ever take.
// Reason renders as a chip; detail carries T08's plain-language explanation.

import type { ReportUnplaced } from '@/features/reports/reportModel'
import { REASON_LABEL } from './reportView'

export function UnplaceableTable({
  items,
  templateNames,
}: {
  items: ReportUnplaced[]
  templateNames: Map<string, string>
}) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-400">
        <span className="text-emerald-400">✓</span> All cargo was placed.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2 font-medium">Item</th>
            <th className="px-3 py-2 font-medium">Shop</th>
            <th className="px-3 py-2 font-medium">Reason</th>
            <th className="px-3 py-2 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {items.map((item) => (
            <tr key={item.cargoId} className="align-top text-slate-200">
              <td className="px-3 py-2">
                {templateNames.get(item.cargoId) ?? item.cargoId}
              </td>
              <td className="px-3 py-2 text-slate-300">{item.shopName}</td>
              <td className="px-3 py-2">
                <span className="inline-block whitespace-nowrap rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300">
                  {REASON_LABEL[item.reason]}
                </span>
              </td>
              <td className="px-3 py-2 text-slate-400">{item.detail ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
