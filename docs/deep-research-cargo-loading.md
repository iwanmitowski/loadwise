# Deep research for a web application for automatic truck and cargo loading optimisation

## Executive synthesis

The strongest product opportunity is **not** “best possible 3D packing in the abstract.” It is **execution-ready load planning for small and mid-sized distributors and 3PL operations that need safe, legal, warehouse-usable plans in minutes**. Real operators do not only care whether a load fits. They care whether the chosen vehicle is legal on axle loads, whether the last stop is reachable without rehandling half the truck, whether the warehouse can actually build the plan with forklifts and pallet labels, and whether the driver can defend the plan during inspection. That conclusion follows directly from EU cargo-securing guidance, CTU packing guidance, vehicle bodybuilder documents, warehouse/WMS execution workflows, and user discussions that repeatedly complain about manual spreadsheets, dated tools, weak execution support, and cost sensitivity. citeturn25view0turn27view0turn23search0turn23search3turn39search1turn39search5

For an MVP, the application should treat four things as first-class: **vehicle feasibility, order/stop accessibility, basic axle and mass-distribution checks, and manual override with guardrails**. Those four areas are much more operationally valuable than ambitious but hard-to-verify features like reinforcement learning, full ADR compliance, or exact vehicle-dynamics simulation. EU guidance explicitly requires correct cargo description, axle-aware distribution, non-overloading, and suitable securing arrangements; warehouse systems in practice also rely on scanning, sequence confirmation, and dock/door assignment, which means a plan that cannot be executed on the floor is not a useful plan. citeturn25view1turn25view2turn23search0turn23search10turn23search18

A crucial design boundary is that **law, best practice, and product approximation are not the same thing**. In the EU, the high-level legal framework comes from vehicle-weight and roadworthiness law, the CMR regime for international road haulage, ADR for dangerous goods, and national enforcement. Cargo securing practice is strongly shaped by the European Commission’s cargo-securing guidelines and the EN 12195 / EN 12642 family, but enforcement and incorporation vary by country. For shipping containers, the CTU Code and SOLAS VGM rules matter, especially in intermodal and port-linked flows. Your product should therefore label results as one of: **legal check**, **best-practice check**, or **planning estimate**. citeturn29view0turn25view0turn26view5turn33search1turn33search0turn33search4

## How loading works in the real world

### The outbound workflow from order to dispatched vehicle

A practical outbound road-freight workflow usually starts with **order capture and order consolidation**, then proceeds to transport planning, warehouse picking, staging, loading, securing, checking, documentation, dispatch, delivery, proof of delivery, and reverse flow handling. In WMS language, outbound work is commonly organised around delivery creation, route or load assignment, staging, loading confirmation, and dispatch confirmation. Major warehouse suites such as SAP, Oracle, Microsoft, Infor and CargoWise all reflect that same sequence even when they name steps differently. citeturn8search10turn23search18turn23search6turn8search18turn41search1turn41search13

In real operations, the sequence normally looks like this:

| Stage | What happens in practice | Main roles | Good software can decide | Humans usually still decide |
|---|---|---|---|---|
| Order preparation | Orders are grouped by route, customer, date, temperature class, and handling constraints | transport planner, dispatcher, customer service | grouping, route proposal, preliminary vehicle shortlist | commercial priorities, late changes, customer exceptions |
| Unit preparation | Cases are palletised, labelled, wrapped, measured, and staged | warehouse loader, palletiser, forklift operator | pallet pattern suggestions, label generation, dimensional checks | damaged pallet rejection, wrap quality, actual pallet condition |
| Vehicle selection | Trailer/van/box/container type is selected based on fit, payload, stop profile, and equipment | planner, dispatcher | fit, payload, axle estimate, reefer/door/tail-lift eligibility | driver availability, depot stock, maintenance status |
| Load plan creation | Items are sequenced by stop and physically placed | planner, lead loader | 3D placement, grouping, reverse-stop sequencing, basic blocking alerts | awkward items, forklift realities, customer-specific unloading constraints |
| Loading and securing | Workers build the load and apply bars, straps, mats, dunnage | loader, forklift operator, driver | step list, sequence numbers, scan validation, warning flags | real-time deviations, damaged packaging, on-floor adaptation |
| Dispatch check | Vehicle, cargo, documents, seals, and obvious defects are checked | driver, dispatcher, safety manager | checklist workflow, scan completeness, final weight summary | walkaround, visible cargo defects, acceptance of residual warnings |
| Delivery and reverse flow | Multi-stop unload, proof of delivery, rejected goods, returns collection | driver, customer receiver, dispatcher | stop order, unload list, proof capture, return manifest | acceptance/rejection at site, route disruption handling |

Source basis: WMS/TMS documentation, EU cargo-securing guidance, DVSA walkaround guidance, CMR guidance, and CTU-Code-derived packing flow. citeturn25view1turn25view2turn8search0turn33search1turn27view0

The **software-versus-human split** is especially important for your product design. Software is good at repetitive feasibility work: checking dimensions, sequence rules, basic weight distribution, alternative vehicles, and “next best trip.” Humans still dominate when the warehouse reality diverges from master data, when pallets are damaged, when the driver knows a customer dock can only unload from one side, or when a late order change arrives after loading has started. This is consistent with research showing that poor item master data harms logistics performance, with warehouse practitioners’ repeated complaints about dimension errors, and with HSE guidance that emphasises pallet condition and safe unloading realities. citeturn36search5turn36search9turn36search7turn36search3

### Roles, responsibilities, and exceptions

The European Commission’s cargo-securing guidance is unusually useful for product requirements because it breaks responsibilities down by transport planning, loading, and driving. For transport planning, the cargo must be correctly described with weight, dimensions, centre-of-gravity offset if relevant, and stack/orientation limits; dangerous goods must be correctly classified and documented; and vehicle and securing equipment must be suitable. For loading, the loader must check whether a load-securing plan exists, keep the vehicle clean and sound, avoid overstressing the floor, distribute cargo correctly on vehicle axles, prevent overloading, and apply anti-slip, dunnage, blocking bars, and lashing as required. For driving, the driver must carry out a visual inspection and make regular checks as far as accessible. citeturn25view0turn25view2turn25view3

