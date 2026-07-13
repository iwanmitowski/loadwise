import { describe, expect, it } from 'vitest'
import { DEFAULT_OPTIMIZER_CONFIG } from '@/features/optimizer/config'
import type {
  CargoItem,
  CargoPlacement,
  DeliveryStop,
  Scenario,
  Shop,
  VehicleDefinition,
} from '@/types'
import { buildTripMetrics } from './metrics'

// A hand-built 400×200×400 vehicle so utilizations come out to clean fractions.
// Volume = 200·200·400 = 16,000,000 cm³, payload 1000 kg. Rear door only.
const vehicle: VehicleDefinition = {
  id: 'box-truck',
  name: 'Test box',
  cargoSpace: { width: 200, height: 200, depth: 400 },
  maxPayloadKg: 1000,
  doors: [{ id: 'rear', side: 'rear', width: 200, height: 200, position: { x: 0, y: 0, z: 0 } }],
}

// Three large boxes (80×60×60, 40 kg, volume 288,000 cm³ each).
//   b1 → shop-1 (deliveryOrder 1 → stop 1) placed DEEP  (z 100), straddling mid-x.
//   b2 → shop-2 (deliveryOrder 2 → stop 2) placed at the rear-left.
//   b3 → shop-2 (deliveryOrder 2 → stop 2) placed at the rear-right.
// b2 and b3 sit in front of b1 (nearer the rear door) and are delivered later, so
// they both block b1 — the earlier delivery.
const shop1Cargo: CargoItem[] = [{ id: 'shop-1-c1', templateId: 'large-box', shopId: 'shop-1' }]
const shop2Cargo: CargoItem[] = [
  { id: 'shop-2-c1', templateId: 'large-box', shopId: 'shop-2' },
  { id: 'shop-2-c2', templateId: 'large-box', shopId: 'shop-2' },
]

const shops: Shop[] = [
  { id: 'shop-1', name: 'Alpha', type: 'general-store', deliveryOrder: 1, preferredDoor: 'rear', requestedCargo: shop1Cargo },
  { id: 'shop-2', name: 'Beta', type: 'general-store', deliveryOrder: 2, preferredDoor: 'rear', requestedCargo: shop2Cargo },
]

const scenario: Scenario = {
  config: { seed: 't', vehicleId: 'box-truck', sideDoor: 'none', shopCount: 2 },
  vehicle,
  shops,
}

const placements: CargoPlacement[] = [
  { cargoId: 'shop-1-c1', tripId: 'trip-1', position: { x: 60, y: 0, z: 100 }, rotationY: 0, loadingOrder: 1, assignedDoor: 'rear' },
  { cargoId: 'shop-2-c1', tripId: 'trip-1', position: { x: 0, y: 0, z: 0 }, rotationY: 0, loadingOrder: 2, assignedDoor: 'rear' },
  { cargoId: 'shop-2-c2', tripId: 'trip-1', position: { x: 120, y: 0, z: 0 }, rotationY: 0, loadingOrder: 3, assignedDoor: 'rear' },
]

const stops: DeliveryStop[] = [
  { shopId: 'shop-1', stopNumber: 1, door: 'rear' },
  { shopId: 'shop-2', stopNumber: 2, door: 'rear' },
]

describe('buildTripMetrics — hand-computed fixture', () => {
  const m = buildTripMetrics({ placements, deferredCargo: [], stops }, scenario, 3, DEFAULT_OPTIMIZER_CONFIG)

  it('counts requested / loaded / deferred units', () => {
    expect(m.requestedUnits).toBe(3)
    expect(m.loadedUnits).toBe(3)
    expect(m.deferredUnits).toBe(0)
  })

  it('sums weight and volume with their utilizations', () => {
    expect(m.totalWeightKg).toBe(120) // 3 × 40
    expect(m.usedVolumeCm3).toBe(864_000) // 3 × 288,000
    expect(m.weightUtilization).toBeCloseTo(0.12, 10) // 120 / 1000
    expect(m.volumeUtilization).toBeCloseTo(0.054, 10) // 864,000 / 16,000,000
    expect(m.emptyVolumeCm3).toBe(15_136_000) // 16,000,000 − 864,000
  })

  it('computes proportional balances (b1 straddles the x mid-plane)', () => {
    // Left/right: b1 splits 20/20, b2 all-left (40), b3 all-right (40) → 60 vs 60.
    expect(m.leftRightBalance).toBeCloseTo(1, 10)
    // Front/rear: every box sits at z < 200, so all 120 kg is in the rear half.
    expect(m.frontRearBalance).toBeCloseTo(0, 10)
  })

  it('counts blocked cargo and extra unloading moves', () => {
    expect(m.blockedCargoCount).toBe(1) // only b1 (stop 1) is blocked by later items
    expect(m.extraUnloadingMoves).toBe(2) // b2 and b3 must both move to reach b1
  })

  it('self-checks with zero constraint violations and no splits', () => {
    expect(m.constraintViolations).toBe(0)
    expect(m.splitShopIds).toEqual([])
  })

  it('scores the trip: round(1.35 + 1.8 + 10 + 16.667 + 15) = 45', () => {
    expect(m.overallScore).toBe(45)
  })
})

describe('buildTripMetrics — guards', () => {
  it('zero-cargo trip: zero ratios, balances of 1, score 0', () => {
    const m = buildTripMetrics({ placements: [], deferredCargo: [], stops: [] }, scenario, 0, DEFAULT_OPTIMIZER_CONFIG)
    expect(m.loadedUnits).toBe(0)
    expect(m.totalWeightKg).toBe(0)
    expect(m.weightUtilization).toBe(0)
    expect(m.volumeUtilization).toBe(0)
    expect(m.emptyVolumeCm3).toBe(16_000_000)
    expect(m.leftRightBalance).toBe(1)
    expect(m.frontRearBalance).toBe(1)
    expect(m.overallScore).toBe(0)
  })

  it('single item entirely on one side is fully imbalanced', () => {
    const single: CargoPlacement[] = [
      { cargoId: 'shop-2-c1', tripId: 'trip-1', position: { x: 0, y: 0, z: 0 }, rotationY: 0, loadingOrder: 1, assignedDoor: 'rear' },
    ]
    const m = buildTripMetrics(
      { placements: single, deferredCargo: [], stops: [{ shopId: 'shop-2', stopNumber: 1, door: 'rear' }] },
      scenario,
      1,
      DEFAULT_OPTIMIZER_CONFIG,
    )
    // Box spans x[0,80], all left of the x=100 mid-plane.
    expect(m.leftRightBalance).toBe(0)
    expect(m.blockedCargoCount).toBe(0)
  })

  it('detects a split shop from placed + deferred cargo', () => {
    const m = buildTripMetrics(
      {
        placements,
        deferredCargo: [{ cargoId: 'shop-2-c3', shopId: 'shop-2', reason: 'no-valid-placement', permanent: false }],
        stops,
      },
      scenario,
      4,
      DEFAULT_OPTIMIZER_CONFIG,
    )
    expect(m.splitShopIds).toEqual(['shop-2'])
    expect(m.deferredUnits).toBe(1)
  })
})
