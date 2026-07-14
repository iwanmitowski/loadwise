import { getVehicle, VEHICLE_IDS } from '@/features/vehicles/vehicles'
import { fmtDims, fmtKg } from '@/utils/format'
import type { VehicleId } from '@/types'

type Props = {
  value: VehicleId
  onChange(id: VehicleId): void
}

/**
 * Three selectable vehicle cards: name, cargo-space dims (m), payload, and a
 * proportional side-view schematic. Rendered as a radiogroup of toggle buttons
 * so keyboard users can Tab between cards and pick with Space/Enter.
 */
export function VehiclePicker({ value, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Vehicle"
      className="grid gap-3 sm:grid-cols-3"
    >
      {VEHICLE_IDS.map((id) => {
        const vehicle = getVehicle(id)
        const selected = id === value
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={[
              'flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors',
              selected
                ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500'
                : 'border-slate-800 bg-slate-900 hover:border-slate-600',
            ].join(' ')}
          >
            <VehicleSchematic id={id} />
            <span className="font-medium">{vehicle.name}</span>
            <span className="text-xs text-slate-400">
              {fmtDims(vehicle.cargoSpace)}
              <br />
              payload {fmtKg(vehicle.maxPayloadKg)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Largest cargo space (semi-trailer) — schematics scale relative to it so the
// three cards show honest side-view proportions.
const MAX_DEPTH = 1360
const MAX_HEIGHT = 265

/** Proportional side-view silhouette: cab + cargo box + wheels, no 3D. */
function VehicleSchematic({ id }: { id: VehicleId }) {
  const { cargoSpace } = getVehicle(id)
  // SVG canvas 150×64; keep a margin for wheels + cab.
  const boxW = (cargoSpace.depth / MAX_DEPTH) * 118
  const boxH = (cargoSpace.height / MAX_HEIGHT) * 44
  const floorY = 52 // wheels sit below this line
  const cabW = 18
  const cabH = Math.min(boxH, 26)
  const boxX = 148 - boxW // right-aligned: cab faces left
  return (
    <svg
      viewBox="0 0 150 64"
      aria-hidden="true"
      className="h-16 w-full text-slate-500"
    >
      {/* cargo box */}
      <rect
        x={boxX}
        y={floorY - boxH}
        width={boxW}
        height={boxH}
        rx="2"
        className="fill-slate-700 stroke-current"
        strokeWidth="1.5"
      />
      {/* cab */}
      <rect
        x={boxX - cabW - 2}
        y={floorY - cabH}
        width={cabW}
        height={cabH}
        rx="3"
        className="fill-slate-800 stroke-current"
        strokeWidth="1.5"
      />
      {/* wheels */}
      <circle cx={boxX - cabW + 6} cy={floorY + 6} r="5" className="fill-slate-600" />
      <circle cx={boxX + 10} cy={floorY + 6} r="5" className="fill-slate-600" />
      <circle cx={boxX + boxW - 10} cy={floorY + 6} r="5" className="fill-slate-600" />
    </svg>
  )
}