This maps naturally to your application’s permissions:

- **Transport planner / dispatcher**: create manifest, compare vehicles, approve trip split, set stop priorities, publish plan.
- **Warehouse loader / forklift operator**: see sequence, scan pallet IDs, confirm placement, raise exception, attach photo.
- **Driver**: view final plan, complete pre-departure checklist, confirm seals/docs, flag visible risks, capture POD/returns.
- **Safety/compliance manager**: manage securing templates, vehicle technical data, warning thresholds, override policy. citeturn25view0turn23search0turn23search5turn23search13

Returned, rejected, or undelivered cargo needs explicit support. Multi-stop work often generates reverse flow: customer rejection, failed delivery, empties/returns collection, or cargo that becomes accessible only after unloading another stop. Reverse logistics literature and ePOD tooling both show that cost comes from duplicated transport, extra handling, and poor paperwork. That means your route and load model should reserve a small amount of **return capacity**, track **return-compatible zones**, and generate a **return manifest** instead of treating returns as an afterthought. citeturn8search3turn8search7turn23search13turn23search5

## Constraints your planner must model

### Vehicle geometry and real usable space

The most important lesson from manufacturer data is that **usable space is not the same as brochure volume**. Vans lose width at wheel arches, some have only one practical loading side, trailers differ in side access and floor ratings, and reefers lose internal volume to insulation and refrigeration hardware. For containers, door opening is usually smaller than internal width and height. citeturn11view3turn12view0turn12view2turn13search2turn12view1

| Vehicle type | Typical usable space you can model early | Practically important irregularities |
|---|---|---|
| Cargo van | Ford Transit L4 H3 sample: load length up to 4,256 mm, width 1,784 mm, width between wheel arches 1,392 mm, side-door width 1,300 mm, rear-door width 1,565 mm; sample payload varies by variant and can be about 924–1,131 kg on one heavy-duty L4 H3 example | wheel arches; bulkhead; one side door; roof taper/ribs; low tail-lift capacity if fitted citeturn11view3 |
| Large panel van | Mercedes Sprinter L4 H2 sample: load floor length 4,810 mm, width 1,787 mm, width between wheel arches 1,350 mm, volume 15.5 m³ | wheel arches; reduced side-door clearance on some variants; payload changes heavily by GVW variant citeturn12view0 |
| Box truck / rigid truck | Geometry depends on body; MAN 18 t rigid bodybuilder sheet shows body-length recommendations driven by wheelbase and unladen axle masses rather than only box size | tail-lift, floor point loads, axle sensitivity, underbody equipment, often no side access unless custom body citeturn14search0 |
| Curtain-side semi-trailer | Standard EU curtainsider is around 13.6 m class; Schmitz UK page states payload up to 32 t for a compliant curtainsider semitrailer in UK conditions | side access is good, but curtains on EN 12642 L bodies are weather protection, not structural restraint; floor ratings vary citeturn12view1turn24view1 |
| Reefer semi-trailer | Krone Cool Liner sample: internal length 13,310 mm, width 2,460 mm, height 2,630 mm; kingpin load 12,000 kg, axle load 27,000 kg, total 39,000 kg | lower usable width/height than dry van, airflow requirements, evaporator intrusion, higher tare weight citeturn13search1 |
| Dry shipping container | Maersk 40 ft dry sample: internal 12,032 × 2,350 × 2,393 mm, door 2,340 × 2,274 mm, max payload 28,800 kg; 40 HC: height to load line 2,697 mm, door height 2,577 mm | door opening smaller than internal dimensions; container tare matters; intermodal rules and VGM apply citeturn12view2turn33search0turn33search4 |
| Reefer container | Maersk 40 HC reefer sample: internal width about 2,280 mm, height to load line about 2,425–2,450 mm depending on unit | insulation and refrigeration reduce width/height; airflow and temperature uniformity matter citeturn13search2turn13search6 |

For an MVP, the **essential geometric constraints** are internal length/width/height, door opening width/height, payload, empty vehicle mass, axle group limits if known, wheel-arch intrusions, “usable floor rectangle” segments, side-door availability, and tail-lift presence/limit. The **postponeable constraints** are roof camber, wall deflection, rib spacing, exact side-post clearances, suspension compression under load, and manufacturer-specific floor deflection models. That prioritisation matches both operational value and data availability. citeturn11view3turn12view0turn37search10turn25view2

### Weight distribution and axle loading

#### Why total payload is not enough

A vehicle can be under gross payload and still be illegal or unsafe because one axle, axle group, or the kingpin is overloaded or underloaded. The EU dimensions-and-weights framework sets maximum limits for relevant vehicles in international traffic, while national enforcement penalises axle and gross breaches separately. UK guidance is a useful illustration: vehicles must not exceed plated axle, gross, or train weights, and each breach can be a separate offence. Tata Steel’s 2024 technical sheet also shows why load position matters: for standard 13.6 m trailers, permissible loading depends on tractor axle count, tare weight, fifth-wheel position, kingpin location, and axle spacing, not just total tonnes. citeturn29view0turn29view1turn40view0

#### Simplified formulas suitable for an MVP

For a **two-axle rigid vehicle or van**, model the vehicle as a simply supported beam.

Let:

- `WB` = wheelbase
- `F0` = empty front axle load
- `R0` = empty rear axle load
- item `i` has weight `wi`
- `xi` = distance of item centre of gravity from the **front axle**

Then the added axle reactions are:

- `ΔRear_i = wi × xi / WB`
- `ΔFront_i = wi × (WB - xi) / WB`

So:

