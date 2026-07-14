// Big color-graded score badge (0–100). Used for the overall header score and,
// smaller, for the per-trip score. Score is clamped 0–100 by T08.

import { scoreBand } from './reportView'

const BAND_CLASS: Record<'low' | 'mid' | 'high', string> = {
  low: 'border-red-500/50 bg-red-500/15 text-red-300',
  mid: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
  high: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
}

export function ScoreBadge({
  score,
  size = 'lg',
  label,
}: {
  score: number
  size?: 'lg' | 'sm'
  /** Screen-reader label. Omit when an adjacent visible label already names it. */
  label?: string
}) {
  const band = scoreBand(score)
  const big = size === 'lg'
  return (
    <div
      className={[
        'flex flex-col items-center justify-center rounded-xl border',
        BAND_CLASS[band],
        big ? 'h-24 w-24' : 'h-16 w-16',
      ].join(' ')}
    >
      <span
        className={['font-bold tabular-nums', big ? 'text-3xl' : 'text-xl'].join(' ')}
      >
        {score}
      </span>
      <span className={['opacity-80', big ? 'text-xs' : 'text-[10px]'].join(' ')}>
        / 100
      </span>
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  )
}
