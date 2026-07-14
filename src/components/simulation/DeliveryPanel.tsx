// Delivery-simulation HUD + transport (T15), overlaid on the simulation screen.
// Idle: a single "Simulate route" entry point (next to the loading replay).
// Delivery mode: stop card (shop, door, units, blockers), running extra-moves
// counter that matches the report's `extraUnloadingMoves` (both numbers come
// from the same route plan / findBlockers rule), remaining stops, and the
// transport: play/pause, Next stop, Auto-play toggle, Restart route, speed,
// Exit, plus a thin per-stop progress bar.
//
// Loading mode (T14) has its own transport — this renders nothing then.

import { useMemo } from 'react'
import type { DeliveryTrip, Scenario } from '@/types'
import { useUiStore, type PlaybackSpeed } from '@/state/uiStore'
// Direct module imports (not the Animations barrel) keep @react-three/fiber
// out of non-canvas bundles and jsdom tests.
import { buildRoutePlan } from '@/three/Animations/deliveryTimeline'
import { deliveryClock, resetDeliveryClock } from '@/three/Animations/playbackClock'
import { shopColorById } from '@/utils/shopColors'
import { TransportButton } from './PlaybackControls'
import { useClockFraction } from './useClockFraction'

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 4]
const DOOR_LABEL = { rear: 'Rear door', left: 'Left side door', right: 'Right side door' } as const

export function DeliveryPanel({ trip, scenario }: { trip: DeliveryTrip; scenario: Scenario }) {
  const playback = useUiStore((s) => s.playback)
  const setPlayback = useUiStore((s) => s.setPlayback)
  const fraction = useClockFraction(deliveryClock, playback.mode === 'delivery')

  const plan = useMemo(() => buildRoutePlan(trip, scenario), [trip, scenario])
  const shopById = useMemo(
    () => new Map(scenario.shops.map((s) => [s.id, s])),
    [scenario],
  )
  const shopIds = useMemo(() => scenario.shops.map((s) => s.id), [scenario])

  // T14's transport owns the loading mode.
  if (playback.mode === 'loading') return null

  const startRoute = () => {
    resetDeliveryClock()
    setPlayback({ mode: 'delivery', playing: true, index: 0 })
  }

  if (playback.mode === 'idle') {
    if (plan.stops.length === 0) return null
    return (
      <div className="pointer-events-auto">
        <button
          type="button"
          onClick={startRoute}
          title="Simulate the delivery route stop by stop"
          className="rounded-md border border-emerald-400/60 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 backdrop-blur transition hover:bg-emerald-500/30"
        >
          🚚 Simulate route
        </button>
      </div>
    )
  }

  const stopIndex = Math.min(playback.index, plan.stops.length - 1)
  const stop = plan.stops[stopIndex]
  const shop = shopById.get(stop.shopId)
  const color = shopColorById(stop.shopId, shopIds)
  const isLastStop = stopIndex >= plan.stops.length - 1
  const stopComplete = fraction >= 1
  const routeComplete = isLastStop && stopComplete

  // Running total of temporary moves up to and including the current stop —
  // summed the same per-stop-distinct way as metrics.extraUnloadingMoves, so
  // after the last stop this equals the report figure exactly.
  const movesSoFar = plan.stops
    .slice(0, stopIndex + 1)
    .reduce((sum, s) => sum + s.blockerIds.length, 0)
  const remainingStops = plan.stops.slice(stopIndex + 1)

  const advance = () => {
    if (isLastStop) return
    resetDeliveryClock()
    setPlayback({ index: stopIndex + 1, playing: true })
  }

  const restart = () => {
    resetDeliveryClock()
    setPlayback({ index: 0, playing: true })
  }

  const toggleAutoPlay = () => {
    // Turning auto-play on while waiting at a finished stop resumes the route.
    setPlayback(
      playback.autoPlay ? { autoPlay: false } : { autoPlay: true, playing: true },
    )
  }

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(playback.speed) + 1) % SPEEDS.length]
    setPlayback({ speed: next })
  }

  const exit = () => setPlayback({ mode: 'idle', playing: false, index: 0 })

  return (
    <div className="pointer-events-auto flex w-[26rem] flex-col gap-2 rounded-md border border-slate-700/60 bg-slate-900/80 px-4 py-3 backdrop-blur">
      {/* Stop card */}
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="truncate font-semibold text-slate-100">
          {shop?.name ?? stop.shopId}
        </span>
        <span className="ml-auto shrink-0 text-sm tabular-nums text-slate-400">
          stop {stop.stopNumber} / {plan.stops.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
        <span>{DOOR_LABEL[stop.door]}</span>
        <span>
          Unloading <span className="font-medium text-slate-100">{stop.deliverIds.length}</span>{' '}
          unit(s)
        </span>
        {stop.blockerIds.length > 0 ? (
          <span className="text-amber-300">
            {stop.blockerIds.length} item(s) moved temporarily
          </span>
        ) : null}
        <span>
          Extra moves:{' '}
          <span className="font-medium text-slate-100">{movesSoFar}</span>
          <span className="text-slate-500"> / {plan.extraMovesTotal} route total</span>
        </span>
      </div>

      {routeComplete ? (
        <p className="text-sm font-medium text-emerald-300">
          Route complete — all cargo delivered.
        </p>
      ) : remainingStops.length > 0 ? (
        <p className="truncate text-sm text-slate-400">
          Remaining:{' '}
          {remainingStops
            .map((s) => `${s.stopNumber}. ${shopById.get(s.shopId)?.name ?? s.shopId}`)
            .join(' · ')}
        </p>
      ) : null}

      {/* Transport */}
      <div className="flex items-center gap-2">
        <TransportButton
          label={playback.playing ? '⏸' : '▶'}
          title={playback.playing ? 'Pause simulation' : 'Resume simulation'}
          onClick={() => setPlayback({ playing: !playback.playing })}
        />
        <TransportButton
          label="Next stop ⏭"
          title={isLastStop ? 'This is the last stop' : 'Advance to the next stop'}
          onClick={advance}
        />
        <TransportButton
          label="Auto"
          title="Auto-play: advance stops automatically"
          onClick={toggleAutoPlay}
          active={playback.autoPlay}
        />
        <TransportButton label="⟲" title="Restart route" onClick={restart} />
        <TransportButton
          label={`${playback.speed}×`}
          title="Cycle playback speed"
          onClick={cycleSpeed}
        />
        <span className="grow" />
        <TransportButton label="✕" title="Exit route simulation" onClick={exit} />
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        aria-label="Stop progress"
        className="h-1 w-full overflow-hidden rounded-full bg-slate-700/70"
      >
        <div
          className="h-full rounded-full bg-emerald-400 transition-[width] duration-100 ease-linear"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  )
}
