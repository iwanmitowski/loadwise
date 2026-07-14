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

import { DEFAULT_OPTIMIZER_CONFIG } from '@/features/optimizer/config'
import { buildTripMetrics } from '@/features/reports/metrics'
import { overallScore } from '@/features/reports/score'
import { buildScenarioVehicle } from '@/features/vehicles/vehicles'
import type {
  CargoItem,
  CargoPlacement,
  DeliveryStop,
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

// Metrics are now computed from the layout by T08's `buildTripMetrics` — no more
// hand-picked balance/quality placeholders. The 10 requested units break down as
// 9 placed + 1 deferred (`requestedUnitsForTrip = 10`).
const metrics = buildTripMetrics(
  { placements, deferredCargo, stops },
  demoScenario,
  10,
  DEFAULT_OPTIMIZER_CONFIG,
)

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
      message: '1 item(s) moved to trip 2.',
      tripId: 'trip-1',
    },
  ],
  overallScore: overallScore([metrics], []),
  elapsedMs: 0,
}

// --- Side-door variant (T14) ---
// Same layout on the box-truck with the LEFT side door fitted; shop-2's cargo
// loads/unloads through it (rear door for the rest). Exists so the side-door
// loading-animation staging path has a deterministic fixture to exercise.

export const demoSideDoorScenario: Scenario = {
  config: {
    seed: 'demo-side',
    vehicleId: 'box-truck',
    sideDoor: 'left',
    shopCount: 3,
  },
  vehicle: buildScenarioVehicle('box-truck', 'left'),
  shops,
}

const sideDoorPlacements: CargoPlacement[] = placements.map((p) =>
  p.cargoId.startsWith('shop-2') ? { ...p, assignedDoor: 'left' } : p,
)

const sideDoorStops: DeliveryStop[] = stops.map((s) =>
  s.shopId === 'shop-2' ? { ...s, door: 'left' } : s,
)

const sideDoorMetrics = buildTripMetrics(
  { placements: sideDoorPlacements, deferredCargo, stops: sideDoorStops },
  demoSideDoorScenario,
  10,
  DEFAULT_OPTIMIZER_CONFIG,
)

export const demoSideDoorResult: OptimizationResult = {
  seed: 'demo-side',
  vehicleId: 'box-truck',
  trips: [
    {
      id: 'trip-1',
      tripNumber: 1,
      stops: sideDoorStops,
      placements: sideDoorPlacements,
      deferredCargo,
      metrics: sideDoorMetrics,
    },
  ],
  unplaceableCargo: [],
  warnings: [
    {
      code: 'deferred-cargo',
      message: '1 item(s) moved to trip 2.',
      tripId: 'trip-1',
    },
  ],
  overallScore: overallScore([sideDoorMetrics], []),
  elapsedMs: 0,
}

// --- Blocking variant (T15) ---
// Deliberately "badly packed" 4-item load on the box-truck: shop-2's large box
// (delivered at stop 2) sits directly in front of shop-3's (stop 1) on the way
// to the rear door, so unloading stop 1 requires one temporary blocker move
// (extraUnloadingMoves = 1). shop-2's medium box also fronts shop-1's pallet,
// but by stop 3 it is already delivered — no extra move there. Layout:
//   z 540–620, x 120–240 → shop-1 standard-pallet   (stop 3)
//   z  60–120, x   0–80  → shop-3 large-box         (stop 1, blocked)
//   z   0–60,  x   0–80  → shop-2 large-box         (stop 2, THE blocker)
//   z   0–40,  x 120–180 → shop-2 medium-box        (stop 2)

const blockingShops: Shop[] = [
  {
    id: 'shop-1',
    name: 'Metro Market',
    type: 'supermarket',
    deliveryOrder: 3,
    preferredDoor: 'rear',
    requestedCargo: [{ id: 'shop-1-c1', templateId: 'standard-pallet', shopId: 'shop-1' }],
  },
  {
    id: 'shop-2',
    name: 'Hop Cellar',
    type: 'beverage-store',
    deliveryOrder: 2,
    preferredDoor: 'rear',
    requestedCargo: [
      { id: 'shop-2-c1', templateId: 'large-box', shopId: 'shop-2' },
      { id: 'shop-2-c2', templateId: 'medium-box', shopId: 'shop-2' },
    ],
  },
  {
    id: 'shop-3',
    name: 'Volt Hub',
    type: 'electronics-store',
    deliveryOrder: 1,
    preferredDoor: 'rear',
    requestedCargo: [{ id: 'shop-3-c1', templateId: 'large-box', shopId: 'shop-3' }],
  },
]

export const demoBlockingScenario: Scenario = {
  config: {
    seed: 'demo-blocking',
    vehicleId: 'box-truck',
    sideDoor: 'none',
    shopCount: 3,
  },
  vehicle: buildScenarioVehicle('box-truck', 'none'),
  shops: blockingShops,
}

const blockingPlacements: CargoPlacement[] = [
  { cargoId: 'shop-1-c1', tripId: 'trip-1', position: { x: 120, y: 0, z: 540 }, rotationY: 0, loadingOrder: 1, assignedDoor: 'rear' },
  { cargoId: 'shop-3-c1', tripId: 'trip-1', position: { x: 0, y: 0, z: 60 }, rotationY: 0, loadingOrder: 2, assignedDoor: 'rear' },
  { cargoId: 'shop-2-c1', tripId: 'trip-1', position: { x: 0, y: 0, z: 0 }, rotationY: 0, loadingOrder: 3, assignedDoor: 'rear' },
  { cargoId: 'shop-2-c2', tripId: 'trip-1', position: { x: 120, y: 0, z: 0 }, rotationY: 0, loadingOrder: 4, assignedDoor: 'rear' },
]

const blockingStops: DeliveryStop[] = [
  { shopId: 'shop-3', stopNumber: 1, door: 'rear' },
  { shopId: 'shop-2', stopNumber: 2, door: 'rear' },
  { shopId: 'shop-1', stopNumber: 3, door: 'rear' },
]

const blockingMetrics = buildTripMetrics(
  { placements: blockingPlacements, deferredCargo: [], stops: blockingStops },
  demoBlockingScenario,
  4,
  DEFAULT_OPTIMIZER_CONFIG,
)

export const demoBlockingResult: OptimizationResult = {
  seed: 'demo-blocking',
  vehicleId: 'box-truck',
  trips: [
    {
      id: 'trip-1',
      tripNumber: 1,
      stops: blockingStops,
      placements: blockingPlacements,
      deferredCargo: [],
      metrics: blockingMetrics,
    },
  ],
  unplaceableCargo: [],
  warnings: [],
  overallScore: overallScore([blockingMetrics], []),
  elapsedMs: 0,
}
