import { describe, expect, it } from 'vitest'
import {
  demoBlockingResult,
  demoBlockingScenario,
  demoResult,
  demoScenario,
} from '@/fixtures/demo'
import {
  blockerStagingSlot,
  buildRoutePlan,
  distanceToDoor,
  itemDeliveredNow,
  stopDuration,
  stopStateAt,
  DELIVERY_PHASE_S,
  type StopState,
} from './deliveryTimeline'
import { pathAt } from './loadingTimeline'

const blockingTrip = demoBlockingResult.trips[0]
const demoTrip = demoResult.trips[0]

describe('buildRoutePlan — blocking fixture', () => {
  const plan = buildRoutePlan(blockingTrip, demoBlockingScenario)

  it('walks stops in delivery order', () => {
    expect(plan.stops.map((s) => s.stopNumber)).toEqual([1, 2, 3])
    expect(plan.stops.map((s) => s.shopId)).toEqual(['shop-3', 'shop-2', 'shop-1'])
  })

  it('stop 1: the later-stop box in front is a blocker, with the exact op order', () => {
    const stop = plan.stops[0]
    expect(stop.deliverIds).toEqual(['shop-3-c1'])
    expect(stop.blockerIds).toEqual(['shop-2-c1'])
    expect(stop.ops).toEqual([
      { type: 'move-blocker-out', cargoId: 'shop-2-c1', door: 'rear' },
      { type: 'deliver', cargoId: 'shop-3-c1', door: 'rear' },
      { type: 'return-blocker', cargoId: 'shop-2-c1', door: 'rear' },
    ])
  })

  it('stop 2 unloads closest-first (distance tie broken by id), no blockers', () => {
    const stop = plan.stops[1]
    expect(stop.deliverIds).toEqual(['shop-2-c1', 'shop-2-c2'])
    expect(stop.blockerIds).toEqual([])
  })

  it('stop 3: the box in front was already delivered at stop 2 — no extra move', () => {
    const stop = plan.stops[2]
    expect(stop.deliverIds).toEqual(['shop-1-c1'])
    expect(stop.blockerIds).toEqual([])
  })

  it('extraMovesTotal matches the report metric (same findBlockers rule)', () => {
    expect(plan.extraMovesTotal).toBe(1)
    expect(plan.extraMovesTotal).toBe(blockingTrip.metrics.extraUnloadingMoves)
  })
})

describe('buildRoutePlan — demo fixture', () => {
  const plan = buildRoutePlan(demoTrip, demoScenario)

  it('front-row items delivered at earlier stops never count as blockers', () => {
    // shop-3's rear-row boxes geometrically front shop-2's, but they leave at
    // stop 1 — the plan must show a blocker-free route, like the metric does.
    expect(plan.stops.every((s) => s.blockerIds.length === 0)).toBe(true)
    expect(plan.extraMovesTotal).toBe(demoTrip.metrics.extraUnloadingMoves)
    expect(plan.extraMovesTotal).toBe(0)
  })

  it('delivers every placement exactly once across the route', () => {
    const delivered = plan.stops.flatMap((s) => s.deliverIds).sort()
    const placed = demoTrip.placements.map((p) => p.cargoId).sort()
    expect(delivered).toEqual(placed)
  })

  it('same-distance unload order is id-stable', () => {
    expect(plan.stops[1].deliverIds).toEqual(['shop-2-c1', 'shop-2-c2', 'shop-2-c3'])
  })
})

describe('itemDeliveredNow — balance/visibility predicate', () => {
  // Blocking route delivers: shop-3-c1 @ stop 0, shop-2-c1 & shop-2-c2 @ stop 1,
  // shop-1-c1 @ stop 2.
  const plan = buildRoutePlan(blockingTrip, demoBlockingScenario)
  const deliveredAtStop = new Map<string, number>()
  plan.stops.forEach((stop, i) => stop.deliverIds.forEach((id) => deliveredAtStop.set(id, i)))

  const state = (phase: StopState['phase'], opIndex: number | null = null): StopState => ({
    phase,
    opIndex,
    opProgress: 0,
    doorOpen: false,
  })

  it('nothing is delivered before its stop begins its ops', () => {
    const stop = plan.stops[0]
    const at = (id: string) => itemDeliveredNow(id, 0, state('highlight'), stop, deliveredAtStop)
    expect(at('shop-3-c1')).toBe(false)
    expect(at('shop-2-c1')).toBe(false)
    expect(at('shop-1-c1')).toBe(false)
  })

  it("a stop's cargo counts as delivered once the stop is done", () => {
    const stop = plan.stops[0]
    expect(itemDeliveredNow('shop-3-c1', 0, state('done'), stop, deliveredAtStop)).toBe(true)
  })

  it('cargo delivered at an earlier stop stays delivered at later stops', () => {
    const stop = plan.stops[1]
    expect(itemDeliveredNow('shop-3-c1', 1, state('door-open'), stop, deliveredAtStop)).toBe(true)
    // this stop's own cargo is still aboard at the very start of the stop
    expect(itemDeliveredNow('shop-2-c1', 1, state('door-open'), stop, deliveredAtStop)).toBe(false)
  })

  it('within a stop, an item is delivered only after its own deliver op completes', () => {
    const stop = plan.stops[1] // ops: deliver shop-2-c1, deliver shop-2-c2
    // sliding the 2nd box (opIndex 1): the 1st is already handed off, the 2nd is not
    const midStop = state('op', 1)
    expect(itemDeliveredNow('shop-2-c1', 1, midStop, stop, deliveredAtStop)).toBe(true)
    expect(itemDeliveredNow('shop-2-c2', 1, midStop, stop, deliveredAtStop)).toBe(false)
  })

  it('an item with no delivery stop is never delivered', () => {
    expect(itemDeliveredNow('ghost', 0, state('done'), plan.stops[0], deliveredAtStop)).toBe(false)
  })
})

