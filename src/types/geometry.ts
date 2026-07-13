// Core geometric primitives for the domain layer.
// All lengths are integer centimetres (see CLAUDE.md — no floating-point dimensions).

/** Box dimensions in integer cm. */
export type Dimensions = { width: number; height: number; depth: number }

/**
 * A point in cargo-space coordinates, integer cm.
 * Origin = rear-left-bottom corner inside the cargo space.
 * +X left→right (viewed from rear door toward cabin), +Y floor→roof, +Z rear door→cabin.
 * A cuboid's position is always its **minimum corner**.
 */
export type Vec3 = { x: number; y: number; z: number }
