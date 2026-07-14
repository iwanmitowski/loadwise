// Deferred cargo for the selected trip: items moved to a later trip. Destination
// trip is derived in the UI (T16) by locating each item's eventual placement.

import type { ReportUnplaced } from '@/features/reports/reportModel'
import { destinationLabel, REASON_LABEL } from './reportView'

export function DeferredTable({
  items,
  templateNames,
  tripByCargo,
}: {
  items: ReportUnplaced[]
  templateNames: Map<string, string>
  tripByCargo: Map<string, number>
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-400">
        No cargo deferred from this trip.
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
            <th className="px-3 py-2 font-medium">Destination</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {items.map((item) => (
            <tr key={item.cargoId} className="text-slate-200">
              <td className="px-3 py-2">
                {templateNames.get(item.cargoId) ?? item.cargoId}
              </td>
              <td className="px-3 py-2 text-slate-300">{item.shopName}</td>
              <td className="px-3 py-2 text-slate-300">{REASON_LABEL[item.reason]}</td>
              <td className="px-3 py-2 font-medium text-amber-300">
                {destinationLabel(item.cargoId, tripByCargo)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
