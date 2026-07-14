import type { SideDoorChoice } from '@/types'

type Props = {
  value: SideDoorChoice
  onChange(choice: SideDoorChoice): void
}

const OPTIONS: { value: SideDoorChoice; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
]

/**
 * Side-door radio group. Each option carries a top-view mini diagram (rear door
 * at the bottom edge — the viewer stands behind the vehicle looking toward the
 * cabin, matching the domain's +X left→right convention) with that option's
 * side door marked on its wall.
 */
export function SideDoorPicker({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Side door" className="flex gap-3">
      {OPTIONS.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={[
              'flex flex-col items-center gap-2 rounded-lg border px-4 py-3 transition-colors',
              selected
                ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500'
                : 'border-slate-800 bg-slate-900 hover:border-slate-600',
            ].join(' ')}
          >
            <TopViewDiagram sideDoor={option.value} />
            <span className="text-sm">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Top view: cargo box with the rear-door gap at the bottom, side door marked. */
function TopViewDiagram({ sideDoor }: { sideDoor: SideDoorChoice }) {
  return (
    <svg viewBox="0 0 40 56" aria-hidden="true" className="h-14 w-10 text-slate-500">
      {/* cargo space outline */}
      <rect
        x="6"
        y="4"
        width="28"
        height="48"
        rx="2"
        className="fill-slate-800 stroke-current"
        strokeWidth="1.5"
      />
      {/* rear door: gap in the bottom wall */}
      <line x1="13" y1="52" x2="27" y2="52" className="stroke-slate-950" strokeWidth="3" />
      <line x1="13" y1="52" x2="27" y2="52" className="stroke-indigo-400" strokeWidth="1.5" strokeDasharray="2 2" />
      {/* side door on the chosen wall */}
      {sideDoor !== 'none' && (
        <line
          x1={sideDoor === 'left' ? 6 : 34}
          y1="20"
          x2={sideDoor === 'left' ? 6 : 34}
          y2="36"
          className="stroke-indigo-400"
          strokeWidth="3"
        />
      )}
    </svg>
  )
}
