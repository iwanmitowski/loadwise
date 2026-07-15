# LoadWise — 3-minute demo script

**Live:** https://loadwise-chi.vercel.app/ · **Seed:** `demo-1` (fully reproducible)

Rehearse twice, timed, swapping drivers. Target machine: 1280×720 (projector).
Keep a **fallback screen recording** of this exact run in case live 3D/WebGL
misbehaves on the venue machine.

---

### 0:00 — The hook (15s)
> "Anyone can check whether cargo *fits* a truck. The hard part is loading it so
> the last stop is reachable, the axles are legal, and it's safe to drive.
> That's LoadWise — cargo-first load planning in 3D, fully deterministic, no AI
> in the loop."

### 0:15 — Setup: the constraint story (25s)
On the **Setup** screen, point at the three vehicles and the **side door** picker.
> "Vehicle, doors, number of shops — doors matter: some cargo unloads from the
> side. Everything runs off a **seed**, so the same inputs always produce the
> same plan."

Click **Load demo** (box truck, left side door, 6 shops, seed `demo-1`).

### 0:40 — Planning: what we're loading (25s)
> "Six shops, each with realistic cargo, in delivery order. Seed `demo-1` up top
> — reproducible every time." 

Click **Optimize**. Call out the progress bar:
> "Optimization runs in a Web Worker — the UI never freezes, and it's cancelable."

### 1:05 — Simulation: the 3D plan (40s)
The app jumps to the 3D scene.
> "Here's the loaded box truck. Cargo is color-coded by shop."

- **Orbit** the camera; **toggle Walls**; **click a pallet** → metadata panel
  (dimensions, weight, shop, loading order, door).
- Click a shop in the legend to **filter** it.
> "Notice cargo is packed toward the cab and low — that's the axle/centre-of-
> gravity model keeping the load safe, not just dense."

### 1:45 — Loading replay + delivery (40s)
Hit **Replay loading** at **2×**:
> "Watch it load back-to-front — last delivery goes in first, so the first stop
> comes out first. Boxes enter *through the doors*, never through the walls."

Then **Simulate route**:
> "Stop one unloads through the side door. If later cargo blocks an earlier stop,
> it counts the extra moves — because a dense plan that's a nightmare to unload
> isn't a good plan."

### 2:25 — Trip 2 + the report (30s)
Click the **Trip 2** tab:
> "Everything didn't fit in one load, so LoadWise automatically planned a second
> trip."

Switch to **Report**:
> "A deterministic score per trip. Weight and volume use, left/right balance,
> load stability from the axle model, blocked cargo, the deferred item, and
> plain-language warnings — all computed math, no API call. Export the scenario
> or result as JSON right here."

### 2:55 — Close (5s)
> "Cargo-first, delivery-aware, physically honest load planning — in the browser,
> deterministic, no backend. That's LoadWise."

---

## Fallback plan
- If the venue WebGL is flaky: play the pre-recorded screen capture of this run.
- If live network fails: run it locally (`npm run build && npm run preview`) —
  the same production bundle, no network needed after load.
- The demo seed is frozen (`demo-1`); optimizer weights are frozen post-T18, so
  the rehearsed run and the live run are identical.
