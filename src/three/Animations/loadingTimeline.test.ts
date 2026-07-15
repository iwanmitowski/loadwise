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

describe('buildItemPath — placed cargo is solid', () => {
  // Item k flies while items 0..k-1 sit at their finals. Dense-sample every
  // flight and assert the moving box never interpenetrates a placed box.
  // TOUCH_EPS (1.5cm) allows flush contact (sliding onto a supporter).
  function assertNoInterpenetration(
    items: readonly ReturnType<typeof buildCargoRenderItems>[number][],
    vehicle: VehicleDefinition,
  ) {
    // Obstacles for path building are domain-cm (min + size); the sweep
    // asserts in scene metres against each obstacle's scene-space box.
    const placedCm: { min: { x: number; y: number; z: number }; size: typeof items[number]['size'] }[] = []
    const placedScene: { center: Vec3Tuple; size: [number, number, number] }[] = []
    for (const item of items) {
      const path = buildItemPath(item, vehicle, item.assignedDoor, placedCm)
      const points = pathPoints(path)
      const [w, h, d] = item.sceneSize
      for (let i = 0; i <= 1000; i++) {
        const p = pathAt(i / 1000, points)
        for (const o of placedScene) {
          const overlapX =
            Math.min(p[0] + w / 2, o.center[0] + o.size[0] / 2) -
            Math.max(p[0] - w / 2, o.center[0] - o.size[0] / 2)
          const overlapY =
            Math.min(p[1] + h / 2, o.center[1] + o.size[1] / 2) -
            Math.max(p[1] - h / 2, o.center[1] - o.size[1] / 2)
          const overlapZ =
            Math.min(p[2] + d / 2, o.center[2] + o.size[2] / 2) -
            Math.max(p[2] - d / 2, o.center[2] - o.size[2] / 2)
          const interpenetrates =
            overlapX > 0.02 && overlapY > 0.02 && overlapZ > 0.02
          expect(
            interpenetrates,
            `${item.cargoId} at u=${i / 1000} passes through ${JSON.stringify(o.center)}`,
          ).toBe(false)
        }
      }
      placedCm.push({ min: item.min, size: item.size })
      placedScene.push({ center: item.center, size: item.sceneSize })
    }
  }

  it('demo fixture: no flight passes through already-placed cargo', () => {
    assertNoInterpenetration(rearItems, demoScenario.vehicle)
  })

  it('side-door fixture too', () => {
    assertNoInterpenetration(sideItems, demoSideDoorScenario.vehicle)
  })

  it('adversarial case: an early box near the door forces a lift-over', () => {
    // Two same-shop floor boxes: the first placed right at the door, the
    // second targeted BEHIND it — a low straight carry would sweep through
    // the first. The path must rise above it.
    // 60cm cubes: early at z 0..60cm centred x=120cm; late at z 100..160cm.
    const cube = { width: 60, height: 60, depth: 60 }
    const early = {
      ...rearItems[0],
      min: { x: 90, y: 0, z: 0 },
      size: cube,
      center: [1.2, 0.3, 0.3] as Vec3Tuple,
      sceneSize: [0.6, 0.6, 0.6] as [number, number, number],
    }
    const late = {
      ...rearItems[0],
      min: { x: 90, y: 0, z: 100 },
      size: cube,
      center: [1.2, 0.3, 1.3] as Vec3Tuple,
      sceneSize: [0.6, 0.6, 0.6] as [number, number, number],
    }
    const obstacle = { min: early.min, size: early.size }

    const path = buildItemPath(late, demoScenario.vehicle, 'rear', [obstacle])
    // The chain must climb above the early box (top at 0.6m) at some point.
    const points = pathPoints(path)
    const peak = Math.max(...points.map((p) => p[1]))
    expect(peak).toBeGreaterThan(0.6)
    // And the dense sweep confirms no interpenetration.
    const [w, h, d] = late.sceneSize
    for (let i = 0; i <= 1000; i++) {
      const p = pathAt(i / 1000, points)
      const ox =
        Math.min(p[0] + w / 2, 1.5) - Math.max(p[0] - w / 2, 0.9)
      const oy = Math.min(p[1] + h / 2, 0.6) - Math.max(p[1] - h / 2, 0)
      const oz = Math.min(p[2] + d / 2, 0.6) - Math.max(p[2] - d / 2, 0)
      expect(ox > 0.02 && oy > 0.02 && oz > 0.02).toBe(false)
    }
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