describe('stopStateAt / stopDuration', () => {
  const stop = buildRoutePlan(blockingTrip, demoBlockingScenario).stops[0] // 3 ops

  it('duration = (3 + ops) × phase', () => {
    expect(stopDuration(stop)).toBeCloseTo(DELIVERY_PHASE_S * 6)
  })

  it('walks door-open → highlight → ops → door-close → done', () => {
    expect(stopStateAt(0, stop)).toMatchObject({ phase: 'door-open', doorOpen: true })
    expect(stopStateAt(0.7, stop)).toMatchObject({ phase: 'highlight', doorOpen: true })

    const op0 = stopStateAt(1.3, stop)
    expect(op0).toMatchObject({ phase: 'op', opIndex: 0, doorOpen: true })
    expect(op0.opProgress).toBeCloseTo((1.3 - 1.2) / DELIVERY_PHASE_S)

    expect(stopStateAt(1.9, stop)).toMatchObject({ phase: 'op', opIndex: 1 })
    expect(stopStateAt(2.5, stop)).toMatchObject({ phase: 'op', opIndex: 2 })
    expect(stopStateAt(3.1, stop)).toMatchObject({ phase: 'door-close', doorOpen: false })
    expect(stopStateAt(99, stop)).toMatchObject({ phase: 'done', doorOpen: false })
  })

  it('a stop with no ops still opens and closes the door', () => {
    const empty = { ...stop, ops: [] }
    expect(stopDuration(empty)).toBeCloseTo(DELIVERY_PHASE_S * 3)
    expect(stopStateAt(1.3, empty)).toMatchObject({ phase: 'door-close', doorOpen: false })
  })
})

describe('geometry helpers', () => {
  it('distanceToDoor per side', () => {
    const vehicle = demoBlockingScenario.vehicle // width 240
    const box = {
      cargoId: 'x',
      templateId: 'medium-box' as const,
      min: { x: 30, y: 0, z: 50 },
      size: { width: 60, height: 40, depth: 40 },
      weightKg: 20,
    }
    const door = (side: 'rear' | 'left' | 'right') => ({
      id: `d-${side}`,
      side,
      width: 100,
      height: 100,
      position: { x: 0, y: 0, z: 0 },
    })
    expect(distanceToDoor(box, door('rear'), vehicle)).toBe(50)
    expect(distanceToDoor(box, door('left'), vehicle)).toBe(30)
    expect(distanceToDoor(box, door('right'), vehicle)).toBe(240 - 90)
  })

  it('blockerStagingSlot fans out alternating along the wall axis', () => {
    const staging: [number, number, number] = [1.2, 0.3, -1.5]
    const near = (v: number[]) => v.map((n) => expect.closeTo(n, 6))
    expect(blockerStagingSlot(staging, 'rear', 0)).toEqual(near([2.1, 0.3, -1.5]))
    expect(blockerStagingSlot(staging, 'rear', 1)).toEqual(near([0.3, 0.3, -1.5]))
    expect(blockerStagingSlot(staging, 'rear', 2)).toEqual(near([3.0, 0.3, -1.5]))
    // Side doors fan along Z instead.
    expect(blockerStagingSlot(staging, 'left', 0)).toEqual(near([1.2, 0.3, -0.6]))
  })

  it('pathAt hits every anchor exactly at its segment boundary and clamps', () => {
    const pts: [number, number, number][] = [
      [0, 0, 0],
      [1, 2, 3],
      [2, 2, 3],
      [4, 4, 4],
    ]
    expect(pathAt(0, pts)).toEqual(pts[0])
    expect(pathAt(1 / 3, pts)).toEqual(pts[1])
    expect(pathAt(2 / 3, pts)).toEqual(pts[2])
    expect(pathAt(1, pts)).toEqual(pts[3])
    expect(pathAt(-1, pts)).toEqual(pts[0])
    expect(pathAt(2, pts)).toEqual(pts[3])
  })
})
