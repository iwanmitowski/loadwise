# T02 — Domain types, vehicle & cargo catalog, optimizer config

Track A · Depends: none (repo may still be pre-T01; coordinate merge) · Branch: `feat/T02-domain-types`

## Context

Read `CLAUDE.md` (conventions) and `idea.md` §Vehicle Scope, §Cargo Scope, §Placement Scoring. This task creates **the contract all three tracks code against**. It must be reviewed by all three developers before merge. Precision matters more than speed here.

## Objective

Complete `src/types/` module + static data (vehicles, cargo templates, scoring config) + tiny helpers. Pure TypeScript, zero runtime dependencies, no React/Three imports.

## Decisions already made

- Integer **centimetres** and **kg** everywhere. Positions are min-corners. Axes per CLAUDE.md (origin rear-left-bottom, +Z toward cabin).
- For **side doors** (on the x=0 or x=width wall), `door.width` runs along the **Z axis**; for the rear door (z=0 wall) it runs along X. `door.position` is the min-corner of the door opening on its wall plane. Document this in a comment on `VehicleDoor`.
- `Scenario` carries the **resolved** `VehicleDefinition` (doors already filtered to rear + chosen side door), so downstream code never re-derives door setup.
- Deterministic IDs: `shop-1`, `shop-1-c3`, `trip-2`.

## Types (create exactly these, split across files as indicated)

```ts
// src/types/geometry.ts
export type Dimensions = { width: number; height: number; depth: number }; // integer cm
export type Vec3 = { x: number; y: number; z: number };                    // integer cm, min-corner

// src/types/vehicle.ts
export type VehicleId = 'cargo-van' | 'box-truck' | 'semi-trailer';
export type DoorSide = 'rear' | 'left' | 'right';
export type SideDoorChoice = 'none' | 'left' | 'right';
export type VehicleDoor = { id: string; side: DoorSide; width: number; height: number; position: Vec3 };
export type VehicleDefinition = { id: VehicleId; name: string; cargoSpace: Dimensions; maxPayloadKg: number; doors: VehicleDoor[] };

// src/types/cargo.ts
export type CargoCategory = 'standard-pallet' | 'beverage-pallet' | 'beverage-stack' | 'large-box' | 'medium-box' | 'fragile-box';
export type CargoTemplate = { id: CargoCategory; name: string; category: CargoCategory; dimensions: Dimensions; weightKg: number; stackable: boolean; maxSupportedWeightKg: number; floorOnly: boolean; mustStayUpright: boolean };
export type CargoItem = { id: string; templateId: CargoCategory; shopId: string };

// src/types/shop.ts
export type ShopType = 'supermarket' | 'beverage-store' | 'electronics-store' | 'general-store' | 'warehouse';
export type Shop = { id: string; name: string; type: ShopType; deliveryOrder: number; preferredDoor: DoorSide; requestedCargo: CargoItem[] };

// src/types/scenario.ts
export type ScenarioConfig = { seed: string; vehicleId: VehicleId; sideDoor: SideDoorChoice; shopCount: number };
export type Scenario = { config: ScenarioConfig; vehicle: VehicleDefinition; shops: Shop[] };

// src/types/optimization.ts
export type UnplacedReason = 'exceeds-vehicle-dimensions' | 'exceeds-payload' | 'no-valid-placement' | 'stacking-constraint' | 'accessibility-constraint' | 'trip-limit-reached';
export type UnplacedCargo = { cargoId: string; shopId: string; reason: UnplacedReason; permanent: boolean; detail?: string };
export type CargoPlacement = { cargoId: string; tripId: string; position: Vec3; rotationY: 0 | 90; loadingOrder: number; assignedDoor: DoorSide };
export type DeliveryStop = { shopId: string; stopNumber: number; door: DoorSide };
export type WarningCode = 'weight-limited' | 'volume-limited' | 'shop-split' | 'imbalance' | 'deferred-cargo' | 'unplaceable-cargo' | 'blocked-cargo' | 'empty-trip' | 'time-limit';
export type OptimizationWarning = { code: WarningCode; message: string; tripId?: string };
export type OptimizationMetrics = { requestedUnits: number; loadedUnits: number; deferredUnits: number; totalWeightKg: number; weightUtilization: number; usedVolumeCm3: number; volumeUtilization: number; emptyVolumeCm3: number; leftRightBalance: number; frontRearBalance: number; blockedCargoCount: number; extraUnloadingMoves: number; splitShopIds: string[]; constraintViolations: number; overallScore: number };
export type DeliveryTrip = { id: string; tripNumber: number; stops: DeliveryStop[]; placements: CargoPlacement[]; deferredCargo: UnplacedCargo[]; metrics: OptimizationMetrics };
export type OptimizationResult = { seed: string; vehicleId: VehicleId; trips: DeliveryTrip[]; unplaceableCargo: UnplacedCargo[]; warnings: OptimizationWarning[]; overallScore: number; elapsedMs: number };
export type PlacementWeights = { compactness: number; floorPreference: number; weightBalance: number; doorAccessibility: number; deliveryOrderCompatibility: number; supportQuality: number };
export type OptimizerConfig = { weights: PlacementWeights; maxTrips: number; supportThreshold: number; candidatePointCap: number; safetyTimeLimitMs: number };

// src/types/worker.ts
export type OptimizeRequest = { type: 'optimize'; requestId: string; scenario: Scenario; config: OptimizerConfig };
export type OptimizerProgress = { type: 'progress'; requestId: string; percent: number; stage: string };
export type OptimizerDone = { type: 'done'; requestId: string; result: OptimizationResult };
export type OptimizerError = { type: 'error'; requestId: string; message: string };
export type OptimizerResponse = OptimizerProgress | OptimizerDone | OptimizerError;
```

