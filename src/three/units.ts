// The ONLY place domain centimetres become Three.js scene metres.
// Scene axes match the domain exactly (see CLAUDE.md §Domain conventions):
// +X left→right, +Y floor→roof, +Z rear door→cabin. Origin (0,0,0) is the
// rear-left-bottom inside corner of the cargo space, i.e. on the rear-door plane.
//
// Domain code stores a cuboid by its MINIMUM corner. A Three.js mesh is centred
// on its origin, so rendering a cuboid means placing the mesh at the box centre.
// No component outside this module may write an inline `* 0.01`.

import type { Dimensions, Vec3 } from '@/types'

/** 1 domain cm expressed in scene units (metres). */
export const CM = 0.01

/** Scale a scalar length in cm to scene metres. */
export function m(cm: number): number {
  return cm * CM
}

/** Scale a domain point (min-corner, cm) to a scene position tuple (metres). */
export function toScene(p: Vec3): [number, number, number] {
  return [p.x * CM, p.y * CM, p.z * CM]
}

/** Scale a domain size (cm) to a scene size tuple (metres). */
export function sizeToScene(s: Dimensions): [number, number, number] {
  return [s.width * CM, s.height * CM, s.depth * CM]
}

/**
 * Scene-space centre of a cuboid given its domain min-corner and size (cm).
 * This is where its centred Three.js mesh must sit.
 */
export function boxCenter(min: Vec3, size: Dimensions): [number, number, number] {
  return [
    (min.x + size.width / 2) * CM,
    (min.y + size.height / 2) * CM,
    (min.z + size.depth / 2) * CM,
  ]
}
