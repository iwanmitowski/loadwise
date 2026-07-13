import type { Dimensions, Vec3 } from './geometry'

export type VehicleId = 'cargo-van' | 'box-truck' | 'semi-trailer'
export type DoorSide = 'rear' | 'left' | 'right'

/** Which side door (if any) a scenario resolves onto the vehicle. */
export type SideDoorChoice = 'none' | 'left' | 'right'

/**
 * A loading door opening on one wall of the cargo space.
 *
 * `width` is measured along the wall's in-plane horizontal axis:
 *  - rear door (z=0 wall): `width` runs along the **X axis**.
 *  - side doors (x=0 or x=width wall): `width` runs along the **Z axis**.
 * `height` always runs along the Y axis.
 * `position` is the **min-corner of the door opening** on its wall plane
 * (the wall-normal coordinate is pinned to that wall: z=0 for rear, x=0 for
 * left, x=cargoSpace.width for right).
 */
export type VehicleDoor = {
  id: string
  side: DoorSide
  width: number
  height: number
  position: Vec3
}

export type VehicleDefinition = {
  id: VehicleId
  name: string
  cargoSpace: Dimensions
  maxPayloadKg: number
  doors: VehicleDoor[]
}