- `FrontAxle = F0 + ΣΔFront_i`
- `RearAxle = R0 + ΣΔRear_i`

This is standard static equilibrium and aligns with both bodybuilder practice and academic routing/load-planning literature that uses the same mechanics for box vans and trucks. citeturn14search1turn5search1turn40view0

For a **semi-trailer**, use a two-stage approximation.

Stage one, trailer-only:

- `Lk` = distance from kingpin to trailer axle-group centre
- `xj` = distance of item `j` from kingpin along trailer floor

Then:

- `ΔTrailerAxles_j = wj × xj / Lk`
- `ΔKingpin_j = wj × (Lk - xj) / Lk`

Stage two, tractor unit:

- add `ΣΔKingpin_j` to the fifth wheel position on the tractor and distribute it across tractor steer/drive axles using the same beam equations and the tractor wheelbase.

This is a **planning approximation**, not a certified legal calculator, unless you have exact tractor geometry, tare axle loads, fifth-wheel position, and manufacturer limits. EasyCargo itself warns that semitrailer axle calculations are only correct when the truck is modelled together with the trailer; CargoWiz’s guide similarly says axle results depend on default tare and geometry assumptions and can otherwise mislead. citeturn15search16turn22view4turn40view0

For **left-right balance**, there is no harmonised EU-wide “acceptable imbalance percentage” I could verify for ordinary freight vehicles in the public sources reviewed. What the sources do say is consistent: load evenly left/right, keep the centre of gravity low, and avoid asymmetric loading that can impair handling or damage axles, tyres or the structure. Therefore, your product should treat lateral balance as a **best-practice safety metric**, not a universal legal threshold, unless the user enters wheel-load or suspension data for a specific vehicle. citeturn34search2turn34search11turn34search5turn38view0

A practical MVP lateral approximation is:

- divide the usable floor into left and right half-planes;
- calculate total mass each side of the centreline;
- compute lateral centre-of-gravity offset `y_cg = Σ(wi × yi) / Σwi`, where `yi` is signed from centreline;
- warn when the side difference exceeds a configurable threshold, for example **amber at 5–8% of total load, red at 10%+**, clearly labelled as a **product warning threshold**, not a universal legal rule.

That threshold recommendation is an inference from safety guidance that consistently emphasises symmetry and low CoG, not from a single binding EU numeric standard. citeturn34search2turn34search11turn38view0

#### Load-distribution charts and what needs vehicle-specific data

Load-distribution charts are the right answer whenever the vehicle or trailer manufacturer provides them. They define where the combined load centre of gravity may sit for a given payload and vehicle geometry. Tata Steel’s sheet gives a clear example for typical articulated combinations: for a 28 t payload on a typical six-axle vehicle with a 13.6 m trailer, the load centre of gravity should be about **6.4 m from the trailer headboard with a tolerance of ±0.2 m**; reducing payload by 1 t adds about 0.1 m of allowable variation. That is exactly the kind of chart your product should ingest when available. citeturn40view0

What you can implement generically in a browser MVP:

- gross weight and payload checks;
- rigid-vehicle front/rear axle estimate;
- semitrailer kingpin and trailer-axle estimate using user-entered geometry;
- lateral CG and side-mass split;
- CG height estimate from item centres;
- simple manufacturer-chart lookup if a vehicle record contains approved CoG bands. citeturn40view0turn15search16turn22view4

What requires exact manufacturer or fleet-specific data:

- legal compliance statement for every axle on every variant;
- accurate kingpin-to-tractor-axle redistribution;
- minimum drive-axle-load rules for a specific jurisdiction/combination;
- suspension and wheel-load limits;
- floor point-load certification;
- certified dynamic stability or rollover prediction. citeturn40view0turn29view1turn37search10

#### Worked examples

A useful **rigid-truck example**:

- wheelbase `WB = 5.0 m`
- empty front axle `F0 = 3.8 t`
- empty rear axle `R0 = 2.2 t`
- item A: `2.0 t` at `x = 2.0 m`
- item B: `3.0 t` at `x = 4.0 m`

Then:

- item A adds `0.8 t` to rear and `1.2 t` to front
- item B adds `2.4 t` to rear and `0.6 t` to front

Final loads:

- front axle = `3.8 + 1.2 + 0.6 = 5.6 t`
- rear axle = `2.2 + 0.8 + 2.4 = 5.4 t`

Total added payload is only `5.0 t`, but moving item B further back would quickly overload the rear axle while still keeping total payload unchanged. That is why “payload used” alone is insufficient. This example follows the same statics that bodybuilder and research sources use. citeturn14search1turn5search1

A useful **semi-trailer example**:

- kingpin to trailer axle-group centre `Lk = 8.1 m`
- single 10 t machinery crate
- crate CG at `x = 5.0 m` behind kingpin

Then:

- trailer axle group gets about `10 × 5.0 / 8.1 = 6.17 t`
- kingpin gets about `10 × (8.1 - 5.0) / 8.1 = 3.83 t`

If the same crate is moved 1.5 m rearward, the trailer axle group gain rises and the kingpin load falls. That can improve or worsen legality depending on the tractor’s drive-axle loading. In practice, this is why trailer OEMs and guidance documents insist on load-distribution plans and warn that loads placed too far back can reduce fifth-wheel pressure and tyre grip. citeturn11view1turn40view0

### Cargo placement, stacking, floor loads, and a practical data model

The European Commission guidance, CTU guidance, HSE pallet guidance, and ADR handling rules all point in the same direction: you need a **load-unit-centric data model**, not just a box list. Packaging strength, rigidity, orientation, surface friction, and support area all influence whether an arrangement is actually safe. Uniform parcels like pallets and drums should be packed to minimise lost space and achieve tight stow; damaged pallets should be rejected; packaging must withstand stacking and transport forces; and dangerous-goods packages must be restrained so they do not shift, change orientation, or become damaged. citeturn27view0turn6search3turn6search19turn31search3

