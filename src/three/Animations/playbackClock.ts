// Shared mutable clock for the loading timeline. The animation advances it
// inside useFrame (no React state per frame — see T14 prompt); the HUD overlay
// reads it on a rAF loop and syncs a throttled fraction into local state. A
// module singleton is enough: at most one loading animation runs at a time.

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

/** Fraction of the timeline elapsed, clamped to [0, 1]. */
export function clockFraction(clock: PlaybackClock): number {
  if (clock.duration <= 0) return 0
  return Math.min(1, clock.t / clock.duration)
}
