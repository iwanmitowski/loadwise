// Hand-authored demo dataset for the box-truck (240×230×620, rear door only).
// Hard-coded and obviously valid (no overlaps, in bounds, stacking legal) so
// Tracks B and C can build against realistic data before the optimizer exists.
// Numbers here are authored, NOT computed — see docs/prompts/T03-rng-and-fixtures.md.
//
// Layout (viewed from the rear door): delivery order 1 is unloaded first, so it
// sits nearest the rear door (low z); order 3 is stowed deepest (high z).
//   z 0–40    → shop-3 "Volt Hub"    (deliveryOrder 1, unloaded first)
//   z 460–540 → shop-2 "Hop Cellar"  (deliveryOrder 2)
//   z 540–620 → shop-1 "Metro Market"(deliveryOrder 3, unloaded last)

import { buildScenarioVehicle } from '@/features/vehicles/vehicles'
import type {
  CargoItem,
  CargoPlacement,
  DeliveryStop,
  OptimizationMetrics,
  OptimizationResult,
  Scenario,
  Shop,
  UnplacedCargo,
} from '@/types'

// --- Requested cargo per shop (all 10 units: 9 placed + 1 deferred) ---

const shop1Cargo: CargoItem[] = [
  { id: 'shop-1-c1', templateId: 'standard-pallet', shopId: 'shop-1' },
  { id: 'shop-1-c2', templateId: 'standard-pallet', shopId: 'shop-1' },
]

const shop2Cargo: CargoItem[] = [
  { id: 'shop-2-c1', templateId: 'beverage-pallet', shopId: 'shop-2' },
  { id: 'shop-2-c2', templateId: 'large-box', shopId: 'shop-2' },
  { id: 'shop-2-c3', templateId: 'medium-box', shopId: 'shop-2' },
  // Deferred to a later trip — no valid placement remained this trip.
  { id: 'shop-2-c4', templateId: 'beverage-pallet', shopId: 'shop-2' },
]

const shop3Cargo: CargoItem[] = [
  { id: 'shop-3-c1', templateId: 'beverage-stack', shopId: 'shop-3' },
  { id: 'shop-3-c2', templateId: 'beverage-stack', shopId: 'shop-3' },
  { id: 'shop-3-c3', templateId: 'fragile-box', shopId: 'shop-3' },
  { id: 'shop-3-c4', templateId: 'medium-box', shopId: 'shop-3' },
]

const shops: Shop[] = [
  {
    id: 'shop-1',
    name: 'Metro Market',
    type: 'supermarket',
    deliveryOrder: 3,
    preferredDoor: 'rear',
    requestedCargo: shop1Cargo,
  },
  {
    id: 'shop-2',
    name: 'Hop Cellar',
    type: 'beverage-store',
    deliveryOrder: 2,
    preferredDoor: 'rear',
    requestedCargo: shop2Cargo,
  },
  {
    id: 'shop-3',
    name: 'Volt Hub',
    type: 'electronics-store',
    deliveryOrder: 1,
    preferredDoor: 'rear',
    requestedCargo: shop3Cargo,
  },
]

export const demoScenario: Scenario = {
  config: {
    seed: 'demo',
    vehicleId: 'box-truck',
    sideDoor: 'none',
    shopCount: 3,
  },
  vehicle: buildScenarioVehicle('box-truck', 'none'),
  shops,
}

// --- Placements (verbatim from the T03 layout table) ---

const placements: CargoPlacement[] = [
  { cargoId: 'shop-1-c1', tripId: 'trip-1', position: { x: 0, y: 0, z: 540 }, rotationY: 0, loadingOrder: 1, assignedDoor: 'rear' },
  { cargoId: 'shop-1-c2', tripId: 'trip-1', position: { x: 120, y: 0, z: 540 }, rotationY: 0, loadingOrder: 2, assignedDoor: 'rear' },
  { cargoId: 'shop-2-c1', tripId: 'trip-1', position: { x: 0, y: 0, z: 460 }, rotationY: 0, loadingOrder: 3, assignedDoor: 'rear' },
  { cargoId: 'shop-2-c2', tripId: 'trip-1', position: { x: 120, y: 0, z: 460 }, rotationY: 0, loadingOrder: 4, assignedDoor: 'rear' },
  { cargoId: 'shop-2-c3', tripId: 'trip-1', position: { x: 120, y: 60, z: 460 }, rotationY: 0, loadingOrder: 5, assignedDoor: 'rear' },
  { cargoId: 'shop-3-c1', tripId: 'trip-1', position: { x: 0, y: 0, z: 0 }, rotationY: 0, loadingOrder: 6, assignedDoor: 'rear' },
  { cargoId: 'shop-3-c2', tripId: 'trip-1', position: { x: 40, y: 0, z: 0 }, rotationY: 0, loadingOrder: 7, assignedDoor: 'rear' },
  { cargoId: 'shop-3-c3', tripId: 'trip-1', position: { x: 120, y: 0, z: 0 }, rotationY: 0, loadingOrder: 8, assignedDoor: 'rear' },
  { cargoId: 'shop-3-c4', tripId: 'trip-1', position: { x: 180, y: 0, z: 0 }, rotationY: 0, loadingOrder: 9, assignedDoor: 'rear' },
]

const deferredCargo: UnplacedCargo[] = [
  {
    cargoId: 'shop-2-c4',
    shopId: 'shop-2',
    reason: 'no-valid-placement',
    permanent: false,
    detail: 'No valid placement remained for the second beverage pallet this trip.',
  },
]

// Unloaded first (order 1) → last (order 3): shop-3, shop-2, shop-1.
const stops: DeliveryStop[] = [
  { shopId: 'shop-3', stopNumber: 1, door: 'rear' },
  { shopId: 'shop-2', stopNumber: 2, door: 'rear' },
  { shopId: 'shop-1', stopNumber: 3, door: 'rear' },
]

// Metrics: totalWeightKg and utilizations are computed by hand from the layout;
// the balance/quality figures are plausible hand-picked placeholders (this is a
// fixture, not optimizer output). See T03 prompt.
const metrics: OptimizationMetrics = {
  requestedUnits: 10,
  loadedUnits: 9,
  deferredUnits: 1,
  totalWeightKg: 1482,
  weightUtilization: 0.3, // 1482 / 5000 ≈ 0.296
  usedVolumeCm3: 5_228_000,
  volumeUtilization: 0.15, // 5,228,000 / 34,224,000 ≈ 0.153
  emptyVolumeCm3: 28_996_000, // 34,224,000 − 5,228,000
  leftRightBalance: 0.62,
  frontRearBalance: 0.71,
  blockedCargoCount: 0,
  extraUnloadingMoves: 0,
  splitShopIds: [],
  constraintViolations: 0,
  overallScore: 78,
}

export const demoResult: OptimizationResult = {
  seed: 'demo',
  vehicleId: 'box-truck',
  trips: [
    {
      id: 'trip-1',
      tripNumber: 1,
      stops,
      placements,
      deferredCargo,
      metrics,
    },
  ],
  unplaceableCargo: [],
  warnings: [
    {
      code: 'deferred-cargo',
      message: '1 beverage pallet moved to a later trip',
      tripId: 'trip-1',
    },
  ],
  overallScore: 78,
  elapsedMs: 0,
}
