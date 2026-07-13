# Master Prompt — 3D Truck Load Optimizer
 
We are building a hackathon MVP called **LoadWise**, a web application that automatically plans how cargo should be loaded into a delivery vehicle and visualizes the result in interactive 3D.
 
The user selects a vehicle, generates several shops with random orders, and starts the optimization. The system calculates cargo positions, creates additional round trips when necessary, and produces a deterministic optimization report.
 
This is **not a manual loading game** and does not require an LLM API. The core intelligence should come from mathematical optimization, heuristics, and constraint validation.
 
## Project constraints
 
* 48-hour hackathon
* Team of 3 developers
* Must be deployable to a public URL
* Prioritize a working, polished MVP over advanced optimization
* Avoid unnecessary backend or infrastructure complexity
* Keep the architecture extensible, but do not over-engineer it
* Ask clarifying questions before implementation
* Propose an implementation plan before editing files
 
---
 
# Core User Flow
 
1. User selects a vehicle.
2. User selects the optional side-door position:
 
   * none
   * left
   * right
3. User generates a random delivery scenario.
4. The system generates several shops and their cargo requests.
5. The system calculates how many delivery trips are required.
6. Cargo is automatically placed inside the vehicle.
7. The user views each trip in an interactive 3D scene.
8. The user can replay the loading process.
9. The user can simulate unloading shop by shop.
10. The system displays a deterministic optimization report.
 
---
 
# Vehicle Scope
 
Support exactly three vehicle types in the MVP.
 
## Cargo Van
 
* Small cargo area
* Rear door
* Optional left or right side door
* Low maximum payload
 
## Box Truck
 
* Medium rectangular cargo area
* Rear door
* Optional left or right side door
* Medium maximum payload
 
## Semi-Trailer
 
* Large rectangular cargo area
* Rear door
* Optional left or right side door
* High maximum payload
 
Each vehicle must define:
 
```ts
type VehicleDefinition = {
  id: string;
  name: string;
  cargoSpace: {
    width: number;
    height: number;
    depth: number;
  };
  maxPayloadKg: number;
  doors: VehicleDoor[];
};
```
 
```ts
type VehicleDoor = {
  id: string;
  side: "rear" | "left" | "right";
  width: number;
  height: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
};
```
 
Use simple rectangular vehicle interiors. Do not create realistic suspension, engines, axles, or detailed truck physics for the MVP.
 
---
 
# Cargo Scope
 
Every cargo item must be represented as a rectangular cuboid.
 
Supported cargo templates:
 
* Standard pallet
* Beverage pallet
* Beverage crate stack
* Large box
* Medium box
* Fragile box
 
Each cargo template contains:
 
```ts
type CargoTemplate = {
  id: string;
  name: string;
  category:
    | "standard-pallet"
    | "beverage-pallet"
    | "beverage-stack"
    | "large-box"
    | "medium-box"
    | "fragile-box";
 
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
 
  weightKg: number;
  stackable: boolean;
  maxSupportedWeightKg: number;
  floorOnly: boolean;
  mustStayUpright: boolean;
};
```
 
Cargo rules:
 
* Cargo must remain upright.
* Only 0° and 90° horizontal rotation is allowed.
* Beverage pallets must remain on the floor.
* Fragile boxes cannot support other cargo.
* Non-stackable cargo cannot have cargo above it.
* Supported weight limits must be respected.
 
---
 
# Shop and Order Generation
 
Generate between 3 and 8 shops.
 
Supported shop types:
 
* Supermarket
* Beverage store
* Electronics store
* General store
* Warehouse
 
Each shop contains:
 
```ts
type Shop = {
  id: string;
  name: string;
  type: ShopType;
  deliveryOrder: number;
  preferredDoor: "rear" | "left" | "right";
  requestedCargo: CargoItem[];
};
```
 
Generate shop cargo using weighted probabilities.
 
Examples:
 
* Beverage stores should request mostly beverage pallets and crate stacks.
* Electronics stores should request more large and fragile boxes.
* Supermarkets should request mixed pallets, boxes, and beverages.
* Warehouses may request larger quantities.
 
Each generated scenario should have a seed so that it can be reproduced.
 
---
 
# Functional Requirements
 
## Scenario generation
 
The application must:
 