A practical cargo-unit model should include these fields:

| Field group | Recommended fields |
|---|---|
| Identity | shipment ID, order ID, stop ID, customer ID, SKU/description, handling-unit ID, barcode/SSCC |
| Geometry | length, width, height, gross weight, true-measured flag, packaging type, support polygon or footprint class |
| Handling | forkliftable yes/no, pallet-jack yes/no, clamp-only, crane-only, manual-handle flag |
| Orientation | allowed rotations by axis, upright-only, no-tilt, side-load allowed, rear-load required |
| Stacking | may-stack-on, may-have-on-top, max stack count, max supported weight, full-support-only, overhang allowed yes/no |
| Safety | fragile, crush-sensitive, anti-slip required, dunnage required, hazardous flag/class, food/pharma flag, temp band |
| Accessibility | unload door preference rear/left/right/top, stop sequence, keep-order-together, priority, returns-compatible |
| Compliance | measured dimensions source, document refs, photo refs, DG docs present, seal/VGM/CMR refs if relevant |

This data model is directly justified by the EC responsibility list requiring accurate mass, dimensions, CoG offset, and orientation/stack limits; by warehouse scan workflows; and by GS1 logistic label practice. citeturn25view1turn23search3

The most useful cargo rules for your placement engine are these:

- **Pallets and cartons**: allow stacking only when packaging and pallet condition support it; reject damaged pallets; avoid underhang/overhang unless permitted; keep heavier units low. citeturn6search3turn36search3turn6search19
- **Drums**: model both soldier and offset patterns; require tight stow and likely dunnage/chocks; orientation matters. citeturn6search0turn6search12
- **IBCs**: treat stacking as certification-dependent and floor/level-dependent; no generic stacking assumption. citeturn6search16turn6search2
- **Machinery / heavy crates**: require floor-only unless rated otherwise; prefer axle-neutral positions; often need blocking, direct lashings, and low CoG. citeturn25view3turn38view2
- **Long goods**: need loop/spring lashing logic and often multiple securing points; two loop lashings per long cargo item is the quick-guide baseline. citeturn38view2
- **Fragile goods**: do not assume top-over lashing is harmless; guidance notes that concentrated lashing forces can damage product unless edge protection is used. citeturn38view1turn26view4
- **Dangerous goods**: if you are not implementing ADR class-specific rules, block them from “fully optimised” mode and treat them as manual-review cargo. ADR chapter 7 handling rules require proper stowage and securing against shift or damage. citeturn31search3turn31search1

On floor and point loads, your MVP should at least capture a per-vehicle **maximum distributed payload** and an optional **maximum forklift axle load / point-load flag**. The EC guidance says loaders must ensure the floor is not overstressed; EN 12642 requires the manufacturer to provide floor-strength information where relevant; and Schmitz documents show some trailer floors rated for about **7.5 t forklift axle load**. For swap bodies, EN 283-style floor tests are commonly referenced at **5,460 kg axle load**. citeturn25view2turn37search10turn37search0turn37search6

## Designing for execution, not just packing density

### Multi-stop loading and accessibility scoring

Multi-stop operations are where many elegant packing algorithms fail in practice. Warehouse and planning systems explicitly sequence deliveries in reverse stop order for loading, and DVSA guidance tells operators to check load condition between drops because multi-drop unloading changes the load and handling. SAP documentation specifically notes that sequencing covers both **reversed stop order** and the **arrangement of pallets for each stop**. citeturn35search2turn35search8

Your software should therefore score not only “fit quality” but also **accessibility and rehandling effort**. A practical model is:

- **Blocked cargo count**: number of units for earlier stops that have later-stop cargo in front of, on top of, or pinning them.
- **Rehandle count**: number of temporary unload/reload actions required to reach a target unit.
- **Door mismatch penalty**: cargo requiring left-side access but only rear access is feasible without major rehandling.
- **Order fragmentation penalty**: one customer’s order split into many scattered islands.
- **Time-window penalty**: inaccessible high-priority early-stop cargo gets stronger penalty.
- **Return-capacity penalty**: no accessible zone reserved for anticipated returns/empties. citeturn35search2turn35search0turn35search14turn8search3

A good accessibility score for a unit can be:

`AccessScore = 100 - 20×blocked_layers - 10×rehandles - 8×door_mismatch - 5×order_fragmentation`

Then aggregate by stop with heavier weights for earlier stops and narrow time windows. This is a **product scoring heuristic**, not a legal rule, but it is highly aligned with real multi-drop execution. citeturn35search2turn35search8

A very realistic example where the densest plan is not the best plan:

- Rear-door-only 18 t box truck
- Stop A has 5 pallets, Stop B has 4 pallets, Stop C has 3 pallets
- Densest 3D plan mixes A/B/C by height and footprint to fill every gap
- Operationally better plan loads **C first, B second, A last**, keeps each stop contiguous, and accepts 5–8% more void space to avoid two extra rehandling cycles at Stop A

The second plan will often save real labour and time at the customer site, reduce product damage, and keep the route on schedule. That is exactly the sort of “estimated savings” story your report view should tell. citeturn35search2turn35search8turn35search18

### Why planners override the optimiser

In production logistics, planners override automatic plans for reasons that are often mundane rather than mathematical. Based on the sources and on reasonable inference from them, the most common are: incorrect dimensions or weights in master data; damaged pallets or weak packaging; floor/deck defects; customer dock restrictions; side-vs-rear unload realities; limited forklift reach or mast clearance; late order changes; and preference for visual inspection or manual checking on high-value or fragile items. Those reasons are strongly supported by the documented impact of bad master data, HSE pallet-condition guidance, and safe-loading guidance that explicitly says loading should allow for safe unloading. citeturn36search5turn36search9turn36search7turn36search3

Recommended manual-edit features:

