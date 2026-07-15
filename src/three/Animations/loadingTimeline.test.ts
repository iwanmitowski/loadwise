import { describe, expect, it } from 'vitest'
import {
  demoResult,
  demoScenario,
  demoSideDoorResult,
  demoSideDoorScenario,
} from '@/fixtures/demo'
import { buildCargoRenderItems } from '../CargoLayer/cargoModel'
import {
  buildItemPath,
  itemIndexAt,
  pathAt,
  pathPoints,
  timelineDuration,
  transformAt,
  LOADING_DUR_S,
  LOADING_STEP_S,
} from './loadingTimeline'
import { m } from '../units'
import type { Vec3Tuple } from './loadingTimeline'
import type { VehicleDefinition, VehicleDoor } from '@/types'

const rearItems = buildCargoRenderItems(demoResult.trips[0], demoScenario)
const sideItems = buildCargoRenderItems(
  demoSideDoorResult.trips[0],
  demoSideDoorScenario,
)

/**
 * THE wall-clipping invariant: sample the whole flight densely and find where
 * it crosses the door's wall plane; at that instant every point of the box must
 * be inside the door frame (not the wall). Fails on the old path for stacked
 * or off-door-axis items.
 */
function assertCrossesInsideDoorFrame(
  points: Vec3Tuple[],
  size: [number, number, number],
  door: VehicleDoor,
  vehicle: VehicleDefinition,
) {
  const [w, h, d] = size
  for (let i = 0; i <= 2000; i++) {
    const cur = pathAt(i / 2000, points)
    if (door.side === 'rear') {
      // Crossing while any part of the box straddles the z=0 plane.
      const crossed = cur[2] - d / 2 < 0 && cur[2] + d / 2 > 0
      if (crossed) {
        expect(cur[0] - w / 2).toBeGreaterThanOrEqual(m(door.position.x))
        expect(cur[0] + w / 2).toBeLessThanOrEqual(m(door.position.x + door.width))
        expect(cur[1] + h / 2).toBeLessThanOrEqual(m(door.position.y + door.height))
      }
    } else {
      const wallX = door.side === 'left' ? 0 : m(vehicle.cargoSpace.width)
      const crossed = cur[0] - w / 2 < wallX && cur[0] + w / 2 > wallX
      if (crossed) {
        expect(cur[2] - d / 2).toBeGreaterThanOrEqual(m(door.position.z))
        expect(cur[2] + d / 2).toBeLessThanOrEqual(m(door.position.z + door.width))
        expect(cur[1] + h / 2).toBeLessThanOrEqual(m(door.position.y + door.height))
      }
    }
  }
}

describe('buildItemPath — rear door', () => {
  const path = buildItemPath(rearItems[0], demoScenario.vehicle)

  it('stages outside the rear (z=0) wall at low carry height', () => {
    const [, h] = rearItems[0].sceneSize
    expect(path.staging[2]).toBeCloseTo(-1.5)
    expect(path.staging[1]).toBeCloseTo(h / 2 + 0.02)
  })

  it('ends at the exact final mesh centre', () => {
    expect(path.final).toEqual(rearItems[0].center)
  })

  it('EVERY item (incl. stacked) crosses the wall plane inside the door frame', () => {
    const door = demoScenario.vehicle.doors.find((d) => d.side === 'rear')!
    for (const item of rearItems) {
      const p = buildItemPath(item, demoScenario.vehicle)
      assertCrossesInsideDoorFrame(
        pathPoints(p),
        item.sceneSize,
        door,
        demoScenario.vehicle,
      )
    }
  })

  it('a stacked item lifts at the destination, not at the door', () => {
    const stacked = rearItems.find((i) => i.min.y > 0)!
    const p = buildItemPath(stacked, demoScenario.vehicle)
    const [, h] = stacked.sceneSize
    // Carried low through the doorway…
    expect(p.waypoints[0][1]).toBeCloseTo(h / 2 + 0.02)
    // …and reaches final height only at the second-to-last anchor.
    expect(p.waypoints[p.waypoints.length - 1][1]).toBeCloseTo(stacked.center[1])
  })
})

