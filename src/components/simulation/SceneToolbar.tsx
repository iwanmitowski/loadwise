// Scene chrome for the 3D view: wall/roof/door toggles + camera reset, wired to
// uiStore. T12 adds this now so the scene is controllable; T09/T10 own the full
// simulation screen and may relocate it into their layout.

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
  const toggleWalls = useUiStore((s) => s.toggleWalls)
  const toggleRoof = useUiStore((s) => s.toggleRoof)
  const toggleDoors = useUiStore((s) => s.toggleDoors)
  const resetView = useUiStore((s) => s.resetView)

  return (
    <div className="pointer-events-auto flex flex-wrap gap-2">
      <ToggleButton
        label="Walls"
        icon="▦"
        active={wallsVisible}
        onClick={toggleWalls}
      />
      <ToggleButton
        label="Roof"
        icon="▤"
        active={roofVisible}
        onClick={toggleRoof}
      />
      <ToggleButton
        label={doorsOpen ? 'Doors open' : 'Doors'}
        icon="⧉"
        active={doorsOpen}
        onClick={toggleDoors}
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
