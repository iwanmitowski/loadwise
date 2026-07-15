// Loading-corridor reachability — can a box physically travel from its door
// to its slot past the cargo already in the vehicle? Used by BOTH sides:
//  - the placement heuristic rejects candidates with no clear route, which
//    makes the insertion sequence (= loadingOrder) executable by construction;
//  - the loading/delivery animation replays the exact same routes, so what the
//    optimizer certified is what the scene shows.
//
// Route model (axis-aligned, integer-cm domain, box CENTRE coordinates):
//  low "forklift" L-route — cross the door plane inside the frame at low carry
//  height, drive straight down the entry lane, turn in the free strip before
//  the row, position laterally, lift, push in; else a "crane" route — rise
//  inside the doorway, travel above the corridor, drop into the slot. Entry
//  coordinates are swept across the whole opening. Everything is validated by
//  a swept-AABB test against the placed boxes; null means no clear route.
//
// Margins: obstacles shrink by TOUCH_EPS_CM (flush contact is legal), the
// door frame by FRAME_MARGIN_CM. FRAME < TOUCH so an exactly-box-width gap
// beside the frame stays traversable. Pure, deterministic, no React/Three.

import type { Dimensions, Vec3, VehicleDefinition, VehicleDoor } from '@/types'

/** Minimal solid box (min-corner + size, cm) — `PlacedBox` satisfies it. */
export type SolidBox = { min: Vec3; size: Dimensions }

const TOUCH_EPS_CM = 2
const FRAME_MARGIN_CM = 1.5
/** How far outside the door plane a route starts. */
export const STAGING_CLEARANCE_CM = 150
/** Carry float above the floor. */
const CARRY_FLOAT_CM = 2
/** Free strip kept between the carry stop and the slot before the push. */
const APPROACH_GAP_CM = 20

export type RoutePoint = [number, number, number]

/**
 * A clear route for a box of `size` to its slot (min-corner `target`), as box
 * CENTRE anchor points from outside the door to the final position — or null
 * when every candidate route is blocked.
 */
export function planLoadingRoute(
  size: Dimensions,
  target: Vec3,
  door: VehicleDoor,
  vehicle: VehicleDefinition,
  obstacles: readonly SolidBox[],
  /** When set, never return null: fall back to the slot-aligned crane route
   *  even unverified (the animation must always have SOME route; the optimizer
   *  passes false so unreachable slots are rejected). */
  bestEffort = false,
): RoutePoint[] | null {
  const { width: w, height: h, depth: d } = size
  const final: RoutePoint = [target.x + w / 2, target.y + h / 2, target.z + d / 2]
  const carryY = carryHeight(h, door)

  if (door.side === 'rear') {
    const inZ = d / 2 + FRAME_MARGIN_CM
    const preZ = Math.max(inZ, final[2] - (d + APPROACH_GAP_CM))
    const entries = entryCandidates(final[0], door.position.x, door.width, w)

    const low = (e: number): RoutePoint[] => [
      [e, carryY, -STAGING_CLEARANCE_CM],
      [e, carryY, inZ],
      [e, carryY, preZ],
      [final[0], carryY, preZ],
      [final[0], final[1], preZ],
      final,
    ]
    const crane = (e: number): RoutePoint[] => {
      const safeY = craneHeight([e, inZ], [final[0], final[2]], size, obstacles, vehicle)
      return [
        [e, carryY, -STAGING_CLEARANCE_CM],
        [e, carryY, inZ],
        [e, safeY, inZ],
        [final[0], safeY, final[2]],
        final,
      ]
    }
    return firstClear(entries, low, crane, size, obstacles) ?? (bestEffort ? dedupe(crane(entries[0])) : null)
  }

  // Side door on the x=0 (left) or x=width (right) wall; door width runs along Z.
  const wallX = door.side === 'left' ? 0 : vehicle.cargoSpace.width
  const out = door.side === 'left' ? -1 : 1
  const inX = wallX - out * (w / 2 + FRAME_MARGIN_CM)
  const preX =
    out === -1
      ? Math.max(inX, final[0] - (w + APPROACH_GAP_CM))
      : Math.min(inX, final[0] + (w + APPROACH_GAP_CM))
  const entries = entryCandidates(final[2], door.position.z, door.width, d)

  const low = (e: number): RoutePoint[] => [
    [wallX + out * STAGING_CLEARANCE_CM, carryY, e],
    [inX, carryY, e],
    [preX, carryY, e],
    [preX, carryY, final[2]],
    [preX, final[1], final[2]],
    final,
  ]
  const crane = (e: number): RoutePoint[] => {
    const safeY = craneHeight([inX, e], [final[0], final[2]], size, obstacles, vehicle)
    return [
      [wallX + out * STAGING_CLEARANCE_CM, carryY, e],
      [inX, carryY, e],
      [inX, safeY, e],
      [final[0], safeY, final[2]],
      final,
    ]
  }
  return firstClear(entries, low, crane, size, obstacles) ?? (bestEffort ? dedupe(crane(entries[0])) : null)
}

