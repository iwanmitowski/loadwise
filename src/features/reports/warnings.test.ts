import { describe, expect, it } from 'vitest'
import type {
  CargoItem,
  CargoPlacement,
  DeliveryTrip,
  OptimizationMetrics,
  OptimizationResult,
  OptimizationWarning,
  Scenario,
  Shop,
  UnplacedCargo,
  VehicleDefinition,
} from '@/types'
import { buildWarnings } from './warnings'

const vehicle: VehicleDefinition = {
  id: 'box-truck',
  name: 'Test box',
  cargoSpace: { width: 200, height: 200, depth: 400 },
  maxPayloadKg: 1000,
  doors: [{ id: 'rear', side: 'rear', width: 200, height: 200, position: { x: 0, y: 0, z: 0 } }],
}

const shop1Cargo: CargoItem[] = [{ id: 'shop-1-c1', templateId: 'large-box', shopId: 'shop-1' }]
const shops: Shop[] = [
  { id: 'shop-1', name: 'Alpha', type: 'general-store', deliveryOrder: 1, preferredDoor: 'rear', requestedCargo: shop1Cargo },
  { id: 'shop-2', name: 'Beta', type: 'beverage-store', deliveryOrder: 2, preferredDoor: 'rear', requestedCargo: [] },
]
const scenario: Scenario = {
  config: { seed: 't', vehicleId: 'box-truck', sideDoor: 'none', shopCount: 2 },
  vehicle,
  shops,
}

const aPlacement: CargoPlacement = {
  cargoId: 'shop-1-c1',
  tripId: 'trip-1',
  position: { x: 0, y: 0, z: 0 },
  rotationY: 0,
  loadingOrder: 1,
  assignedDoor: 'rear',
}

const baseMetrics: OptimizationMetrics = {
  requestedUnits: 1,
  loadedUnits: 1,
  deferredUnits: 0,
  totalWeightKg: 40,
  weightUtilization: 0.5,
  usedVolumeCm3: 0,
  volumeUtilization: 0.5,
  emptyVolumeCm3: 0,
  leftRightBalance: 1,
  frontRearBalance: 1,
  blockedCargoCount: 0,
  extraUnloadingMoves: 0,
  splitShopIds: [],
  constraintViolations: 0,
  overallScore: 50,
}

type TripOverrides = {
  placements?: CargoPlacement[]
  deferredCargo?: UnplacedCargo[]
  metrics?: Partial<OptimizationMetrics>
}

function makeTrip(over: TripOverrides): DeliveryTrip {
  return {
    id: 'trip-1',
    tripNumber: 1,
    stops: [{ shopId: 'shop-1', stopNumber: 1, door: 'rear' }],
    placements: over.placements ?? [aPlacement],
    deferredCargo: over.deferredCargo ?? [],
    metrics: { ...baseMetrics, ...over.metrics },
  }
}

function makeResult(trips: DeliveryTrip[], extra?: Partial<OptimizationResult>): OptimizationResult {
  return {
    seed: 't',
    vehicleId: 'box-truck',
    trips,
    unplaceableCargo: extra?.unplaceableCargo ?? [],
    warnings: extra?.warnings ?? [],
    overallScore: 0,
    elapsedMs: 0,
  }
}

const codesOf = (ws: OptimizationWarning[]) => ws.map((w) => w.code)

