import { summarizeShop } from '@/components/planning/totals'
import { fmtKg, fmtM3 } from '@/utils/format'
import type { Shop, ShopType } from '@/types'

const TYPE_LABELS: Record<ShopType, string> = {
  supermarket: 'Supermarket',
  'beverage-store': 'Beverage store',
  'electronics-store': 'Electronics store',
  'general-store': 'General store',
  warehouse: 'Warehouse',
}

type Props = {
  shop: Shop
  /** Shop color from the shared palette (see utils/shopColors). */
  color: string
}

/**
 * One shop in the planning list: color dot, name, type badge, stop position,
 * preferred door, and the requested cargo as `template × count` chips with the
 * shop's total weight/volume. Zero-cargo shops stay visible with an explicit
 * "No cargo requested" line (idea.md edge case).
 */
export function ShopCard({ shop, color }: Props) {
  const summary = summarizeShop(shop)
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span className="font-medium">{shop.name}</span>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
          {TYPE_LABELS[shop.type]}
        </span>
        <span className="ml-auto text-sm font-medium text-indigo-300">
          Stop {shop.deliveryOrder}
        </span>
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
          {shop.preferredDoor === 'rear'
            ? 'rear door'
            : `${shop.preferredDoor} side door`}
        </span>
      </div>

      {summary.units === 0 ? (
        <p className="mt-3 text-sm text-slate-500 italic">No cargo requested</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {summary.chips.map((chip) => (
              <span
                key={chip.templateId}
                className="rounded-md bg-slate-800 px-2 py-1 text-xs"
              >
                {chip.name} × {chip.count}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {summary.units} unit{summary.units === 1 ? '' : 's'} ·{' '}
            {fmtKg(summary.weightKg)} · {fmtM3(summary.volumeCm3)}
          </p>
        </>
      )}
    </div>
  )
}