/** Centre height while carried: just above the floor, ducked under the door head. */
function carryHeight(h: number, door: VehicleDoor): number {
  const low = h / 2 + CARRY_FLOAT_CM
  const doorTop = door.position.y + door.height
  return Math.min(low, Math.max(doorTop - h / 2 - FRAME_MARGIN_CM, h / 2))
}

/** Slot-aligned entry first, then a deterministic sweep across the opening. */
function entryCandidates(
  target: number,
  doorMin: number,
  doorSize: number,
  size: number,
): number[] {
  const lo = doorMin + size / 2 + FRAME_MARGIN_CM
  const hi = doorMin + doorSize - size / 2 - FRAME_MARGIN_CM
  if (lo > hi) return [doorMin + doorSize / 2]
  const out = [Math.max(lo, Math.min(hi, target))]
  const steps = 8
  for (let i = 0; i <= steps; i++) out.push(lo + ((hi - lo) * i) / steps)
  return out
}

function firstClear(
  entries: readonly number[],
  low: (e: number) => RoutePoint[],
  crane: (e: number) => RoutePoint[],
  size: Dimensions,
  obstacles: readonly SolidBox[],
): RoutePoint[] | null {
  for (const e of entries) {
    const route = dedupe(low(e))
    if (routeClear(route, size, obstacles)) return route
  }
  for (const e of entries) {
    const route = dedupe(crane(e))
    if (routeClear(route, size, obstacles)) return route
  }
  return null
}

/**
 * Crane travel height: above the tallest obstacle whose inflated footprint the
 * horizontal leg crosses, clamped under the roof (the clamp makes the route
 * fail verification instead of clipping — reachability stays honest).
 */
function craneHeight(
  from: [number, number],
  to: [number, number],
  size: Dimensions,
  obstacles: readonly SolidBox[],
  vehicle: VehicleDefinition,
): number {
  const { width: w, height: h, depth: d } = size
  let top = 0
  for (const o of obstacles) {
    const cx = o.min.x + o.size.width / 2
    const cz = o.min.z + o.size.depth / 2
    const inflX = o.size.width / 2 + w / 2 - TOUCH_EPS_CM
    const inflZ = o.size.depth / 2 + d / 2 - TOUCH_EPS_CM
    if (segmentHitsRect(from[0], from[1], to[0], to[1], cx - inflX, cx + inflX, cz - inflZ, cz + inflZ)) {
      top = Math.max(top, o.min.y + o.size.height)
    }
  }
  const wanted = top + h / 2 + FRAME_MARGIN_CM
  const roofMax = vehicle.cargoSpace.height - h / 2 - 1
  return Math.max(h / 2, Math.min(wanted, roofMax))
}

/** Every swept segment of the route stays clear of every obstacle. */
export function routeClear(
  route: readonly RoutePoint[],
  size: Dimensions,
  obstacles: readonly SolidBox[],
): boolean {
  if (obstacles.length === 0) return true
  const { width: w, height: h, depth: d } = size
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]
    const b = route[i + 1]
    const yLo = Math.min(a[1], b[1]) - h / 2 + TOUCH_EPS_CM
    const yHi = Math.max(a[1], b[1]) + h / 2 - TOUCH_EPS_CM
    for (const o of obstacles) {
      const oyLo = o.min.y
      const oyHi = o.min.y + o.size.height
      if (yLo >= oyHi || yHi <= oyLo) continue
      const cx = o.min.x + o.size.width / 2
      const cz = o.min.z + o.size.depth / 2
      const inflX = o.size.width / 2 + w / 2 - TOUCH_EPS_CM
      const inflZ = o.size.depth / 2 + d / 2 - TOUCH_EPS_CM
      if (segmentHitsRect(a[0], a[2], b[0], b[2], cx - inflX, cx + inflX, cz - inflZ, cz + inflZ)) {
        return false
      }
    }
  }
  return true
}

/** Liang–Barsky: does the 2D segment (ax,az)→(bx,bz) intersect the rectangle? */
function segmentHitsRect(
  ax: number, az: number, bx: number, bz: number,
  minX: number, maxX: number, minZ: number, maxZ: number,
): boolean {
  const dx = bx - ax
  const dz = bz - az
  let t0 = 0
  let t1 = 1
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0
    const r = q / p
    if (p < 0) {
      if (r > t1) return false
      if (r > t0) t0 = r
    } else {
      if (r < t0) return false
      if (r < t1) t1 = r
    }
    return true
  }
  return (
    clip(-dx, ax - minX) &&
    clip(dx, maxX - ax) &&
    clip(-dz, az - minZ) &&
    clip(dz, maxZ - az)
  )
}

/** Drop consecutive (near-)duplicate anchors so every segment actually moves. */
function dedupe(points: RoutePoint[]): RoutePoint[] {
  const out: RoutePoint[] = []
  for (const p of points) {
    const prev = out[out.length - 1]
    if (
      prev &&
      Math.abs(prev[0] - p[0]) < 1e-9 &&
      Math.abs(prev[1] - p[1]) < 1e-9 &&
      Math.abs(prev[2] - p[2]) < 1e-9
    ) {
      continue
    }
    out.push(p)
  }
  return out
}
