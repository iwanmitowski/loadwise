// The single useFrame driver for the delivery simulation (T15). Mounted by
// CargoLayer only while playback mode is 'delivery'; on unmount it restores
// every mesh to its exact placed transform (position, scale, visibility), so
// exiting mid-route can never wedge boxes half-delivered.
//
// Same architecture as T14's LoadingAnimator: the per-STOP clock lives in the
// shared deliveryClock, transforms are written straight onto CargoBox meshes,
// and the only store writes are discrete — auto-advancing to the next stop
// (auto-play) or pausing when a stop's choreography completes.

import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { DeliveryTrip, DoorSide, Scenario } from '@/types'
import { useUiStore } from '@/state/uiStore'
import type { CargoRenderItem } from '../CargoLayer/cargoModel'
import { stopStateAt, type StopPlan, type StopState } from './deliveryTimeline'
import { pathAt, pathPoints, type ItemPath, type Vec3Tuple } from './loadingTimeline'
import { deliveryClock, resetDeliveryClock } from './playbackClock'
import { clearPulse, setPulse } from './pulse'
import { useDeliveryTimeline } from './useDeliveryTimeline'

// Blockers flash amber while sliding (idea.md: blocking cargo is called out);
// the stop's own cargo pulses in its shop colour.
const BLOCKER_COLOR = '#f59e0b'
const PULSE_PEAK = 0.7
// Delivered items shrink away over the second half of their slide-out.
const DELIVERED_END_SCALE = 0.2

type DeliveryAnimatorProps = {
  trip: DeliveryTrip
  scenario: Scenario
  /** Trip items, loadingOrder-sorted (buildCargoRenderItems guarantees it). */
  items: readonly CargoRenderItem[]
  /** Live cargoId → mesh registry maintained by CargoLayer. */
  meshes: ReadonlyMap<string, Mesh>
}

export function DeliveryAnimator({ trip, scenario, items, meshes }: DeliveryAnimatorProps) {
  const timeline = useDeliveryTimeline(trip, scenario, items)
  const { plan, pathsByStop, blockerSlotsByStop, durations, deliveredAtStop } = timeline

  // Entering delivery mode starts the route from stop 0 with all cargo
  // restored — the mount reset plus the frame loop below guarantee both.
  useEffect(() => {
    resetDeliveryClock(durations[0] ?? 0)
  }, [durations])

  // Restore exact placed transforms when the animator leaves the scene.
  useEffect(() => {
    return () => {
      for (const item of items) {
        const mesh = meshes.get(item.cargoId)
        if (!mesh) continue
        mesh.visible = true
        mesh.position.set(...item.center)
        mesh.scale.setScalar(1)
        clearPulse(mesh)
      }
      resetDeliveryClock(0)
    }
  }, [items, meshes])

  useFrame((_, delta) => {
    const ui = useUiStore.getState()
    const { playing, speed, index, autoPlay } = ui.playback

    const stopIndex = Math.min(index, Math.max(0, plan.stops.length - 1))
    const stop = plan.stops[stopIndex] as StopPlan | undefined
    const duration = durations[stopIndex] ?? 0
    deliveryClock.duration = duration

    if (playing && stop) {
      deliveryClock.t = Math.min(deliveryClock.t + delta * speed, duration)
      if (deliveryClock.t >= duration) {
        // Stop choreography finished: auto-play rolls on; manual mode waits
        // for "Next stop". The last stop always ends paused (route complete).
        if (autoPlay && stopIndex < plan.stops.length - 1) {
          resetDeliveryClock(durations[stopIndex + 1] ?? 0)
          ui.setPlayback({ index: stopIndex + 1 })
        } else {
          ui.setPlayback({ playing: false })
        }
      }
    }

    const state: StopState = stop
      ? stopStateAt(deliveryClock.t, stop)
      : { phase: 'done', opIndex: null, opProgress: 0, doorOpen: false }

    // Which doors the Doors component should hold open this frame: the stop's
    // own door for the whole open window, plus the active op's slide door.
    const openDoors: DoorSide[] = []
    if (stop && state.doorOpen) {
      openDoors.push(stop.door)
      const activeOp = state.opIndex !== null ? stop.ops[state.opIndex] : null
      if (activeOp && !openDoors.includes(activeOp.door)) openDoors.push(activeOp.door)
    }
    deliveryClock.openDoors = openDoors

    const paths = pathsByStop[stopIndex]
    const slots = blockerSlotsByStop[stopIndex]

    for (const item of items) {
      const mesh = meshes.get(item.cargoId)
      if (!mesh) continue
      applyItemState(mesh, item, stopIndex, state, stop, paths, slots, deliveredAtStop)
    }
  })

  return null
}