- drag-and-drop in 3D and 2D floor view;
- one-click rotation respecting allowed axes;
- lock position, lock orientation, and lock trip;
- move item between trips or to “deferred cargo”;
- re-optimise around locked cargo;
- undo/redo journal;
- live collision and overhang feedback;
- live axle/mass-distribution feedback;
- issue badges: **illegal**, **unsafe**, **operationally poor**, **data uncertain**. citeturn22view2turn21search0turn22view4

Override policy should be strict:

**Prohibit outright**
- collision/interpenetration;
- breach of vehicle gross or plated axle limit if that limit is configured;
- floor point-load breach if certified floor limit is configured;
- dangerous-goods segregation breach if DG mode is enabled;
- temperature incompatibility when reefer mode is active;
- unsupported stacking where lower unit max supported weight is exceeded. citeturn25view2turn29view1turn31search3

**Allow with warning**
- mild left-right imbalance;
- suboptimal stop accessibility;
- order split across two zones;
- unknown true dimensions;
- minor unused voids or partial support where user accepts risk;
- choice of a less efficient vehicle for commercial reasons. citeturn34search2turn36search5

### Loader Mode

A simple but high-impact **Loader Mode** should tell the worker exactly what to do next:

- handling-unit ID and barcode/QR;
- sequence number;
- customer / stop;
- load door to use;
- target zone and coordinates;
- allowed orientation;
- “next item after this” preview;
- safety notes: fragile, keep upright, anti-slip mat required, strap after placement;
- confirm by scan, photo if exception, and final driver sign-off. citeturn23search0turn23search3turn23search5turn23search13

This design is directly compatible with current warehouse execution practice. SAP RF supports loading by delivery and loading by handling unit on RF devices; GS1 logistic labels with SSCC are standard for pallet identification; dock/door assignment is a normal WMS concept; and proof tools are widely used for photo evidence and audit trails. citeturn23search0turn23search3turn23search10turn23search5

## Legal and safety boundaries for Europe

### Cargo securing, documentation, and inspection

The most important primary-source safety rule for road transport in Europe is the one your UI should surface constantly: the load-securing arrangement must be able to withstand **0.8 of cargo weight forward** and **0.5 sideways and rearward** under the EC cargo-securing guidelines, which reflect EN 12195-1 methods. The same guidelines also state that the design must consider acceleration, friction, safety factors, and test methods. citeturn38view2turn25view3

Friction matters materially. The EC guidelines say clean rubber anti-slip mats are generally taken as having **friction factor 0.6** on clean dry or wet contact surfaces unless a test certificate supports a higher value; if surfaces are dirty, frosty or otherwise poor, lower assumptions apply. This matters for your securing explanation engine because the recommended number of lashings should change when the user toggles anti-slip mats on or off. citeturn24view3

Vehicle body strength also matters. The guidelines distinguish EN 12642 body types and explicitly warn that a **curtainsider built only to EN 12642 L should be regarded as weather protection for side walls**, not side-load restraint in the way many operators casually assume. If you model curtain-side trailers, your UI should never imply that “has curtains” equals “load is laterally secured.” citeturn24view1

Documentation support should cover at least:

- **CMR** for international road haulage in CMR jurisdictions; UK guidance states a CMR note is required on international commercial journeys by road. citeturn33search1
- **eCMR support** where used; IRU notes that eCMR is now available under the protocol and is spreading across contracting countries. citeturn33search6turn33search13
- **VGM** for packed containers moving to sea transport; IMO requires the packed container’s actual gross mass to be verified before vessel loading. citeturn33search0turn33search4
- **ADR documents and labels** for dangerous goods when relevant. citeturn31search1turn31search3

Jurisdictional caution is essential. The EU sets a harmonised framework for authorised dimensions and weights in international traffic, but **national governments enforce the rules and can apply penalties differently**. National plates, ministry plates, or equivalent documents remain decisive in operation. Your application should therefore say “within configured legal data” rather than presenteering a universal EU legality verdict when precise national or vehicle-specific data is missing. citeturn29view0turn29view1

### Refrigerated, hazardous, and special cargo scope

The right product decision is to support some cargo classes deeply enough to be useful, and others only as restriction flags for now.

| Cargo class | Recommendation | Why |
|---|---|---|
| Temperature-controlled food | **Support in MVP at flag level plus vehicle eligibility** | ATP governs special equipment for perishable food transport; reefer vehicles/containers have materially different space and operating conditions. citeturn32search0turn32search1turn13search1turn13search2 |
| Pharmaceutical cold chain | **Restriction flag only in MVP** | EU GDP imposes legal obligations on wholesale distributors; full GDP compliance needs quality-system controls beyond packing. citeturn31search2turn31search14 |
| Dangerous goods under ADR | **Defer full support; keep manual-review flag and hard blocks** | ADR handling and stowage rules are strict and class-specific; partial automation risks false confidence. citeturn31search1turn31search3 |
| High-value cargo | **Restriction flag** | usually a planning/access/security concern rather than a unique geometry class. citeturn23search5 |
| Live animals | **Defer entirely** | animal-welfare rules are specialised and vehicle/equipment-specific under EU law. citeturn32search3 |
| Oversized / abnormal loads | **Defer entirely** | permitting, escorts, route approval and special-type rules go far beyond standard load planning. citeturn29view1 |
| Liquids / tanks / flexitanks | **Defer entirely** | wave/slosh dynamics and tank-specific requirements are materially different. citeturn27view0 |
| Hanging garments | **Restriction flag** | special equipment and hanging rails matter, but the geometry is niche enough to defer. |

## Market landscape, pain points, and where to differentiate

### Existing loading software and what is actually verified

Publicly verifiable product capability varies a lot. Some products are clear and documented; others market broadly but reveal little about operational execution. The table below separates **verified public capability** from areas where documentation was sparse.

