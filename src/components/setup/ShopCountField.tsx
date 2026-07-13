import { MAX_SHOP_COUNT, MIN_SHOP_COUNT } from '@/features/scenario/profiles'

type Props = {
  value: number
  onChange(count: number): void
}

/** Shop-count slider (3–8) with the current value always visible. */
export function ShopCountField({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-4">
      <input
        type="range"
        min={MIN_SHOP_COUNT}
        max={MAX_SHOP_COUNT}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Number of shops"
        className="w-48 accent-indigo-500"
      />
      <span className="w-16 text-sm tabular-nums">
        <span className="text-lg font-semibold">{value}</span>{' '}
        <span className="text-slate-400">shops</span>
      </span>
    </div>
  )
}
