import type { Vec3 } from './geometry'
import type { DoorSide, VehicleId } from './vehicle'

export type UnplacedReason =
  | 'exceeds-vehicle-dimensions'
  | 'exceeds-payload'
  | 'no-valid-placement'
  | 'stacking-constraint'
  | 'accessibility-constraint'
  | 'trip-limit-reached'

export type UnplacedCargo = {
  cargoId: string
  shopId: string
  reason: UnplacedReason
  /** `true` when the item can never be placed (e.g. exceeds vehicle dimensions). */
  permanent: boolean
  detail?: string
}

export type CargoPlacement = {
  cargoId: string
  tripId: string
  position: Vec3
  rotationY: 0 | 90
  loadingOrder: number
  assignedDoor: DoorSide
}

export type DeliveryStop = {
  shopId: string
  stopNumber: number
  door: DoorSide
}

export type WarningCode =
  | 'weight-limited'
  | 'volume-limited'
  | 'shop-split'
  | 'imbalance'
  | 'deferred-cargo'
  | 'unplaceable-cargo'
  | 'blocked-cargo'
  /** Items with no forward blocking chain to the front wall — need lashing. */
  | 'unsecured-cargo'
  | 'empty-trip'
  | 'time-limit'

export type OptimizationWarning = {
  code: WarningCode
  message: string
  tripId?: string
}

export type OptimizationMetrics = {
  requestedUnits: number
  loadedUnits: number
  deferredUnits: number
  totalWeightKg: number
  weightUtilization: number
  usedVolumeCm3: number
  volumeUtilization: number
  emptyVolumeCm3: number
  leftRightBalance: number
  frontRearBalance: number
  blockedCargoCount: number
  extraUnloadingMoves: number
  splitShopIds: string[]
  constraintViolations: number
  overallScore: number
}

export type DeliveryTrip = {
  id: string
  tripNumber: number
  stops: DeliveryStop[]
  placements: CargoPlacement[]
  deferredCargo: UnplacedCargo[]
  metrics: OptimizationMetrics
}

export type OptimizationResult = {
  seed: string
  vehicleId: VehicleId
  trips: DeliveryTrip[]
  unplaceableCargo: UnplacedCargo[]
  warnings: OptimizationWarning[]
  overallScore: number
  elapsedMs: number
}

export type PlacementWeights = {
  compactness: number
  floorPreference: number
  weightBalance: number
  doorAccessibility: number
  deliveryOrderCompatibility: number
  supportQuality: number
}

export type OptimizerConfig = {
  weights: PlacementWeights
  maxTrips: number
  supportThreshold: number
  candidatePointCap: number
  safetyTimeLimitMs: number
}
