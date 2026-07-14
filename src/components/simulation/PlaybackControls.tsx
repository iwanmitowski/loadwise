// Loading-animation transport (T14), overlaid on the simulation screen.
// Idle: a single "Replay loading" entry point. Loading mode: play/pause,
// restart, speed cycle, "item k / N" + a thin timeline progress bar, and exit.
// Delivery mode (T15) brings its own transport — this renders nothing then.
//
// Playback state lives in uiStore.playback; the continuous timeline clock is
// the shared loadingClock (written by LoadingAnimator inside the canvas). The
// progress bar reads it on a rAF loop with a change threshold, so the HUD
// re-renders a handful of times per second, never the 3D scene.

import { useUiStore, type PlaybackSpeed } from '@/state/uiStore'
// Direct module import (not the Animations barrel) so this HUD component never
// drags @react-three/fiber into non-canvas bundles or jsdom tests.
import { loadingClock, resetLoadingClock } from '@/three/Animations/playbackClock'
import { useClockFraction } from './useClockFraction'

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 4]

/** Small transport-row button; shared with the delivery panel (T15). */
export function TransportButton({
  label,
  title,
  onClick,
  active = false,
}: {
  label: string
  title: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active || undefined}
      className={[
        'rounded-md border px-3 py-1.5 text-sm font-medium transition',
        active
          ? 'border-sky-400/60 bg-sky-500/20 text-sky-100'
          : 'border-slate-600/60 bg-slate-800/60 text-slate-200 hover:bg-slate-700/60',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

export function PlaybackControls({ itemCount }: { itemCount: number }) {
  const playback = useUiStore((s) => s.playback)
  const setPlayback = useUiStore((s) => s.setPlayback)
  const fraction = useClockFraction(loadingClock, playback.mode === 'loading')

  // T15's delivery simulation owns its own transport.
  if (playback.mode === 'delivery') return null

  const startLoading = () => {
    resetLoadingClock()
    setPlayback({ mode: 'loading', playing: true, index: 0 })
  }

  if (playback.mode === 'idle') {
    if (itemCount === 0) return null
    return (
      <div className="pointer-events-auto">
        <button
          type="button"
          onClick={startLoading}
          title="Replay how this trip is loaded"
          className="rounded-md border border-sky-400/60 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 backdrop-blur transition hover:bg-sky-500/30"
        >
          ▶ Replay loading
        </button>
      </div>
    )
  }

  const restart = () => {
    resetLoadingClock()
    setPlayback({ playing: true, index: 0 })
  }

  const togglePlay = () => {
    // Pressing play on a finished timeline replays from the start.
    if (!playback.playing && fraction >= 1) restart()
    else setPlayback({ playing: !playback.playing })
  }

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(playback.speed) + 1) % SPEEDS.length]
    setPlayback({ speed: next })
  }

  const exit = () => setPlayback({ mode: 'idle', playing: false, index: 0 })

  const currentItem = Math.min(playback.index + 1, itemCount)

  return (
    <div className="pointer-events-auto flex flex-col gap-2 rounded-md border border-slate-700/60 bg-slate-900/70 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <TransportButton
          label={playback.playing ? '⏸ Pause' : '▶ Play'}
          title={playback.playing ? 'Pause loading' : 'Resume loading'}
          onClick={togglePlay}
        />
        <TransportButton label="⟲ Restart" title="Replay from the start" onClick={restart} />
        <TransportButton
          label={`${playback.speed}×`}
          title="Cycle playback speed"
          onClick={cycleSpeed}
        />
        <span className="min-w-24 text-center text-sm tabular-nums text-slate-300">
          item {currentItem} / {itemCount}
        </span>
        <TransportButton label="✕" title="Exit loading replay" onClick={exit} />
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        className="h-1 w-full overflow-hidden rounded-full bg-slate-700/70"
      >
        <div
          className="h-full rounded-full bg-sky-400 transition-[width] duration-100 ease-linear"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  )
}