describe('buildItemPath — side door', () => {
  const leftItems = sideItems.filter((i) => i.assignedDoor === 'left')

  it('the fixture variant actually routes cargo through the left door', () => {
    expect(leftItems.length).toBeGreaterThan(0)
  })

  it('stages 150cm out from the x=0 wall at low carry height', () => {
    for (const item of leftItems) {
      const path = buildItemPath(item, demoSideDoorScenario.vehicle)
      const [, h] = item.sceneSize
      expect(path.staging[0]).toBeCloseTo(-1.5)
      expect(path.staging[1]).toBeCloseTo(h / 2 + 0.02)
    }
  })

  it('EVERY left-door item crosses the x=0 plane inside the door frame', () => {
    const door = demoSideDoorScenario.vehicle.doors.find((d) => d.side === 'left')!
    for (const item of leftItems) {
      const p = buildItemPath(item, demoSideDoorScenario.vehicle)
      assertCrossesInsideDoorFrame(
        pathPoints(p),
        item.sceneSize,
        door,
        demoSideDoorScenario.vehicle,
      )
    }
  })

  it('rear-assigned items in the variant still stage behind the rear wall', () => {
    const rear = sideItems.find((i) => i.assignedDoor === 'rear')!
    const path = buildItemPath(rear, demoSideDoorScenario.vehicle)
    expect(path.staging[2]).toBeCloseTo(-1.5)
  })

  it('falls back to the rear door when the assigned door is not fitted', () => {
    // Left-door item, but on the rear-only demo vehicle.
    const path = buildItemPath(leftItems[0], demoScenario.vehicle)
    expect(path.staging[2]).toBeCloseTo(-1.5)
  })
})

describe('transformAt', () => {
  const item = rearItems[3]
  const path = buildItemPath(item, demoScenario.vehicle)
  const k = 3
  const start = k * LOADING_STEP_S

  it('before the window: hidden at staging', () => {
    const tr = transformAt(start - 0.01, k, path)
    expect(tr).toEqual({
      visible: false,
      phase: 'pending',
      position: path.staging,
      flight: 0,
    })
  })

  it('at window start: visible at staging (flight begins)', () => {
    const tr = transformAt(start, k, path)
    expect(tr.visible).toBe(true)
    expect(tr.phase).toBe('moving')
    expect(tr.position).toEqual(path.staging)
  })

  it('hits every waypoint anchor exactly at its segment boundary', () => {
    const points = pathPoints(path)
    const segments = points.length - 1
    for (let i = 0; i <= segments; i++) {
      const tr = transformAt(start + LOADING_DUR_S * (i / segments), k, path)
      // The final anchor lands in phase 'placed'; all others mid-flight.
      expect(tr.position[0]).toBeCloseTo(points[i][0])
      expect(tr.position[1]).toBeCloseTo(points[i][1])
      expect(tr.position[2]).toBeCloseTo(points[i][2])
    }
  })

  it('mid segment: stays inside the bounding box of its two anchors', () => {
    const points = pathPoints(path)
    const segments = points.length - 1
    for (let seg = 0; seg < segments; seg++) {
      const u = (seg + 0.5) / segments
      const tr = transformAt(start + LOADING_DUR_S * u, k, path)
      expect(tr.phase).toBe('moving')
      for (const axis of [0, 1, 2] as const) {
        const [lo, hi] = [points[seg][axis], points[seg + 1][axis]].sort((a, b) => a - b)
        expect(tr.position[axis]).toBeGreaterThanOrEqual(lo - 1e-9)
        expect(tr.position[axis]).toBeLessThanOrEqual(hi + 1e-9)
      }
    }
  })

  it('at/after window end: snaps to the exact final position, placed', () => {
    for (const t of [start + LOADING_DUR_S, start + LOADING_DUR_S + 5]) {
      const tr = transformAt(t, k, path)
      expect(tr).toEqual({
        visible: true,
        phase: 'placed',
        position: path.final,
        flight: 1,
      })
    }
  })
})

describe('timeline bookkeeping', () => {
  it('total duration = N × STEP, and the last flight fits inside it', () => {
    const n = rearItems.length
    expect(timelineDuration(n)).toBeCloseTo(n * LOADING_STEP_S)
    expect((n - 1) * LOADING_STEP_S + LOADING_DUR_S).toBeLessThan(timelineDuration(n))
    expect(timelineDuration(0)).toBe(0)
  })

  it('itemIndexAt walks 0..N-1 and clamps at both ends', () => {
    const n = 9
    expect(itemIndexAt(0, n)).toBe(0)
    expect(itemIndexAt(LOADING_STEP_S * 4.5, n)).toBe(4)
    // Past the end (including exactly t = duration) it stays on the last item.
    expect(itemIndexAt(timelineDuration(n), n)).toBe(n - 1)
    expect(itemIndexAt(1000, n)).toBe(n - 1)
    expect(itemIndexAt(5, 0)).toBe(0)
  })
})
