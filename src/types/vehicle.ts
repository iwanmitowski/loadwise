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

/**
 * Simplified axle geometry for planning-estimate load calculations
 * (docs/deep-research-cargo-loading.md §Weight distribution). Axle positions are
 * given on the cargo-space Z axis (cm; z=0 = rear door plane, +z toward cabin) —
 * they may lie outside [0, depth] (e.g. a front axle under the cab). All numbers
 * are invented-but-plausible PLANNING ESTIMATES, not manufacturer data; results
 * derived from them must be labelled as estimates, never legal checks.
 */
export type RigidAxleModel = {
  kind: 'rigid'
  /** Z of the front (steering) axle in cargo-space cm (usually > depth). */
  frontAxleZ: number
  /** Z of the rear axle (or axle-group centre) in cargo-space cm. */
  rearAxleZ: number
  /** Axle loads of the EMPTY vehicle, kg. */
  emptyFrontKg: number
  emptyRearKg: number
  /** Plated per-axle maxima, kg. */
  maxFrontKg: number
  maxRearKg: number
  /**
   * Minimum share of TOTAL vehicle weight the steering axle must carry for
   * safe handling (planning estimate; ~0.2 is a common rule of thumb).
   */
  minSteerShare: number
}

export type SemiAxleModel = {
  kind: 'semi'
  /** Z of the kingpin in cargo-space cm (toward the cabin end). */
  kingpinZ: number
  /** Z of the trailer axle-group centre in cargo-space cm (toward the rear). */
  axleGroupZ: number
  /** Support loads of the EMPTY trailer, kg. */
  emptyKingpinKg: number
  emptyAxleGroupKg: number
  /** Rated maxima, kg. */
  maxKingpinKg: number
  maxAxleGroupKg: number
  /**
   * Minimum share of total trailer weight the kingpin must carry — too little
   * fifth-wheel pressure reduces tractor drive-axle grip (planning estimate).
   */
  minKingpinShare: number
}

export type AxleModel = RigidAxleModel | SemiAxleModel

export type VehicleDefinition = {
  id: VehicleId
  name: string
  cargoSpace: Dimensions
  maxPayloadKg: number
  doors: VehicleDoor[]
  /**
   * Optional axle geometry (planning estimate). When present the optimizer
   * hard-rejects placements that overload an axle and the report warns on
   * steer/kingpin underload — including states reached after each delivery
   * stop. Absent ⇒ axle checks are skipped entirely.
   */
  axles?: AxleModel
}
