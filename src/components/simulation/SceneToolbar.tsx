// Scene chrome for the 3D view: wall/roof/door toggles + camera reset, wired to
// uiStore. Overlaid on the simulation screen's 3D canvas.

import { useUiStore } from '@/state/uiStore'

type ToggleButtonProps = {
  label: string
  icon: string
  active: boolean
  onClick: () => void
}

function ToggleButton({ label, icon, active, onClick }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={[
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
        'border backdrop-blur',
        active
          ? 'border-sky-400/60 bg-sky-500/20 text-sky-100'
          : 'border-slate-600/60 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60',
      ].join(' ')}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  )
}

export function SceneToolbar() {
  const wallsVisible = useUiStore((s) => s.wallsVisible)
  const roofVisible = useUiStore((s) => s.roofVisible)
  const doorsOpen = useUiStore((s) => s.doorsOpen)
  const setWallsVisible = useUiStore((s) => s.setWallsVisible)
  const setRoofVisible = useUiStore((s) => s.setRoofVisible)
  const setDoorsOpen = useUiStore((s) => s.setDoorsOpen)
  const resetView = useUiStore((s) => s.resetView)

  return (
    <div className="pointer-events-auto flex flex-wrap gap-2">
      <ToggleButton
        label="Walls"
        icon="▦"
        active={wallsVisible}
        onClick={() => setWallsVisible(!wallsVisible)}
      />
      <ToggleButton
        label="Roof"
        icon="▤"
        active={roofVisible}
        onClick={() => setRoofVisible(!roofVisible)}
      />
      <ToggleButton
        label={doorsOpen ? 'Doors open' : 'Doors'}
        icon="⧉"
        active={doorsOpen}
        onClick={() => setDoorsOpen(!doorsOpen)}
      />
      <button
        type="button"
        onClick={resetView}
        title="Reset camera"
        className="flex items-center gap-2 rounded-md border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-sm font-medium text-slate-300 backdrop-blur transition hover:bg-slate-700/60"
      >
        <span aria-hidden>⟲</span>
        Reset view
      </button>
    </div>
  )
}
