import { useMemo, useState } from 'react'
import { VehicleScene } from '@/three/VehicleScene'
import { SceneToolbar } from '@/components/simulation/SceneToolbar'
import { buildScenarioVehicle, VEHICLE_IDS } from '@/features/vehicles/vehicles'
import type { SideDoorChoice, VehicleId } from '@/types'

// NOTE (T12): this is a temporary harness so the vehicle scene is visible and all
// three vehicles + door configurations can be verified. T09/T10 replace it with
// the real setup + simulation screens; the scene + toolbar drop straight in.

const SIDE_DOOR_CHOICES: SideDoorChoice[] = ['none', 'left', 'right']

function App() {
  const [vehicleId, setVehicleId] = useState<VehicleId>('box-truck')
  const [sideDoor, setSideDoor] = useState<SideDoorChoice>('none')
  const vehicle = useMemo(
    () => buildScenarioVehicle(vehicleId, sideDoor),
    [vehicleId, sideDoor],
  )

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between px-6 py-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">LoadWise</h1>
          <p className="text-xs text-slate-400">{vehicle.name} — 3D scene</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1 text-slate-400">
            Vehicle
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value as VehicleId)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
            >
              {VEHICLE_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-slate-400">
            Side door
            <select
              value={sideDoor}
              onChange={(e) => setSideDoor(e.target.value as SideDoorChoice)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
            >
              {SIDE_DOOR_CHOICES.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        <VehicleScene vehicle={vehicle} />
        <div className="absolute right-4 top-4">
          <SceneToolbar />
        </div>
      </main>
    </div>
  )
}

export default App
