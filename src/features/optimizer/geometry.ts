// Pure geometry primitives for the optimizer. Integer cm in, integer cm² out —
// exact comparisons, no epsilon (see CLAUDE.md §Domain conventions). No React /
// Three imports: this runs in the heuristic hot loop and inside the Web Worker.

import { itemDimensions } from '@/features/cargo/templates'
import type {
  CargoCategory,
  CargoPlacement,
  CargoTemplate,
  Dimensions,
  Vec3,
  VehicleDoor,
} from '@/types'

/** A cargo item resolved to its axis-aligned box in cargo-space coordinates. */
export type PlacedBox = {
  cargoId: string
  templateId: CargoCategory
  /** Minimum corner (rear-left-bottom) in integer cm. */
  min: Vec3
  /** Footprint/height at the placement's rotation (90° swaps width/depth). */
  size: Dimensions
  weightKg: number
}

/** Resolve a placement + its template into a PlacedBox, applying rotationY. */
export function toPlacedBox(
  placement: CargoPlacement,
  template: CargoTemplate,
): PlacedBox {
  return {
    cargoId: placement.cargoId,
    templateId: template.id,
    min: placement.position,
    size: itemDimensions(template, placement.rotationY),
    weightKg: template.weightKg,
  }
}

/** The Y coordinate of a box's top face. */
export function boxTop(box: PlacedBox): number {
  return box.min.y + box.size.height
}

/** XZ-plane footprint area of a box in cm². */
export function baseArea(box: PlacedBox): number {
  return box.size.width * box.size.depth
}

/** Strict overlap of two half-open intervals [aMin, aMin+aLen) and [bMin, bMin+bLen). */
function intervalsOverlap(
  aMin: number,
  aLen: number,
  bMin: number,
  bLen: number,
): boolean {
  return aMin < bMin + bLen && bMin < aMin + aLen
}

/** Length of overlap of two intervals (0 when they only touch or are disjoint). */
function overlapLength(
  aMin: number,
  aLen: number,
  bMin: number,
  bLen: number,
): number {
  return Math.max(0, Math.min(aMin + aLen, bMin + bLen) - Math.max(aMin, bMin))
}

/**
 * Strict interior overlap in all three axes. Touching faces (a shared edge or
 * coordinate) is NOT an overlap — boxes packed flush against each other are legal.
 */
export function boxesOverlap(a: PlacedBox, b: PlacedBox): boolean {
  return (
    intervalsOverlap(a.min.x, a.size.width, b.min.x, b.size.width) &&
    intervalsOverlap(a.min.y, a.size.height, b.min.y, b.size.height) &&
    intervalsOverlap(a.min.z, a.size.depth, b.min.z, b.size.depth)
  )
}

/** True when the box lies entirely within the [0,space] cargo volume. */
export function insideVehicle(box: PlacedBox, space: Dimensions): boolean {
  return (
    box.min.x >= 0 &&
    box.min.y >= 0 &&
    box.min.z >= 0 &&
    box.min.x + box.size.width <= space.width &&
    box.min.y + box.size.height <= space.height &&
    box.min.z + box.size.depth <= space.depth
  )
}

/** XZ-plane (footprint) intersection area of two boxes in cm². */
export function footprintOverlapArea(a: PlacedBox, b: PlacedBox): number {
  const x = overlapLength(a.min.x, a.size.width, b.min.x, b.size.width)
  const z = overlapLength(a.min.z, a.size.depth, b.min.z, b.size.depth)
  return x * z
}

/**
 * Whether an item of the given size can pass through a door in this orientation.
 * The cross-section perpendicular to travel must fit the opening:
 *  - rear door (travel along Z): width ≤ door.width && height ≤ door.height
 *  - side door (travel along X): depth ≤ door.width && height ≤ door.height
 * Zero clearance margin (documented simplification); the caller tries both rotations.
 */
export function fitsThroughDoor(size: Dimensions, door: VehicleDoor): boolean {
  const crossSection = door.side === 'rear' ? size.width : size.depth
  return crossSection <= door.width && size.height <= door.height
}
