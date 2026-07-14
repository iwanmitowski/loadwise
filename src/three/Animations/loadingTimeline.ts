// Pure timeline math for the loading animation (T14). No React, no Three —
// everything here is unit-testable in the node environment. All values are in
// SCENE space (metres, mesh centres), because this module's only consumer drives
// Three.js meshes; the cm→m conversion happened when the CargoRenderItem was
// built (units.ts / cargoModel.ts).
//
// Timeline: item k (0-based, items sorted by loadingOrder) flies during
// [k × STEP, k × STEP + DUR] seconds at speed 1 — DUR < STEP, so flights never
// overlap. Total timeline = N × STEP.
//
// Path per item: a two-segment dog-leg, no physics.
//   staging (outside the assigned door) → waypoint (inside the doorway)
//   → final placement. Each segment is smoothstep-eased; the item snaps to its
//   exact final transform at the window end so there is no drift.

import type { CargoRenderItem } from '../CargoLayer/cargoModel'
import type { DoorSide, VehicleDefinition } from '@/types'
import { m } from '../units'

/** Seconds between consecutive items' flight starts (at speed 1). */
export const LOADING_STEP_S = 0.6
/** Seconds one item spends in flight (at speed 1). Must stay < STEP. */
export const LOADING_DUR_S = 0.55

/** How far outside the door plane an item stages, in domain cm. */
const STAGING_CLEARANCE_CM = 150

export type Vec3Tuple = [number, number, number]

/** The three anchor points of one item's dog-leg flight (scene metres). */
export type ItemPath = {
  staging: Vec3Tuple
  waypoint: Vec3Tuple
  final: Vec3Tuple
}

export type LoadingPhase = 'pending' | 'moving' | 'placed'

export type LoadingTransform = {
  /** Items whose window hasn't started are hidden. */
  visible: boolean
  phase: LoadingPhase
  /** Mesh-centre position for time t (scene metres). */
  position: Vec3Tuple
  /** 0..1 progress through this item's own flight (0 before, 1 after). */
  flight: number
}

/**
 * Build the flight path for one placed item, given the scenario vehicle's
 * doors. Defaults to the item's assigned door; T15 passes `doorSide` to route
 * a blocker through the door of the item it blocks. Falls back to the rear
 * door (then the first door) if the requested door isn't on this vehicle —
 * the animation must never crash on odd data.
 */
export function buildItemPath(
  item: CargoRenderItem,
  vehicle: VehicleDefinition,
  doorSide: DoorSide = item.assignedDoor,
): ItemPath {
  const door =
    vehicle.doors.find((d) => d.side === doorSide) ??
    vehicle.doors.find((d) => d.side === 'rear') ??
    vehicle.doors[0]
  const final = item.center
  const [w, , d] = item.sceneSize
  const clearance = m(STAGING_CLEARANCE_CM)

  if (door.side === 'rear') {
    // Stage behind the rear (z=0) wall at the door's horizontal centre, then
    // enter the doorway at the item's final x/y and push straight in (+Z).
    const doorCenterX = m(door.position.x + door.width / 2)
    return {
      staging: [doorCenterX, final[1], -clearance],
      // Centre at d/2 = the box has just fully crossed the door plane. Final z
      // is always ≥ d/2 (min-corner z ≥ 0), so segment 2 never moves backwards.
      waypoint: [final[0], final[1], d / 2],
      final,
    }
  }

  // Side door on the x=0 (left) or x=width (right) wall; door width runs along Z.
  const wallX = door.side === 'left' ? 0 : m(vehicle.cargoSpace.width)
  const out = door.side === 'left' ? -1 : 1
  const doorCenterZ = m(door.position.z + door.width / 2)
  return {
    staging: [wallX + out * clearance, final[1], doorCenterZ],
    // Just fully inside the wall, at the item's final y/z; segment 2 slides
    // along ±X to the final x (which is always ≥ w/2 from either wall).
    waypoint: [wallX - out * (w / 2), final[1], final[2]],
    final,
  }
}

/** Total timeline length in seconds at speed 1 for `count` items. */
export function timelineDuration(count: number): number {
  return count * LOADING_STEP_S
}

/**
 * Index of the item "current" at time t: the one in flight, or — in the gap
 * between flights — the one that just landed. Clamped to [0, count-1].
 */
export function itemIndexAt(t: number, count: number): number {
  if (count === 0) return 0
  return Math.max(0, Math.min(count - 1, Math.floor(t / LOADING_STEP_S)))
}

/** Classic smoothstep ease-in-out on u ∈ [0, 1]. */
function smoothstep(u: number): number {
  const x = Math.max(0, Math.min(1, u))
  return x * x * (3 - 2 * x)
}

function lerp3(a: Vec3Tuple, b: Vec3Tuple, u: number): Vec3Tuple {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]
}

/**
 * Position along a two-segment dog-leg `from → via → to` at progress u ∈ [0, 1]
 * (clamped): first half eases from→via, second half via→to, smoothstep each.
 * Shared by the loading flight (T14) and the delivery slide-out/return (T15,
 * which runs it in reverse by swapping the endpoints).
 */
export function dogLegAt(
  u: number,
  from: Vec3Tuple,
  via: Vec3Tuple,
  to: Vec3Tuple,
): Vec3Tuple {
  if (u <= 0) return from
  if (u >= 1) return to
  return u < 0.5
    ? lerp3(from, via, smoothstep(u / 0.5))
    : lerp3(via, to, smoothstep((u - 0.5) / 0.5))
}

/**
 * Transform of item `index` at timeline time `t` (seconds, speed already
 * applied by the caller). Before its window: hidden at staging. During: eased
 * along staging→waypoint for the first half, waypoint→final for the second.
 * At/after window end: exactly the final position — snap, no drift.
 */
export function transformAt(
  t: number,
  index: number,
  path: ItemPath,
): LoadingTransform {
  const start = index * LOADING_STEP_S
  const end = start + LOADING_DUR_S

  if (t < start) {
    return { visible: false, phase: 'pending', position: path.staging, flight: 0 }
  }
  if (t >= end) {
    return { visible: true, phase: 'placed', position: path.final, flight: 1 }
  }

  const u = (t - start) / LOADING_DUR_S
  const position = dogLegAt(u, path.staging, path.waypoint, path.final)
  return { visible: true, phase: 'moving', position, flight: u }
}
