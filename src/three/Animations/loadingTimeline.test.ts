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
  timelineDuration,
  transformAt,
  LOADING_DUR_S,
  LOADING_STEP_S,
} from './loadingTimeline'

const rearItems = buildCargoRenderItems(demoResult.trips[0], demoScenario)
const sideItems = buildCargoRenderItems(
  demoSideDoorResult.trips[0],
  demoSideDoorScenario,
)

describe('buildItemPath — rear door', () => {
  // Box-truck rear door: width 220 centred on a 240-wide wall → centre x = 120cm.
  const path = buildItemPath(rearItems[0], demoScenario.vehicle)

  it('stages outside the rear (z=0) wall at the door centre and final height', () => {
    expect(path.staging[0]).toBeCloseTo(1.2)
    expect(path.staging[1]).toBeCloseTo(rearItems[0].center[1])
    expect(path.staging[2]).toBeCloseTo(-1.5)
  })

  it('waypoints just inside the doorway at the final x/y', () => {
    const [, , d] = rearItems[0].sceneSize
    expect(path.waypoint).toEqual([
      rearItems[0].center[0],
      rearItems[0].center[1],
      d / 2,
    ])
  })

  it('ends at the exact final mesh centre', () => {
    expect(path.final).toEqual(rearItems[0].center)
  })

  it('never moves backwards on segment 2 (final z ≥ waypoint z)', () => {
    for (const item of rearItems) {
      const p = buildItemPath(item, demoScenario.vehicle)
      expect(p.final[2]).toBeGreaterThanOrEqual(p.waypoint[2])
    }
  })
})

describe('buildItemPath — side door', () => {
  const leftItems = sideItems.filter((i) => i.assignedDoor === 'left')

  it('the fixture variant actually routes cargo through the left door', () => {
    expect(leftItems.length).toBeGreaterThan(0)
  })

  it('stages 150cm out from the x=0 wall at the door z-centre and final height', () => {
    // Box-truck side door: z 210, width 200 (runs along Z) → centre z = 310cm.
    for (const item of leftItems) {
      const path = buildItemPath(item, demoSideDoorScenario.vehicle)
      expect(path.staging[0]).toBeCloseTo(-1.5)
      expect(path.staging[1]).toBeCloseTo(item.center[1])
      expect(path.staging[2]).toBeCloseTo(3.1)
    }
  })

  it('waypoints just inside the wall at the final y/z, then slides inward (+X)', () => {
    for (const item of leftItems) {
      const path = buildItemPath(item, demoSideDoorScenario.vehicle)
      const [w] = item.sceneSize
      expect(path.waypoint).toEqual([w / 2, item.center[1], item.center[2]])
      expect(path.final[0]).toBeGreaterThanOrEqual(path.waypoint[0])
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

  it('mid segment 1: strictly between staging and waypoint', () => {
    const tr = transformAt(start + LOADING_DUR_S * 0.25, k, path)
    expect(tr.phase).toBe('moving')
    for (const axis of [0, 1, 2] as const) {
      const [lo, hi] = [path.staging[axis], path.waypoint[axis]].sort((a, b) => a - b)
      expect(tr.position[axis]).toBeGreaterThanOrEqual(lo)
      expect(tr.position[axis]).toBeLessThanOrEqual(hi)
    }
  })

  it('at the segment boundary (u=0.5): exactly the waypoint', () => {
    const tr = transformAt(start + LOADING_DUR_S * 0.5, k, path)
    expect(tr.position[0]).toBeCloseTo(path.waypoint[0])
    expect(tr.position[1]).toBeCloseTo(path.waypoint[1])
    expect(tr.position[2]).toBeCloseTo(path.waypoint[2])
  })

  it('mid segment 2: strictly between waypoint and final', () => {
    const tr = transformAt(start + LOADING_DUR_S * 0.75, k, path)
    expect(tr.phase).toBe('moving')
    for (const axis of [0, 1, 2] as const) {
      const [lo, hi] = [path.waypoint[axis], path.final[axis]].sort((a, b) => a - b)
      expect(tr.position[axis]).toBeGreaterThanOrEqual(lo)
      expect(tr.position[axis]).toBeLessThanOrEqual(hi)
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
