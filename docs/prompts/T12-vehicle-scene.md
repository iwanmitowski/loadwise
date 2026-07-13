# T12 — Vehicle 3D scene

Track B · Depends: T01, T02 · Branch: `feat/T12-vehicle-scene`

## Context

Read `CLAUDE.md` §Domain conventions (coordinate mapping!) and `idea.md` §3D Visualization Requirements. Foundation of everything visual: the vehicle interior, doors, camera. Procedural geometry only — no external models. Lives in `src/three/`.

## Coordinate mapping (decision already made — get this right first)

Domain: integer cm, min-corner, origin rear-left-bottom, +Y up, +Z rear→cabin. Three.js scene uses the SAME axes, scaled to metres:

```ts
// src/three/units.ts
export const CM = 0.01; // 1 domain cm = 0.01 scene units (metres)
export function boxCenter(min: Vec3, size: Dimensions): [number, number, number] {
  return [(min.x + size.width / 2) * CM, (min.y + size.height / 2) * CM, (min.z + size.depth / 2) * CM];
}
```

Rear door plane is z=0; initial camera sits at negative Z looking into the cargo space through the rear opening, slightly elevated and off-axis (three-quarter view). Every other component uses `units.ts` — no inline `* 0.01` anywhere.

## Deliverables

```tsx
// src/three/VehicleScene/VehicleScene.tsx
export function VehicleScene({ vehicle, children }: { vehicle: VehicleDefinition; children?: ReactNode }): JSX.Element;
// Canvas + lights + controls + <VehicleShell/>; children = cargo layer (T13 renders into this slot)
```

- **Shell**: floor (solid, subtle grid texture via drei `<Grid>` beneath), 4 walls + roof as transparent panels (`transparent, opacity ~0.15, side: DoubleSide, depthWrite: false`), thin frame edges (drei `<Edges>` or line segments) so the volume reads even with walls hidden. Walls/roof visibility from `uiStore` (`wallsVisible`, `roofVisible`).
- **Doors**: for each `vehicle.doors` entry render a door panel in the opening (dimensions/position from the door data; remember side-door width runs along Z per T02). `doorsOpen` in uiStore swings them open (rear: two half-panels rotating outward or one panel rotating up; side: slide along wall — pick simplest that reads clearly). Animate with a spring or lerp in `useFrame` — smooth, ~0.5s. Door slightly tinted so it's visible against the opening.
- **Ground context**: large neutral ground plane + soft shadows (drei `<ContactShadows>` or a blob) so the vehicle doesn't float. Simple cab silhouette (2–3 gray boxes) at the +Z end so orientation is obvious — 10-minute job, not a model.
- **Camera**: drei `<OrbitControls>` (orbit + zoom per idea.md), sensible min/max distance & polar angle (don't go under the floor). `resetView()` in uiStore triggers camera reset to the initial pose — expose via a small controller hook `useCameraReset(controlsRef)`.
- **Lighting**: ambient + one directional with shadows; keep it cheap.
- Scene mounts on the Simulation screen slot (T09's placeholder) showing the scenario's vehicle — with fixture placements once T13 lands. Until then an empty shell is fine.
- All three vehicles must look right — test by switching vehicle in setup (proportions come entirely from `vehicle.cargoSpace`, nothing hard-coded).

## Out of scope

Cargo meshes/labels/selection (T13), animations beyond doors (T14/T15), report UI.

## Acceptance criteria

- [ ] All three vehicles render with correct proportions, doors in the right walls (verify side-door left vs right against a top-view sketch)
- [ ] Wall/roof toggles + door open/close + camera orbit/zoom/reset all work from UI controls (add the toggle buttons to the simulation screen chrome now — simple icon buttons wired to uiStore)
- [ ] 60fps on an integrated-GPU laptop with the empty shell
- [ ] typecheck/lint/test green (logic-light; a unit test for `boxCenter` suffices)

## Wrap up

TASKS.md, worklog, commits `T12:`.
