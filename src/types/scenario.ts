import type { Shop } from './shop'
import type { SideDoorChoice, VehicleDefinition, VehicleId } from './vehicle'

export type ScenarioConfig = {
  seed: string
  vehicleId: VehicleId
  sideDoor: SideDoorChoice
  shopCount: number
}

/**
 * A fully-resolved scenario. `vehicle` carries the **resolved** definition —
 * doors already filtered to the rear door plus the chosen side door (or none) —
 * so downstream code never re-derives door setup.
 */
export type Scenario = {
  config: ScenarioConfig
  vehicle: VehicleDefinition
  shops: Shop[]
}
