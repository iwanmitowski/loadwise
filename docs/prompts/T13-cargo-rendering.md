# T13 — Cargo rendering & interaction

Track B · Depends: T03 (fixtures), T12 · Branch: `feat/T13-cargo-rendering`

## Context

Read `idea.md` §3D Visualization Requirements. Renders a trip's placements inside the vehicle shell, with shop colors, labels, selection, filtering, and the center-of-mass marker. Drive it from `demoResult` fixture until real results flow (the components only ever see `DeliveryTrip` + `Scenario` — source-agnostic).

## Deliverables

```tsx
// src/three/CargoLayer/CargoLayer.tsx
export function CargoLayer({ trip, scenario }: { trip: DeliveryTrip; scenario: Scenario }): JSX.Element;
// src/three/CargoLayer/CargoBox.tsx — one placement
```

- **CargoBox**: `boxGeometry` sized from template dims (apply rotationY 90 = w/d swap BEFORE centering — reuse `toPlacedBox` from T05 if merged, else local helper), positioned with `boxCenter` (T12). Material: shop color (`shopColor` util from T09), slight roughness; `<Edges>` outline in a darker shade for definition. Fragile boxes get a visual tell (thin white top edge or ⚠ decal via drei `<Text>` — cheap option).
- **Labels**: drei `<Text>` on the front (−Z) face: short template name (e.g. "Pallet", "Crate"). Visible only when camera is near enough (fade by distance) to avoid clutter at 100 items. Global label toggle button in scene chrome.
- **Selection**: click → `uiStore.selectedCargoId` (click empty space clears). Selected box: emissive highlight + slightly stronger edge. **Metadata panel** (React overlay, `src/components/simulation/CargoInfoPanel.tsx`): template name, dims (m), weight, shop name + color dot, loading order, assigned door, stop number. Hover: pointer cursor only (no hover highlight — perf).
- **Shop filter**: `uiStore.shopFilter` — non-matching cargo drops to `opacity 0.12`, non-interactive. Filter UI = clickable shop legend chips (legend component itself is T16's; expose the behavior through the store so it composes).
- **Center of mass**: small red sphere + vertical line to floor at the weight-weighted centroid of placed items (compute in a memo from placements — fine to do in render layer, it's presentation). Toggle in scene chrome. Weightless/empty trip → hide marker.
- **Trip switching**: `uiStore.selectedTripId` picks which trip's placements render; must remount cleanly (key by tripId).
- Perf: ≤ 100 meshes is fine unbatched; memoize materials per shop (`useMemo` map color→material) so you don't create 100 materials.

## Out of scope

Loading animation (T14), delivery/unload simulation (T15), report screen (T16).

## Acceptance criteria

- [ ] Demo fixture renders: 9 boxes, 3 shop colors, stack sits flush on its supporter, everything inside the shell
- [ ] Click-select + info panel + clear; filter dims correctly; CoM marker plausible (near floor center for the fixture)
- [ ] Rotated (90°) item renders with swapped footprint — add one rotated placement to a local story/test fixture to prove it
- [ ] 100-item synthetic trip (generate programmatically in a dev-only story) holds 60fps-ish
- [ ] typecheck/lint/test green

## Wrap up

TASKS.md, worklog, commits `T13:`.
