// Initial camera framing for a vehicle, derived entirely from its cargo-space
// dimensions so all three vehicles frame correctly with nothing hard-coded.
//
// The rear door plane is z=0; the camera sits at NEGATIVE z (behind the rear
// opening), elevated and off to one side — a three-quarter view looking into
// the cargo space through the rear door.

import type { VehicleDefinition } from '@/types'
import { sizeToScene } from '../units'

export type CameraPose = {
  position: [number, number, number]
  target: [number, number, number]
}

export function initialCameraPose(vehicle: VehicleDefinition): CameraPose {
  const [w, h, d] = sizeToScene(vehicle.cargoSpace)
  // Look at a point a little inside the space and below mid-height, so the load
  // floor is the focus rather than empty headroom.
  const target: [number, number, number] = [w / 2, h * 0.4, d * 0.45]
  // Frame distance scales with the largest horizontal extent.
  const reach = Math.max(w, d)
  const position: [number, number, number] = [
    w / 2 + w * 0.85, // off-axis to the right
    h * 1.35, // elevated
    -reach * 0.55, // behind the rear opening (negative z)
  ]
  return { position, target }
}

/** Orbit-control limits derived from the vehicle so you can't clip the floor. */
export function orbitLimits(vehicle: VehicleDefinition): {
  minDistance: number
  maxDistance: number
  maxPolarAngle: number
} {
  const [w, h, d] = sizeToScene(vehicle.cargoSpace)
  const maxDim = Math.max(w, h, d)
  return {
    minDistance: h * 0.4,
    maxDistance: maxDim * 3,
    // Just under horizontal (π/2) so the camera never dips below the floor.
    maxPolarAngle: Math.PI * 0.49,
  }
}
