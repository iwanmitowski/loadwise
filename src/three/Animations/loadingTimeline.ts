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
// Path per item: the SHARED loading route from the optimizer's reachability
// planner (features/optimizer/reachability.ts) — the exact corridor the
// placement heuristic certified when it committed the slot, converted to scene
// metres. Forklift L-route (cross the door frame low, drive the lane, turn,
// lift, push in) or crane (rise in the doorway, travel over, drop). Each
// segment is smoothstep-eased; the item snaps to its exact final transform at
// the window end so there is no drift.

import type { CargoRenderItem } from '../CargoLayer/cargoModel'
import {
  planLoadingRoute,
  type SolidBox,
} from '@/features/optimizer/reachability'
import type { DoorSide, VehicleDefinition } from '@/types'
import { m } from '../units'

/** Seconds between consecutive items' flight starts (at speed 1). */
export const LOADING_STEP_S = 0.6
/** Seconds one item spends in flight (at speed 1). Must stay < STEP. */
export const LOADING_DUR_S = 0.55

export type Vec3Tuple = [number, number, number]

/** The anchor points of one item's flight (scene metres). */
export type ItemPath = {
  /** Outside the door, aligned with the opening. */
  staging: Vec3Tuple
  /** Interior waypoints in flight order (door crossing → carry → lift). */
  waypoints: Vec3Tuple[]
  final: Vec3Tuple
}

/** A solid box the flight must not pass through (domain cm, min-corner + size). */
export type Obstacle = SolidBox

/** The obstacle an already-placed render item presents to later flights. */
export function itemObstacle(item: CargoRenderItem): Obstacle {
  return { min: item.min, size: item.size }
}

/** The full ordered point list of a path: staging → waypoints → final. */
export function pathPoints(path: ItemPath): Vec3Tuple[] {
  return [path.staging, ...path.waypoints, path.final]
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
  /** Already-placed cargo the flight must treat as solid (loading: every item
   *  placed before this one; delivery: everything still aboard). */
  obstacles: readonly Obstacle[] = [],
): ItemPath {
  const door =
    vehicle.doors.find((d) => d.side === doorSide) ??
    vehicle.doors.find((d) => d.side === 'rear') ??
    vehicle.doors[0]
  // bestEffort: the animation must always have SOME route — the optimizer
  // already certified reachability for its own loading order, so the fallback
  // only ever fires for odd hand-authored data or T15 blocker re-routes.
  const route = planLoadingRoute(item.size, item.min, door, vehicle, obstacles, true)!
  const points = route.map(
    ([x, y, z]): Vec3Tuple => [m(x), m(y), m(z)],
  )
  return {
    staging: points[0],
    waypoints: points.slice(1, -1),
    // Use the exact render-item centre so the landed mesh never drifts.
    final: item.center,
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
 * Position along a multi-segment waypoint chain at progress u ∈ [0, 1]
 * (clamped): the chain is divided into equal-time segments, each smoothstep-
 * eased. Shared by the loading flight (T14) and the delivery slide-out/return
 * (T15, which runs a reversed point list).
 */
export function pathAt(u: number, points: readonly Vec3Tuple[]): Vec3Tuple {
  const segments = points.length - 1
  if (segments < 1) return points[0]
  if (u <= 0) return points[0]
  if (u >= 1) return points[segments]
  const scaled = u * segments
  const seg = Math.min(Math.floor(scaled), segments - 1)
  return lerp3(points[seg], points[seg + 1], smoothstep(scaled - seg))
}

/**
 * Transform of item `index` at timeline time `t` (seconds, speed already
 * applied by the caller). Before its window: hidden at staging. During: eased
 * along the waypoint chain staging → … → final. At/after window end: exactly
 * the final position — snap, no drift.
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
  const position = pathAt(u, pathPoints(path))
  return { visible: true, phase: 'moving', position, flight: u }
}