| Product | Verified strengths | Verified gaps or cautions |
|---|---|---|
| **EasyCargo** | Browser-based 3D planner; automatic packing; manual drag/drop editor; Excel import/export; API; destination priority groups; shareable links/reports; axle/weight-distribution support when vehicle geometry is configured. citeturn22view2turn41search14turn41search2 | API still relies on user sign-in for calculation flow; public execution features are lighter than WMS-native loader workflows. citeturn41search14 |
| **Goodloading** | Web tool; multistops in public/manual materials; axle-load inputs; API and TMS/WMS integration positioning. citeturn21search5turn15search1turn41search3turn41search7 | Public documentation visible through search is less detailed in web previews; warehouse execution/mobile loader workflow is not strongly evidenced in current public docs I reviewed. citeturn21search13turn21search9 |
| **CargoWiz** | Multiple containers/trucks; drag-and-drop editor; axle-weight and CG reports; step-by-step loading reports; Excel/email export; cost allocation. citeturn15search2turn22view4turn21search2 | User guide explicitly says the algorithm builds for compactness first and axle/safety are reported afterwards; safety suitability remains the user’s responsibility. citeturn22view4 |
| **Load Xpert** | Strong axle weight / CG positioning reputation; supports truck, tractor-trailer, flatbed, container and railcar. citeturn15search3turn15search18 | Public materials skew toward axle calculation more than warehouse execution or multi-stop unloading guidance. citeturn15search3 |
| **Cape Pack** | Strong palletisation / packaging engineering / sustainability; cloud workflow; container/truck fit from a packaging-first angle. citeturn16search12turn16search20 | Not obviously built around multi-stop road delivery execution, axle legality, or planner overrides in route context. citeturn16search12 |
| **TOPS MaxLoad Pro / TOPS Pro** | Strong packaging + pallet + truck/container loading; mixed-SKU planning; step-by-step diagrams; drag/drop 3D; “how many trucks” logic. citeturn16search0turn16search3 | Public materials emphasise load-building and packaging more than live warehouse/mobile execution. citeturn16search3 |
| **CubeMaster** | Multi-modal loading, weight distribution, utilisation and cost calculation. citeturn16search1turn16search4turn16search7 | Publicly verified road-specific multi-stop and door-aware features are not as clear as core load optimisation. citeturn16search4 |
| **ORTEC** | Enterprise route + load optimisation, SAP integration context, strong manufacturing/logistics positioning, advanced constraint handling. citeturn41search0turn41search8turn41search12 | Likely too enterprise-heavy for the small-distributor wedge; operational complexity and sales cycle are much higher. |
| **CargoWise / WMS-native suites** | Warehouse execution, barcode mobility, digital audit trail, transit warehouse operations. citeturn41search1turn41search5 | Broad platform, not a focused SMB cargo-first planner; likely overkill for your initial market. |

Two recurring patterns stand out. First, many tools optimise **space** well but offer weak evidence of **warehouse execution readiness**. Second, some products support axle information, but not necessarily in a way that is tightly integrated with stop accessibility, manual lock-and-reoptimise, and warehouse loader mode. That gap is exactly where your concept is strongest. citeturn22view4turn41search5turn23search0

### User pain points and unmet needs

Across user discussions, review sites, and adjacent logistics-software commentary, the same complaints recur:

| Pain point | Frequency | Business impact | Hardness to solve | Differentiation potential |
|---|---|---:|---:|---:|
| People still use spreadsheets/manual sketches because tools are too expensive or overbuilt | High | High | Medium | High |
| Plans fit in theory but are poor for multi-stop unloading | High | High | Medium | Very high |
| Weak manual editing after optimisation | High | High | Medium | High |
| Axle calculations are absent, approximate, or disconnected from the packing engine | Medium-high | High | Medium-high | Very high |
| Poor data import / master-data friction | High | Medium-high | Medium | High |
| No warehouse-facing execution mode | Medium-high | High | Medium | Very high |
| Limited visibility into why the optimiser chose a layout | Medium | Medium-high | Medium | High |
| Enterprise suites are powerful but hard to buy, deploy, and use | High | High | High | Medium-high |

Evidence for this ranking comes from repeated user demand for budget-friendly and simpler tools, complaints about dated formats and licensing, Reddit posts about still drawing loads manually or not calculating axle weights, and enterprise-software commentary about scale/complexity trade-offs. The precise ranking is an inference, but it is strongly supported by the source pattern. citeturn39search1turn39search5turn19search4turn39search4turn39search8turn39search14

On differentiation, the standout features are:

| Candidate differentiator | Uniqueness | Customer value | Feasibility | Hackathon impact | Long-term defensibility |
|---|---:|---:|---:|---:|---:|
| Cargo-first workflow before vehicle selection | High | High | High | High | High |
| Automatic vehicle recommendation | High | High | High | High | High |
| Automatic multi-trip generation | High | Very high | Medium | Very high | High |
| Delivery-order-aware packing | Very high | Very high | Medium | Very high | High |
| Rear/side-door-aware unloading | Very high | Very high | Medium | Very high | High |
| Re-optimise around locked cargo | Medium-high | High | Medium | High | High |
| Explainable optimisation decisions | High | High | Medium | Very high | High |
| Real-time mass-distribution feedback | Medium-high | High | Medium | High | Medium-high |
| Loader Mode | High | Very high | Medium | Very high | Very high |
| Savings report | Medium | High | High | Very high | Medium |

The best three are **delivery-order-aware packing**, **door-aware accessibility**, and **Loader Mode**, because they are simultaneously operationally useful, visually demonstrable, and less commoditised than raw 3D packing. citeturn35search2turn23search0turn25view2turn41search0

## Recommended product strategy

### Functional requirements by priority

#### Essential hackathon MVP