Re-export everything from `src/types/index.ts`.

## Static data

`src/features/vehicles/vehicles.ts` — the three vehicles (door positions: rear door horizontally centered on the z=0 wall; side doors listed for both `left` and `right` — scenario building picks one or none):

| id | cargoSpace w×h×d | payload | rear door w×h | side door w×h, z-position |
|---|---|---|---|---|
| cargo-van | 180×180×320 | 1,200 | 150×170 | 110×150 at z=110 |
| box-truck | 240×230×620 | 5,000 | 220×210 | 200×200 at z=210 |
| semi-trailer | 248×265×1360 | 24,000 | 240×250 | 240×250 at z=560 |

Export `getVehicle(id)`, and `buildScenarioVehicle(id, sideDoor: SideDoorChoice): VehicleDefinition` (rear door always; plus the chosen side door or none).

`src/features/cargo/templates.ts` — the six templates:

| id | name | w×h×d | kg | stackable | maxSupported | floorOnly |
|---|---|---|---|---|---|---|
| standard-pallet | Standard pallet | 120×150×80 | 350 | true | 400 | false |
| beverage-pallet | Beverage pallet | 120×160×80 | 600 | false | 0 | **true** |
| beverage-stack | Crate stack | 40×105×30 | 45 | false | 0 | false |
| large-box | Large box | 80×60×60 | 40 | true | 80 | false |
| medium-box | Medium box | 60×40×40 | 20 | true | 40 | false |
| fragile-box | Fragile box | 50×40×40 | 12 | **false** | 0 | false |

All `mustStayUpright: true`. Export `getTemplate(id)` and helpers `itemDimensions(template, rotationY)` (90° swaps width/depth) and `itemVolume(template)`.

`src/features/optimizer/config.ts` — `DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig` with weights `{ compactness: 20, floorPreference: 15, weightBalance: 10, doorAccessibility: 20, deliveryOrderCompatibility: 25, supportQuality: 10 }`, `maxTrips: 10`, `supportThreshold: 0.7`, `candidatePointCap: 600`, `safetyTimeLimitMs: 8000`. Also `SCORE_WEIGHTS` for the report's overall score: `{ volume: 25, weight: 15, balance: 20, accessibility: 25, delivery: 15 }`. One file, tunable numbers only — no logic.

## Out of scope

No generation, validation, or placement logic. No React. If T01 isn't merged yet, write files standalone (they have no dependencies) and rebase after.

## Acceptance criteria

- [ ] `npm run typecheck` green; no runtime deps introduced
- [ ] All types compile and match `idea.md` shapes (extended fields are documented additions)
- [ ] Data tables above encoded exactly; helpers unit-tested (a few Vitest cases: rotation swap, buildScenarioVehicle door filtering)
- [ ] PR reviewed by both other developers before merge

## Wrap up

Update `docs/TASKS.md`, worklog entry, commits `T02:`. After merge, announce "types are locked" to the team.