* Generate random shops.
* Generate random shop names.
* Generate random shop types.
* Generate random delivery order.
* Generate random cargo quantities.
* Generate cargo according to shop type.
* Allow regenerating the complete scenario.
* Display the generated seed.
* Allow replaying the same seed.
 
## Automatic trip planning
 
The application must:
 
* Try to load all requested cargo.
* Create additional trips when one trip is insufficient.
* Keep cargo for the same shop together when possible.
* Split a shop order only when necessary.
* Move cargo that does not fit into the next trip.
* Detect cargo that cannot fit in the selected vehicle at all.
* Prevent infinite trip-generation loops.
 
Each trip should contain:
 
```ts
type DeliveryTrip = {
  id: string;
  tripNumber: number;
  stops: DeliveryStop[];
  placements: CargoPlacement[];
  deferredCargo: UnplacedCargo[];
  metrics: OptimizationMetrics;
};
```
 
## Automatic cargo placement
 
The optimizer must produce:
 
```ts
type CargoPlacement = {
  cargoId: string;
  tripId: string;
 
  position: {
    x: number;
    y: number;
    z: number;
  };
 
  rotationY: 0 | 90;
  loadingOrder: number;
  assignedDoor: "rear" | "left" | "right";
};
```
 
The optimizer must validate:
 
* Cargo remains inside vehicle boundaries.
* Cargo items do not overlap.
* Total weight does not exceed vehicle payload.
* Cargo has sufficient support beneath it.
* Stacking rules are respected.
* Cargo orientation is valid.
* Floor-only cargo remains on the floor.
* Cargo is reasonably accessible through its assigned door.
* Earlier deliveries should not be blocked by later deliveries where avoidable.
 
## Door-aware loading
 
The selected doors must influence cargo placement.
 
For rear-door deliveries:
 
* Earlier stops should be closer to the rear door.
* Later stops may be placed deeper inside the vehicle.
 
For side-door deliveries:
 
* Cargo should be positioned close to the selected side.
* A simple clear corridor toward the door should be preferred.
 
Do not implement complex forklift pathfinding. Use a simple accessibility approximation based on distance and blocking cargo.
 
## Multi-trip behavior
 
The system must support these outcomes:
 
* Everything fits in one trip.
* Volume capacity is reached before weight capacity.
* Weight capacity is reached before volume capacity.
* Some items have no valid placement.
* A shop order must be split across trips.
* An item is too large for the selected vehicle.
* A side door improves unloading accessibility.
* Cargo remains unloaded because it is incompatible with all generated trips.
 
---
 
# Optimization Strategy
 
Use a deterministic heuristic suitable for a hackathon.
 
Suggested approach:
 
1. Group cargo by shop.
2. Sort shops by delivery order.
3. Prefer keeping full shop groups together.
4. Sort cargo by:
 
   * floor-only first
   * weight descending
   * volume descending
   * delivery priority
5. Generate allowed orientations.
6. Generate candidate placement positions.
7. Reject invalid placements.
8. Score each valid placement.
9. Select the best placement.
10. Repeat until no more cargo can be loaded.
11. Move remaining cargo into the next trip.
12. Run a simple improvement pass if time permits.
 
Do not attempt to implement a mathematically perfect global solver in the MVP.
 
---
 
# Placement Scoring
 
Use a weighted score that prefers:
 
* High volume utilization
* Good weight utilization
* Left/right balance
* Front/rear balance
* Door accessibility
* Compact placement
* Low placement height
* Keeping shop cargo together
* Fewer blocked items
 
Example structure:
 
```ts
type PlacementScore = {
  compactness: number;
  floorPreference: number;
  weightBalance: number;
  doorAccessibility: number;
  deliveryOrderCompatibility: number;
  supportQuality: number;
};
```
 
Keep weights configurable in one file.
 
---
 
# Optimization Report
 
Generate the report entirely from deterministic calculations.
 
Display per trip:
 
* Vehicle
* Number of shops
* Requested cargo units
* Loaded cargo units
* Deferred cargo units
* Total cargo weight
* Weight utilization
* Used cargo volume
* Volume utilization
* Empty volume
* Left/right balance
* Front/rear balance
* Blocked cargo count
* Estimated extra unloading movements
* Split shop orders
* Constraint violations
* Overall score
 
Example:
 