| Requirement | User problem | Inputs | Outputs | Key validation / edge cases | Difficulty | Business value | Demo value |
|---|---|---|---|---|---:|---:|---:|
| Cargo-first manifest builder | Users know cargo before they know the vehicle | item dims, weight, qty, stop, fragility, orientation, stack rules | normalized cargo units | reject zero/negative measures; mixed units; duplicate IDs | Medium | High | High |
| Vehicle comparison and recommendation | Operators guess vehicle by habit | cargo list + vehicle library | ranked vehicles with fit/payload/trips | distinguish “fits by volume” from “fits by mass/axle estimate” | Medium | Very high | Very high |
| Multi-trip splitter | Cargo does not fit one vehicle | same as above + max trips/cost mode | trip set with deferred items if needed | ensure stop grouping and order priority not lost | Medium | Very high | Very high |
| Delivery-aware 3D placement | Dense plans can be impossible to unload | cargo + vehicle + stop order + door availability | 3D plan, accessibility score, blocked-cargo report | last-stop-first loading; door mismatch | Medium-high | Very high | Very high |
| Basic mass-distribution evaluator | Payload alone is unsafe | vehicle tare, axle geometry if known, placements | gross weight, front/rear or kingpin/trailer estimates, lateral balance | label estimate vs configured legal check; unknown geometry | Medium | Very high | High |
| Manual locks and reoptimise | Real world never matches master data perfectly | user edits | preserved edits + regenerated plan | collision detection; prohibit illegal overrides | Medium | High | High |

Source basis for these priorities: EU responsibility chain, vehicle/bodybuilder data, multistop workflow evidence, and software gap analysis. citeturn25view1turn40view0turn35search2turn22view2

#### Strong final-round differentiators

| Requirement | Why it matters |
|---|---|
| Loader Mode with scan-confirm sequence | turns a planning demo into an execution demo; differentiates from most pure packers |
| Explainability panel | “Placed here because Stop 1 rear access, axle estimate improved, fragile item protected, no stack allowed above” |
| Before-versus-after savings report | converts geometry into business story: fewer trips, less rehandling, faster unload |
| Rehandle simulator | counts temporary unloads required at each stop |
| Public shareable plan link | great for collaboration and hackathon judge experience |

These are high demo-value because they make the optimiser understandable and operationally credible. citeturn23search0turn23search5turn41search10

#### Commercial version requirements

- fleet-specific axle chart ingestion and vehicle templates;
- API and CSV/Excel imports with customer-specific schemas;
- WMS/TMS integration and scan events;
- configurable override governance and audit log;
- lane/customer unloading rules;
- return/empties planning;
- reefer eligibility and temperature-band checks;
- richer reports and eCMR / document hooks. citeturn41search3turn41search14turn33search6

#### Features to avoid for now

- full ADR class logic and segregation engine;
- live-animal planning;
- oversize permit routing;
- liquid slosh/tank dynamics;
- exact certified legal compliance claims without fleet-specific data;
- reinforcement-learning-heavy optimisation in the browser. citeturn31search1turn32search3turn29view1

### Recommended optimisation model

For a browser-based TypeScript application, the most practical MVP approach is a **deterministic hybrid heuristic**:

- trip splitting / vehicle shortlist first;
- sort items by a composite priority: cannot-defer, stop order, weight/footprint, stackability;
- use an **extreme-point** or **maximal-free-rectangles** style 3D placement core;
- build by **layers/floors** when that improves explainability and warehouse executability;
- after initial placement, run a small **local search / repair pass** to improve accessibility, balance, and blocked-cargo score around locked items. citeturn41search0turn22view2turn21search5

Why this beats other approaches for MVP:

| Approach | Browser feasibility | Determinism | Explainability | Fit for multi-stop + locks |
|---|---:|---:|---:|---:|
| Greedy heuristics | Very high | High | High | Medium |
| Extreme-point 3D packing | High | High | Medium-high | High |
| Guillotine packing | High | High | High | Medium |
| Layer-based packing | Very high | High | Very high | High |
| Local search | High | Medium | Medium | High |
| Simulated annealing | Medium | Low | Low | Medium |
| Genetic algorithms | Medium-low | Low | Low | Medium |
| Constraint programming | Medium | High | Medium | High but slower |
| Mixed-integer programming | Low-medium in browser, high on server | High | High | High but expensive |
| Reinforcement learning | Low | Low | Very low | Poor MVP fit |

My recommendation:

- **MVP**: deterministic **extreme-point + layer heuristic + local repair**, fully in browser, with locked-item support.
- **Production**: hybrid architecture where the browser runs a fast heuristic preview, while a server-side CP/MIP improvement service optionally refines the candidate plan for high-value loads or overnight planning. citeturn41search0turn41search4

### Suggested scoring model

Use an explainable weighted penalty model on **whole plans**, with a secondary score on **each placement**.

A good full-plan score:

`PlanPenalty = Wt×Trips + Wu×UnplacedMassRatio + Wb×BlockedStops + Wr×Rehandles + Wa×AxlePenalty + Wl×LateralImbalance + Wf×FrontRearImbalance + Wg×HighCG + Ws×OrderSplit + Wc×Complexity + We×EstimatedCost`

Where:

- **Trips** is dominant;
- **UnplacedMassRatio** and **BlockedStops** are next-most important;
- **AxlePenalty** is zero when inside limits and rises steeply after breach;
- **Complexity** can count mixed layers, tiny gaps, or excessive manual-sensitive placements. citeturn25view2turn35search2turn40view0

Suggested relative weights:

| Metric | Minimise Trips | Balanced | Fast Unloading |
|---|---:|---:|---:|
| Trips | 35 | 22 | 15 |
| Unplaced cargo | 20 | 15 | 10 |
| Estimated cost | 12 | 12 | 10 |
| Blocked cargo / stops | 6 | 12 | 20 |
| Rehandles | 5 | 10 | 18 |
| Axle / mass compliance | 10 | 10 | 8 |
| Front-rear / left-right balance | 5 | 7 | 6 |
| High centre of gravity | 3 | 5 | 5 |
| Order splitting | 2 | 4 | 5 |
| Loading complexity | 2 | 3 | 3 |