/**
 * Derive and write one item's transform for the current stop state. Pure
 * function of (stopIndex, state) — no accumulated per-frame state, so pausing,
 * scrub-like jumps via "Next stop", and restarts all land on exact poses.
 */
function applyItemState(
  mesh: Mesh,
  item: CargoRenderItem,
  stopIndex: number,
  state: StopState,
  stop: StopPlan | undefined,
  paths: Map<string, ItemPath> | undefined,
  slots: Map<string, Vec3Tuple> | undefined,
  deliveredAtStop: Map<string, number>,
) {
  const deliveredAt = deliveredAtStop.get(item.cargoId)

  // Gone: delivered at an earlier stop (or at this stop once the route moved
  // past it — 'done' counts the current stop as delivered).
  if (
    deliveredAt !== undefined &&
    (deliveredAt < stopIndex || (deliveredAt === stopIndex && state.phase === 'done'))
  ) {
    mesh.visible = false
    clearPulse(mesh)
    return
  }

  const placed = () => {
    mesh.visible = true
    mesh.position.set(...item.center)
    mesh.scale.setScalar(1)
  }

  if (!stop || !paths) {
    placed()
    clearPulse(mesh)
    return
  }

  const isStopCargo = deliveredAt === stopIndex
  const opIndex = state.opIndex
  const activeOp = opIndex !== null ? stop.ops[opIndex] : null

  // --- The item currently sliding ---
  if (activeOp && activeOp.cargoId === item.cargoId) {
    const path = paths.get(item.cargoId)
    if (!path) {
      placed()
      return
    }
    const u = state.opProgress
    mesh.visible = true
    // Unload runs the loading waypoint chain in REVERSE (lower off the stack,
    // carry low, exit through the door frame) — same no-wall-clipping guarantee.
    const outbound = [...pathPoints(path)].reverse()
    if (activeOp.type === 'deliver') {
      // Slide out reversed (final → … → outside) and shrink away over the
      // second half so the box reads as "handed off".
      mesh.position.set(...pathAt(u, outbound))
      const shrink = u < 0.5 ? 1 : 1 - (1 - DELIVERED_END_SCALE) * ((u - 0.5) / 0.5)
      mesh.scale.setScalar(shrink)
      setPulse(mesh, item.color, PULSE_PEAK * Math.sin(u * Math.PI))
    } else if (activeOp.type === 'move-blocker-out') {
      // Same exit chain, but the endpoint is the blocker's kerbside slot.
      const slot = slots?.get(item.cargoId) ?? path.staging
      mesh.position.set(...pathAt(u, [...outbound.slice(0, -1), slot]))
      mesh.scale.setScalar(1)
      setPulse(mesh, BLOCKER_COLOR, PULSE_PEAK * Math.sin(u * Math.PI))
    } else {
      // return-blocker: kerbside slot back in through the door to its place.
      const slot = slots?.get(item.cargoId) ?? path.staging
      mesh.position.set(...pathAt(u, [slot, ...pathPoints(path).slice(1)]))
      mesh.scale.setScalar(1)
      setPulse(mesh, BLOCKER_COLOR, PULSE_PEAK * Math.sin(u * Math.PI))
    }
    return
  }

  // --- Items with ops at this stop, before/after their active window ---
  const opsSoFar =
    state.phase === 'op' && opIndex !== null
      ? stop.ops.slice(0, opIndex)
      : state.phase === 'door-close' || state.phase === 'done'
        ? stop.ops
        : []

  const wasDelivered =
    isStopCargo && opsSoFar.some((op) => op.type === 'deliver' && op.cargoId === item.cargoId)
  if (wasDelivered) {
    mesh.visible = false
    clearPulse(mesh)
    return
  }

  const movedOut = opsSoFar.some(
    (op) => op.type === 'move-blocker-out' && op.cargoId === item.cargoId,
  )
  const returned = opsSoFar.some(
    (op) => op.type === 'return-blocker' && op.cargoId === item.cargoId,
  )
  if (movedOut && !returned) {
    // Parked outside in its staging slot while this stop unloads.
    const slot = slots?.get(item.cargoId) ?? paths.get(item.cargoId)?.staging
    if (slot) {
      mesh.visible = true
      mesh.position.set(...slot)
      mesh.scale.setScalar(1)
      setPulse(mesh, BLOCKER_COLOR, 0.25)
      return
    }
  }

  placed()

  // Highlight phase (and while waiting through ops): this stop's cargo pulses
  // in shop colour so the user sees what's about to leave.
  if (isStopCargo && (state.phase === 'highlight' || state.phase === 'op')) {
    setPulse(mesh, item.color, 0.35)
  } else {
    clearPulse(mesh)
  }
}
