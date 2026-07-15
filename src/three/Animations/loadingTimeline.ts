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
// Path per item: a forklift-style waypoint chain, no physics. The item stages
// outside its door, crosses the wall plane STRICTLY inside the door frame at
// low carry height (so it can never clip through a wall), is carried low
// through the bay to just short of its slot, lifts to final height, and pushes
// in. Each segment is smoothstep-eased; the item snaps to its exact final
// transform at the window end so there is no drift.

import type { CargoRenderItem } from '../CargoLayer/cargoModel'
import type { DoorSide, VehicleDefinition, VehicleDoor } from '@/types'
import { m } from '../units'

/** Seconds between consecutive items' flight starts (at speed 1). */
export const LOADING_STEP_S = 0.6
/** Seconds one item spends in flight (at speed 1). Must stay < STEP. */
export const LOADING_DUR_S = 0.55

/** How far outside the door plane an item stages, in domain cm. */
const STAGING_CLEARANCE_CM = 150
/** Carry float above the floor, and clearance to the door frame (metres). */
const CARRY_FLOAT_M = 0.02
const FRAME_MARGIN_M = 0.05
/** How far short of the slot the carry stops before the lift (metres). */
const APPROACH_GAP_M = 0.2

export type Vec3Tuple = [number, number, number]

/** The anchor points of one item's flight (scene metres). */
export type ItemPath = {
  /** Outside the door, aligned with the opening. */
  staging: Vec3Tuple
  /** Interior waypoints in flight order (door crossing → carry → lift). */
  waypoints: Vec3Tuple[]
  final: Vec3Tuple
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
): ItemPath {
  const door =
    vehicle.doors.find((d) => d.side === doorSide) ??
    vehicle.doors.find((d) => d.side === 'rear') ??
    vehicle.doors[0]
  const final = item.center
  const [w, h, d] = item.sceneSize
  const clearance = m(STAGING_CLEARANCE_CM)
  const carryY = carryHeight(h, door)

  if (door.side === 'rear') {
    // Cross the z=0 plane inside the door frame at carry height, carry low
    // (+Z) to just short of the slot, lift, push in.
    const entryX = clampToOpening(final[0], m(door.position.x), m(door.width), w)
    const inZ = d / 2 + FRAME_MARGIN_M
    const preZ = Math.max(inZ, final[2] - (d + APPROACH_GAP_M))
    return {
      staging: [entryX, carryY, -clearance],
      waypoints: dedupe([
        [entryX, carryY, inZ],
        [final[0], carryY, preZ],
        [final[0], final[1], preZ],
      ]),
      final,
    }
  }

  // Side door on the x=0 (left) or x=width (right) wall; door width runs along Z.
  const wallX = door.side === 'left' ? 0 : m(vehicle.cargoSpace.width)
  const out = door.side === 'left' ? -1 : 1
  const entryZ = clampToOpening(final[2], m(door.position.z), m(door.width), d)
  const inX = wallX - out * (w / 2 + FRAME_MARGIN_M)
  const preX =
    out === -1
      ? Math.max(inX, final[0] - (w + APPROACH_GAP_M))
      : Math.min(inX, final[0] + (w + APPROACH_GAP_M))
  return {
    staging: [wallX + out * clearance, carryY, entryZ],
    waypoints: dedupe([
      [inX, carryY, entryZ],
      [preX, carryY, final[2]],
      [preX, final[1], final[2]],
    ]),
    final,
  }
}

/**
 * Height the box's CENTRE travels at while carried: just above the floor
 * (forklift-style), pushed down under the door head when the opening is low.
 * Low carry means the wall-plane crossing always happens inside the frame.
 */
function carryHeight(h: number, door: VehicleDoor): number {
  const low = h / 2 + CARRY_FLOAT_M
  const doorTop = m(door.position.y + door.height)
  return Math.min(low, Math.max(doorTop - h / 2 - FRAME_MARGIN_M, h / 2))
}

/**
 * The in-plane coordinate at which the box crosses the door plane: the final
 * coordinate when the slot lines up with the opening, else clamped so the box
 * (half-size `half×2`) passes fully inside the frame. Falls back to the door
 * centre if the opening is narrower than the box (defensive; door assignment
 * guarantees fit for the assigned door).
 */
function clampToOpening(target: number, doorMin: number, doorSize: number, size: number): number {
  const lo = doorMin + size / 2 + FRAME_MARGIN_M
  const hi = doorMin + doorSize - size / 2 - FRAME_MARGIN_M
  if (lo > hi) return doorMin + doorSize / 2
  return Math.max(lo, Math.min(hi, target))
}

/** Drop consecutive (near-)duplicate points so every segment actually moves. */
function dedupe(points: Vec3Tuple[]): Vec3Tuple[] {
  const out: Vec3Tuple[] = []
  for (const p of points) {
    const prev = out[out.length - 1]
    if (prev && Math.abs(prev[0] - p[0]) < 1e-9 && Math.abs(prev[1] - p[1]) < 1e-9 && Math.abs(prev[2] - p[2]) < 1e-9) {
      continue
    }
    out.push(p)
  }
  return out
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