For individual placement scoring, reward:

- correct stop-zone fit;
- low incremental axle penalty;
- low incremental blocked-cargo count;
- full support under the item;
- low resulting CG height;
- minimal orphan voids. citeturn35search2turn25view2turn38view0

### Final product recommendation

The best initial customer is a **small or mid-sized distributor, manufacturer, or 3PL operating box trucks, curtain-siders, and vans on repeat regional multi-stop routes**. This customer has enough complexity to need better planning, but not enough IT budget or patience for a heavyweight enterprise programme. That matches the pain signals from public user discussions asking for affordable, easy tools and from the current market split between simple packing tools and large suites. citeturn39search1turn39search5turn41search0turn41search9

The main problem statement should be:

> “Warehouse and transport teams can usually tell whether cargo might fit, but they still waste time and money because they choose the wrong vehicle, create multi-stop loads that are hard to unload, discover axle or balance problems too late, and have no executable loading sequence for the warehouse.”

The strongest value proposition is:

> **Cargo-first, browser-based load planning that recommends the right vehicle, splits loads into trips automatically, builds delivery-aware 3D plans, and gives warehouse teams an executable Loader Mode — with explainable weight and accessibility feedback.**

The five most important MVP features are:

1. cargo-first manifest import/create;
2. automatic vehicle recommendation;
3. automatic multi-trip generation;
4. delivery-aware 3D placement with rear/side-door logic;
5. manual lock-and-reoptimise with mass-distribution feedback. citeturn35search2turn22view2turn40view0

The three strongest differentiators are:

- delivery-order-aware packing;
- rear/side-door-aware accessibility scoring;
- Loader Mode for warehouse execution. citeturn35search2turn23search0

The biggest technical risk is **getting the optimiser to remain fast, deterministic, editable, and operationally sensible at the same time**. The biggest legal/safety risk is **overstating compliance when only approximate axle/vehicle data exists**. The biggest business risk is **building a clever optimiser that planners admire but warehouse teams cannot execute**. citeturn22view4turn29view1turn23search0

A recommended product workflow is:

1. import or create cargo units;
2. enrich with stop, handling, and stacking rules;
3. compare candidate vehicles;
4. generate one or more trip plans;
5. review 3D plan with access and mass warnings;
6. manually lock critical items and re-optimise;
7. publish Loader Mode + report + share link;
8. execute with scan/photo exceptions;
9. capture POD/returns and feed back actuals. citeturn22view2turn23search0turn23search5

A realistic **48-hour hackathon scope** is:

- 6–8 sample vehicles;
- CSV manifest import;
- 3D packing with stop-aware ordering;
- simple multi-trip splitter;
- front/rear + left/right estimate;
- drag/drop + lock + reoptimise;
- Loader Mode mock on mobile layout;
- before/after savings view.  

Do **not** attempt full ADR, exact semitrailer legality across all tractor variants, or WMS-grade live scanning integrations in that window. citeturn40view0turn31search1

A realistic **3-month roadmap**:

- richer vehicle library and user-defined vehicles;
- chart-based axle logic where data exists;
- public share links and PDF reports;
- customer unloading rules;
- returns zones;
- API and webhook integration;
- better explainability. citeturn41search3turn41search14

A realistic **12-month commercial roadmap**:

- fleet-specific templates and certified data onboarding;
- WMS/TMS connectors;
- full audit trail and override governance;
- advanced analytics on savings and damages;
- reefer/pharma restriction modules;
- optional server-side optimisation upgrade;
- collaborative planning, scenario simulation, and training mode. citeturn41search0turn41search9

### Decision document for the master development prompt

**Target customer**  
Small and mid-sized distributors, manufacturers, and 3PLs running recurrent multi-stop regional deliveries with vans, box trucks, and curtain-side trailers.

**Core problem**  
Loads are planned for fit, not for legality, unloadability, or warehouse execution.

**Core promise**  
Cargo-first planning that picks the right vehicle, splits trips automatically, builds delivery-aware 3D loads, and produces a warehouse-executable sequence.

**Must-have MVP behaviours**
- import/create cargo before selecting vehicle;
- compare multiple vehicle types;
- recommend the best vehicle;
- split into multiple trips automatically;
- pack in 3D with stop-aware accessibility;
- show gross weight and approximate mass distribution;
- allow drag/drop, rotate, lock, and reoptimise;
- output blocked cargo, rehandles, deferred cargo, utilisation, and estimated savings.

**Data model must include**
- dimensions, weight, quantity;
- stop/customer;
- stacking/support limits;
- rotation and upright rules;
- fragility;
- preferred unload door;
- handling-unit ID / barcode;
- data-confidence / measured flag.

**Hard safety rules**
- no collisions;
- no configured gross/axle breaches;
- no unsupported stacking;
- no floor load breach when configured;
- no DG or temperature incompatibility when those modes are enabled.

**Soft operational scores**
- blocked cargo;
- rehandles;
- order fragmentation;
- door mismatch;
- high CoG;
- lateral imbalance.

**Recommended optimiser**
- deterministic extreme-point + layer heuristic + repair local search;
- browser-first;
- lock-aware;
- server refinement later.

**Most defensible differentiators**
- delivery-order-aware loading;
- rear/side-door-aware unloading logic;
- Loader Mode.

**Features to explicitly defer**
- full ADR compliance engine;
- live animals;
- abnormal loads;
- liquid/tank dynamics;
- universal legal-compliance claims without fleet-specific data.

**Language for compliance messaging**
- “legal check” only where exact configured limits exist;
- otherwise “planning estimate” or “best-practice warning”.

**Best hackathon demo story**
- import a mixed multi-stop manifest;
- compare van vs box truck vs curtain-sider;
- show one plan needs two trips, another needs one but blocks stop 1;
- reoptimise for fast unloading;
- manually lock a critical pallet near the side door;
- show Loader Mode and savings report.