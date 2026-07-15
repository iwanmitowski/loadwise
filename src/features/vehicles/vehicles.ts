import type {
  AxleModel,
  SideDoorChoice,
  VehicleDefinition,
  VehicleDoor,
  VehicleId,
} from '@/types'

/**
 * Door geometry (see `VehicleDoor` docs for the axis conventions):
 *  - rear door: on the z=0 wall, horizontally centred → x = (width - doorWidth)/2, z = 0.
 *  - side doors: on the x=0 (left) / x=width (right) wall, `width` running along
 *    Z, positioned by its min-corner z. Both left and right are defined here;
 *    `buildScenarioVehicle` picks one or none.
 * All doors sit on the floor (y = 0).
 */
type VehicleSpec = {
  id: VehicleId
  name: string
  cargoSpace: VehicleDefinition['cargoSpace']
  maxPayloadKg: number
  rearDoor: { width: number; height: number }
  sideDoor: { width: number; height: number; z: number }
  axles: AxleModel
}

// Axle geometry: invented-but-plausible PLANNING ESTIMATES for this fictional
// fleet (docs/deep-research-cargo-loading.md — never present these as legal
// checks). Z values are on the cargo-space axis: z=0 rear door, +z toward cab.
const SPECS: Record<VehicleId, VehicleSpec> = {
  'cargo-van': {
    id: 'cargo-van',
    name: 'Cargo van',
    cargoSpace: { width: 180, height: 180, depth: 320 },
    maxPayloadKg: 1200,
    rearDoor: { width: 150, height: 170 },
    sideDoor: { width: 110, height: 150, z: 110 },
    // ~3.5t GVW van: wheelbase 370cm, rear axle 90cm in from the rear doors,
    // front axle under the cab (beyond the 320cm bay). Tare 2,200kg.
    axles: {
      kind: 'rigid',
      frontAxleZ: 460,
      rearAxleZ: 90,
      emptyFrontKg: 1250,
      emptyRearKg: 950,
      maxFrontKg: 1850,
      maxRearKg: 2250,
      minSteerShare: 0.2,
    },
  },
  'box-truck': {
    id: 'box-truck',
    name: 'Box truck',
    cargoSpace: { width: 240, height: 230, depth: 620 },
    maxPayloadKg: 5000,
    rearDoor: { width: 220, height: 210 },
    sideDoor: { width: 200, height: 200, z: 210 },
    // ~10.5t GVW rigid: wheelbase 480cm, rear axle 150cm in from the rear
    // doors, front axle at the bay's cabin end. Tare 5,200kg.
    axles: {
      kind: 'rigid',
      frontAxleZ: 630,
      rearAxleZ: 150,
      emptyFrontKg: 2800,
      emptyRearKg: 2400,
      maxFrontKg: 4300,
      maxRearKg: 6500,
      minSteerShare: 0.2,
    },
  },
  'semi-trailer': {
    id: 'semi-trailer',
    name: 'Semi-trailer',
    cargoSpace: { width: 248, height: 265, depth: 1360 },
    maxPayloadKg: 24000,
    rearDoor: { width: 240, height: 250 },
    sideDoor: { width: 240, height: 250, z: 560 },
    // Trailer-only stage-1 model (kingpin + tri-axle group; tractor-side
    // redistribution is out of MVP scope). Kingpin 160cm behind the headboard,
    // axle-group centre 250cm from the rear doors, Lk = 950cm. Tare 7,500kg;
    // rated 12t kingpin / 27t axle group (Krone Cool Liner-like figures).
    axles: {
      kind: 'semi',
      kingpinZ: 1200,
      axleGroupZ: 250,
      emptyKingpinKg: 3000,
      emptyAxleGroupKg: 4500,
      maxKingpinKg: 12000,
      maxAxleGroupKg: 27000,
      minKingpinShare: 0.15,
    },
  },
}

function rearDoor(spec: VehicleSpec): VehicleDoor {
  const { width, height } = spec.rearDoor
  return {
    id: `${spec.id}-rear`,
    side: 'rear',
    width,
    height,
    position: { x: (spec.cargoSpace.width - width) / 2, y: 0, z: 0 },
  }
}

function makeSideDoor(spec: VehicleSpec, side: 'left' | 'right'): VehicleDoor {
  const { width, height, z } = spec.sideDoor
  return {
    id: `${spec.id}-${side}`,
    side,
    width,
    height,
    position: { x: side === 'left' ? 0 : spec.cargoSpace.width, y: 0, z },
  }
}

/** Full vehicle definition with all candidate doors (rear + both side doors). */
export function getVehicle(id: VehicleId): VehicleDefinition {
  const spec = SPECS[id]
  return {
    id: spec.id,
    name: spec.name,
    cargoSpace: spec.cargoSpace,
    maxPayloadKg: spec.maxPayloadKg,
    doors: [rearDoor(spec), makeSideDoor(spec, 'left'), makeSideDoor(spec, 'right')],
    axles: spec.axles,
  }
}

/**
 * Resolved vehicle for a scenario: the rear door always, plus the chosen side
 * door (or none). This is what a `Scenario` carries so downstream code never
 * re-derives door setup.
 */
export function buildScenarioVehicle(
  id: VehicleId,
  sideDoor: SideDoorChoice,
): VehicleDefinition {
  const spec = SPECS[id]
  const doors: VehicleDoor[] = [rearDoor(spec)]
  if (sideDoor !== 'none') doors.push(makeSideDoor(spec, sideDoor))
  return {
    id: spec.id,
    name: spec.name,
    cargoSpace: spec.cargoSpace,
    maxPayloadKg: spec.maxPayloadKg,
    doors,
    axles: spec.axles,
  }
}

export const VEHICLE_IDS: VehicleId[] = ['cargo-van', 'box-truck', 'semi-trailer']
