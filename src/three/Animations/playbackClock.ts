// Shared mutable clocks for the playback animations. The animators advance
// them inside useFrame (no React state per frame — see T14 prompt); HUD
// overlays read them on a rAF loop and sync a throttled fraction into local
// state; the Doors read the delivery door set per frame. Module singletons are
// enough: at most one animation of each kind runs at a time.

import type { DoorSide } from '@/types'

export type PlaybackClock = {
  /** Timeline seconds elapsed (speed already applied). */
  t: number
  /** Timeline length in seconds at speed 1 × count; 0 = nothing to play. */
  duration: number
}

export const loadingClock: PlaybackClock = { t: 0, duration: 0 }

/** Rewind to the start; optionally (re)declare the timeline length. */
export function resetLoadingClock(duration?: number): void {
  loadingClock.t = 0
  if (duration !== undefined) loadingClock.duration = duration
}

/**
 * Per-STOP clock for the delivery simulation (T15): `t`/`duration` cover the
 * current stop's choreography, not the whole route (the stop index lives in
 * `uiStore.playback.index`). `openDoors` is written by the DeliveryAnimator
 * each frame and read by the Doors' own useFrame — doors track it smoothly
 * without any React state.
 */
export const deliveryClock: PlaybackClock & { openDoors: DoorSide[] } = {
  t: 0,
  duration: 0,
  openDoors: [],
}

/** Rewind the current stop; optionally (re)declare its length. */
export function resetDeliveryClock(duration?: number): void {
  deliveryClock.t = 0
  if (duration !== undefined) deliveryClock.duration = duration
  deliveryClock.openDoors = []
}

/** Fraction of the timeline elapsed, clamped to [0, 1]. */
export function clockFraction(clock: PlaybackClock): number {
  if (clock.duration <= 0) return 0
  return Math.min(1, clock.t / clock.duration)
}