```text
Optimization Report
 
Vehicle: Box Truck
Trip: 1 of 2
Shops served: 4
 
Loaded cargo: 26 / 31
Volume utilization: 91%
Weight utilization: 83%
Left/right balance: 95%
Front/rear balance: 88%
Blocked cargo: 1
Extra unloading movements: 2
Overall score: 87 / 100
```
 
## Suggested formulas
 
```ts
volumeUtilization =
  loadedCargoVolume / vehicleCargoVolume;
```
 
```ts
weightUtilization =
  loadedCargoWeight / vehicleMaxPayload;
```
 
```ts
leftRightBalance =
  1 - Math.abs(leftWeight - rightWeight) / totalWeight;
```
 
```ts
frontRearBalance =
  1 - Math.abs(frontWeight - rearWeight) / totalWeight;
```
 
```ts
accessibilityScore =
  loadedCargoCount === 0
    ? 0
    : 1 - blockedCargoCount / loadedCargoCount;
```
 
The overall score must be clamped between 0 and 100.
 
Warnings should explain mathematical results, for example:
 
* Weight capacity reached before volume capacity.
* Two beverage pallets were moved to Trip 2.
* One fragile box could not be safely stacked.
* The right side is 12% heavier than the left.
* One shop order was split between two trips.
 
---
 
# 3D Visualization Requirements
 
Use React Three Fiber.
 
Render:
 
* Vehicle cargo area
* Floor
* Transparent walls
* Roof
* Rear door
* Optional side door
* Cargo cuboids
* Cargo labels
* Center-of-mass marker
 
Each shop should receive a unique color.
 
Cargo belonging to the same shop should use the same color.
 
Interactions:
 
* Orbit camera
* Zoom
* Rotate
* Toggle roof
* Toggle walls
* Open and close doors
* Select cargo
* View cargo metadata
* Filter cargo by shop
* Switch between trips
* Reset camera
 
Do not use complex external 3D truck models. Use simple procedural geometry.
 
---
 
# Loading Animation
 
The user must be able to replay loading.
 
The animation should:
 
* Insert cargo in `loadingOrder`.
* Move cargo from outside the vehicle to its final position.
* Allow pause, resume, restart, and speed control.
* Highlight the currently loaded cargo.
* Update progress.
 
---
 
# Delivery Simulation
 
The user must be able to simulate deliveries.
 
For each shop:
 
1. Select the next stop.
2. Open the assigned door.
3. Highlight the shop’s cargo.
4. Detect cargo blocking the unloading path.
5. Temporarily move blocking cargo if necessary.
6. Remove delivered cargo.
7. Continue to the next stop.
 
Display:
 
* Current shop
* Assigned door
* Cargo units being unloaded
* Blocking cargo
* Extra unloading operations
* Remaining stops
 
Use simple animations. Do not implement driving physics or a road map.
 
---
 
# Required Screens
 
## Scenario Setup
 
* Vehicle selection
* Side-door configuration
* Shop count
* Random seed
* Generate scenario button
 
## Planning View
 
* Generated shops
* Delivery order
* Requested cargo
* Optimize button
* Loading state
 
## Main Simulation View
 
* 3D vehicle
* Trip selector
* Shop legend
* Cargo filters
* Loading controls
* Delivery simulation controls
 
## Optimization Report
 
* Metrics
* Warnings
* Deferred cargo
* Unplaceable cargo
* Per-trip results
 
---
 
# Tech Stack
 
Use a frontend-first architecture.
 
## Application
 
* React
* TypeScript
* Vite
* React Three Fiber
* Drei
* Zustand
* Tailwind CSS
 
## Optimization
 
* TypeScript
* Pure functions
* No LLM or paid API dependency
* Run optimization in a Web Worker if it blocks the UI
 
## Testing
 
* Vitest
* React Testing Library
* At least one end-to-end smoke test with Playwright if time permits
 
## Deployment
 
* Vercel, Netlify, or Cloudflare Pages
 
A backend is not required for the MVP.
 
Only add a backend if persistence or server-side computation becomes necessary.
 
---
 
# Architecture
 
Use these independent modules:
 
```text
src/
  components/
  features/
    scenario/
    vehicles/
    cargo/
    optimizer/
    trips/
    simulation/
    reports/
  three/
    VehicleScene/
    CargoMesh/
    Doors/
    Animations/
  workers/
  state/
  types/
  utils/
```
 
Separate:
 
