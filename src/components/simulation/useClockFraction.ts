// rAF-throttled read of a shared playback clock (see three/Animations/
// playbackClock.ts): re-renders the subscribing HUD component only when the
// fraction visibly changes (~0.5% steps; exact 0/1 always land so bars start
// empty and finish full). Used by the loading transport and the delivery panel.

import { useEffect, useState } from 'react'
import { clockFraction, type PlaybackClock } from '@/three/Animations/playbackClock'

export function useClockFraction(clock: PlaybackClock, active: boolean): number {
  const [fraction, setFraction] = useState(0)

  useEffect(() => {
    if (!active) return
    let raf = 0
    const tick = () => {
      const next = clockFraction(clock)
      setFraction((prev) =>
        next === 0 || next === 1 || Math.abs(next - prev) > 0.005 ? next : prev,
      )
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [clock, active])

  return fraction
}
