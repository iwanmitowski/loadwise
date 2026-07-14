// React overlay showing metadata for the selected cargo box. Lives outside the
// 3D canvas (it's DOM chrome); the 3D layer only owns selection state in
// uiStore. Rendered by ScreenSimulation on top of the VehicleScene.

import { useMemo } from 'react'
import type { DeliveryTrip, Scenario } from '@/types'
import { useUiStore } from '@/state/uiStore'
import { buildCargoRenderItems } from '@/three/CargoLayer/cargoModel'
import { fmtDims, fmtKg } from '@/utils/format'

const DOOR_LABEL: Record<string, string> = {
  rear: 'Rear door',
  left: 'Left door',
  right: 'Right door',
}

/**
 * Details panel for the currently selected cargo item. Renders nothing when
 * nothing is selected. Resolves the selection against the same render model the
 * 3D layer uses, so panel and scene never disagree.
 */
export function CargoInfoPanel({
  trip,
  scenario,
}: {
  trip: DeliveryTrip
  scenario: Scenario
}) {
  const selectedCargoId = useUiStore((s) => s.selectedCargoId)
  const setSelectedCargo = useUiStore((s) => s.setSelectedCargo)

  const item = useMemo(() => {
    if (!selectedCargoId) return null
    return (
      buildCargoRenderItems(trip, scenario).find(
        (i) => i.cargoId === selectedCargoId,
      ) ?? null
    )
  }, [selectedCargoId, trip, scenario])

  if (!item) return null

  return (
    <div
      role="dialog"
      aria-label={`Cargo details: ${item.templateName}`}
      className="pointer-events-auto w-64 rounded-lg border border-slate-700/70 bg-slate-900/85 p-4 text-sm text-slate-200 shadow-xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-100">{item.templateName}</h3>
        <button
          type="button"
          onClick={() => setSelectedCargo(null)}
          aria-label="Clear selection"
          className="rounded px-1 text-slate-400 transition hover:text-slate-100"
        >
          ✕
        </button>
      </div>

      <div className="mt-1 flex items-center gap-2 text-slate-300">
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-full ring-1 ring-white/20"
          style={{ backgroundColor: item.color }}
        />
        <span>{item.shopName}</span>
      </div>

      {item.fragile ? (
        <p className="mt-2 rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-200">
          ⚠ Fragile — nothing stacked on top
        </p>
      ) : null}

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        <Row label="Dimensions" value={fmtDims(item.size)} />
        <Row label="Weight" value={fmtKg(item.weightKg)} />
        <Row label="Loading order" value={`#${item.loadingOrder}`} />
        <Row label="Door" value={DOOR_LABEL[item.assignedDoor] ?? item.assignedDoor} />
        <Row
          label="Stop"
          value={item.stopNumber === null ? '—' : `#${item.stopNumber}`}
        />
      </dl>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-100">{value}</dd>
    </>
  )
}