* Domain models
* Scenario generation
* Optimization logic
* Validation
* Metrics
* Three.js rendering
* UI state
* Animation state
 
The optimizer must not depend on React or Three.js.
 
---
 
# Important Edge Cases
 
Handle these cases explicitly:
 
* Empty scenario
* No shops generated
* Shop requests zero cargo
* Cargo larger than the selected vehicle
* Cargo heavier than the vehicle payload
* No valid placement exists
* Optimizer loads zero items in a trip
* More than one trip is required
* Preferred side door is unavailable
* Total cargo weight is zero
* Balance formulas would divide by zero
* Invalid generated dimensions
* Two cargo items receive overlapping positions
* A shop order is split across trips
* All cargo is permanently unplaceable
 
Show clear user-facing messages instead of crashing.
 
---
 
# Acceptance Criteria
 
The MVP is complete when:
 
* The application supports three vehicle types.
* A user can generate 3–8 random shops.
* Each shop receives realistic randomized cargo.
* The optimizer automatically places cargo.
* Invalid placements are rejected.
* Additional trips are created automatically.
* Unplaceable cargo is clearly reported.
* Every trip can be viewed in 3D.
* Cargo is color-coded by shop.
* Loading can be replayed.
* Deliveries can be simulated stop by stop.
* The optimization report is calculated from deterministic metrics.
* The app works without an API key.
* The app is deployed publicly.
 
---
 
# Additional Technical Requirements
 
## Coordinate Convention
 
Use one coordinate convention across the domain and optimization layers:
 
- Origin: rear-left-bottom corner of the cargo space
- X axis: left to right
- Y axis: floor to roof
- Z axis: rear door toward the cabin
 
Cargo positions represent their minimum corner. Three.js mesh-centre conversion must happen only in the rendering layer.
 
## Determinism
 
- Scenario generation must use a seeded random-number generator.
- The same seed and configuration must produce the same shops and cargo.
- The optimizer must produce deterministic results for identical input.
- Do not use Math.random() directly.
- Allow scenarios and optimization results to be exported as JSON.
 
## Performance and Cancellation
 
- Support up to 100 cargo units.
- Generate no more than 10 trips.
- Keep optimization within approximately 3–5 seconds.
- Run optimization in a Web Worker.
- Display progress.
- Allow cancellation.
- Ignore stale worker responses using request IDs.
- Return the best valid result when the time limit is reached.
 
## Unplaced Cargo Reasons
 
Every unplaced item must contain one reason:
 
- exceeds-vehicle-dimensions
- exceeds-payload
- no-valid-placement
- stacking-constraint
- accessibility-constraint
- trip-limit-reached
 
Distinguish cargo deferred to another trip from permanently unplaceable cargo.
 
## Ordering
 
Maintain separate values for:
 
- Delivery order
- Loading order
- Unloading order
 
For rear-door loading, later deliveries should generally be loaded first and deeper inside the vehicle.
 
## Demo Mode
 
Provide a predefined demo scenario with a fixed seed. It must reliably demonstrate:
 
- Multiple shops
- Mixed cargo
- At least two trips
- Door-aware placement
- Loading animation
- Delivery simulation
- Optimization metrics
- At least one deferred cargo item
 
# Out of Scope for the MVP
 
Do not implement:
 
* Route optimization on a real map
* GPS integration
* Fleet management
* Multiple simultaneous trucks
* Refrigeration
* Hazardous materials
* Detailed axle physics
* Forklift physics
* Complex irregular cargo shapes
* Authentication
* User accounts
* Database persistence
* Paid AI APIs
* Genetic algorithms unless the core MVP is already complete
* Realistic external truck models
 
---
 
# Implementation Order
 
Build in this order:
 
1. Scaffold the project and create a minimal working page.
2. Add vehicle and cargo domain models.
3. Add deterministic scenario generation.
4. Render one empty vehicle in 3D.
5. Render manually positioned cargo cuboids.
6. Implement overlap and boundary validation.
7. Implement the first-fit loading heuristic.
8. Add overflow and multi-trip planning.
9. Add optimization metrics.
10. Connect optimizer output to the 3D scene.
11. Add loading animation.
12. Add delivery simulation.
13. Polish the report and UI.
14. Add tests and deploy.
 
Before implementation, provide:
 
1. Clarifying questions
2. Proposed architecture
3. Development milestones
4. Risks and scope reductions
5. Suggested task split for three developers