describe('buildWarnings — one trigger per code', () => {
  it('weight-limited: high weight, low volume', () => {
    const ws = buildWarnings(
      makeResult([makeTrip({ metrics: { weightUtilization: 0.95, volumeUtilization: 0.5 } })]),
      scenario,
    )
    const w = ws.find((x) => x.code === 'weight-limited')
    expect(w?.message).toBe('Trip 1 reached weight capacity before volume capacity.')
    expect(w?.tripId).toBe('trip-1')
  })

  it('volume-limited: high volume, low weight', () => {
    const ws = buildWarnings(
      makeResult([makeTrip({ metrics: { volumeUtilization: 0.95, weightUtilization: 0.5 } })]),
      scenario,
    )
    expect(ws.find((x) => x.code === 'volume-limited')?.message).toBe(
      'Trip 1 reached volume capacity before weight capacity.',
    )
  })

  it('imbalance: names the heavier side and the gap percentage', () => {
    // Single large box at x=0 → all weight on the left. Balance overridden to 0.6.
    const ws = buildWarnings(
      makeResult([makeTrip({ metrics: { leftRightBalance: 0.6 } })]),
      scenario,
    )
    expect(ws.find((x) => x.code === 'imbalance')?.message).toBe(
      'The left side is 40% heavier than the right.',
    )
  })

  it('imbalance is asymmetric: rear-heavy warns at 0.88 front/rear balance', () => {
    // Default placement sits at z=0 (rear half) → the load is rear-heavy, so the
    // stricter 0.9 threshold applies (steering-axle risk on the rear overhang).
    const ws = buildWarnings(
      makeResult([makeTrip({ metrics: { frontRearBalance: 0.88 } })]),
      scenario,
    )
    expect(ws.find((x) => x.code === 'imbalance')?.message).toBe(
      'The rear of the load is 12% heavier than the front.',
    )
  })

  it('imbalance is asymmetric: front-heavy does NOT warn at 0.88', () => {
    // Same balance value, but the mass sits in the cabin half (z=340..400) —
    // front bias is safe, so the lenient 0.75 threshold applies.
    const frontPlacement: CargoPlacement = { ...aPlacement, position: { x: 0, y: 0, z: 340 } }
    const ws = buildWarnings(
      makeResult([
        makeTrip({ placements: [frontPlacement], metrics: { frontRearBalance: 0.88 } }),
      ]),
      scenario,
    )
    expect(ws.find((x) => x.code === 'imbalance')).toBeUndefined()
  })

  it('imbalance: front-heavy warns only when extreme AND heavily loaded', () => {
    const frontPlacement: CargoPlacement = { ...aPlacement, position: { x: 0, y: 0, z: 340 } }
    // Light load (util 0.5 default): front bias is the front-pack rule working
    // as intended — silent even at balance 0.4.
    const silent = buildWarnings(
      makeResult([
        makeTrip({ placements: [frontPlacement], metrics: { frontRearBalance: 0.4 } }),
      ]),
      scenario,
    )
    expect(silent.find((x) => x.code === 'imbalance')).toBeUndefined()

    // Heavy load (util 0.8): extreme nose bias is a real axle concern — warns.
    const warned = buildWarnings(
      makeResult([
        makeTrip({
          placements: [frontPlacement],
          metrics: { frontRearBalance: 0.4, weightUtilization: 0.8 },
        }),
      ]),
      scenario,
    )
    expect(warned.find((x) => x.code === 'imbalance')?.message).toBe(
      'The front of the load is 60% heavier than the rear.',
    )
  })

  it('imbalance: rear-heavy at light load flags the steering axle', () => {
    const ws = buildWarnings(
      makeResult([
        makeTrip({ metrics: { frontRearBalance: 0.8, weightUtilization: 0.4 } }),
      ]),
      scenario,
    )
    expect(ws.find((x) => x.code === 'imbalance')?.message).toBe(
      'The rear of the load is 20% heavier than the front.' +
        ' Rear-heavy at light load can unload the steering axle.',
    )
  })

  it('imbalance names the axis that tripped, not just the worse value', () => {
    // frontRear 0.88 trips (rear-heavy, threshold 0.9); leftRight 0.89 does not
    // (threshold 0.85) even though the two values are close — message must name
    // the z axis.
    const ws = buildWarnings(
      makeResult([
        makeTrip({ metrics: { frontRearBalance: 0.88, leftRightBalance: 0.89 } }),
      ]),
      scenario,
    )
    expect(ws.find((x) => x.code === 'imbalance')?.message).toContain('rear of the load')
  })

  it('shop-split: names the shop and the two trips', () => {
    const ws = buildWarnings(
      makeResult([makeTrip({ metrics: { splitShopIds: ['shop-1'] } })]),
      scenario,
    )
    expect(ws.find((x) => x.code === 'shop-split')?.message).toBe(
      'Order for Alpha was split between trips 1 and 2.',
    )
  })

  it('deferred-cargo: counts items moved to the next trip', () => {
    const deferred: UnplacedCargo[] = [
      { cargoId: 'shop-1-c2', shopId: 'shop-1', reason: 'no-valid-placement', permanent: false },
      { cargoId: 'shop-1-c3', shopId: 'shop-1', reason: 'no-valid-placement', permanent: false },
    ]
    const ws = buildWarnings(makeResult([makeTrip({ deferredCargo: deferred })]), scenario)
    expect(ws.find((x) => x.code === 'deferred-cargo')?.message).toBe('2 item(s) moved to trip 2.')
  })

  it('unplaceable-cargo: counts permanent items and summarizes reasons', () => {
    const unplaceable: UnplacedCargo[] = [
      { cargoId: 'a', shopId: 'shop-1', reason: 'exceeds-vehicle-dimensions', permanent: true },
      { cargoId: 'b', shopId: 'shop-1', reason: 'exceeds-payload', permanent: true },
    ]
    const ws = buildWarnings(makeResult([makeTrip({})], { unplaceableCargo: unplaceable }), scenario)
    const w = ws.find((x) => x.code === 'unplaceable-cargo')
    expect(w?.message).toBe('2 item(s) cannot be loaded: 1 too large for the vehicle, 1 too heavy for the vehicle.')
    expect(w?.tripId).toBeUndefined()
  })

  it('unsecured-cargo: an item with no forward blocking chain warns', () => {
    // Default placement is at z=0 with the bay 400 deep — nothing between it
    // and the front wall, so braking would slide it forward.
    const ws = buildWarnings(makeResult([makeTrip({})]), scenario)
    expect(ws.find((x) => x.code === 'unsecured-cargo')?.message).toBe(
      '1 item(s) have no forward blocking against braking — secure with lashings.',
    )
  })

  it('unsecured-cargo: an item flush against the front wall does not warn', () => {
    // large-box is 60 deep; z=340 puts its front face exactly on the 400 wall.
    const frontPlacement: CargoPlacement = { ...aPlacement, position: { x: 0, y: 0, z: 340 } }
    const ws = buildWarnings(makeResult([makeTrip({ placements: [frontPlacement] })]), scenario)
    expect(ws.find((x) => x.code === 'unsecured-cargo')).toBeUndefined()
  })

  it('blocked-cargo: counts items needing others moved', () => {
    const ws = buildWarnings(
      makeResult([makeTrip({ metrics: { blockedCargoCount: 2 } })]),
      scenario,
    )
    expect(ws.find((x) => x.code === 'blocked-cargo')?.message).toBe(
      '2 item(s) require moving other cargo when unloading.',
    )
  })

  it('empty-trip: a trip with no placements', () => {
    const ws = buildWarnings(makeResult([makeTrip({ placements: [] })]), scenario)
    expect(ws.find((x) => x.code === 'empty-trip')?.message).toBe('Trip 1 is empty.')
    // An empty trip suppresses the other per-trip warnings.
    expect(codesOf(ws)).toEqual(['empty-trip'])
  })

  it('time-limit: passed through from the optimizer', () => {
    const timeLimit: OptimizationWarning = {
      code: 'time-limit',
      message: 'Optimization stopped at the time limit; result may be partial.',
    }
    const ws = buildWarnings(makeResult([makeTrip({})], { warnings: [timeLimit] }), scenario)
    expect(ws).toContainEqual(timeLimit)
  })
})
