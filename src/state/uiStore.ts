// UI/view state for the 3D scene chrome. Created by T12 for the scene toggles
// (walls, roof, doors, camera reset). T09 owns the broader app-shell store and
// may extend this file with screen/selection state — keep additions additive so
// T12's scene controls keep working.

import { create } from 'zustand'

export type UiState = {
  /** Transparent side/front walls shown. Toggle from scene chrome. */
  wallsVisible: boolean
  /** Transparent roof panel shown. */
  roofVisible: boolean
  /** Doors swung/slid open (animated in the scene). */
  doorsOpen: boolean
  /**
   * Monotonic counter bumped by `resetView()`. The camera-reset hook subscribes
   * to it; a change (not the value) is the signal to snap back to the initial
   * pose. A counter avoids the "already false" problem of a boolean flag.
   */
  resetViewNonce: number

  toggleWalls: () => void
  toggleRoof: () => void
  toggleDoors: () => void
  setWallsVisible: (visible: boolean) => void
  setRoofVisible: (visible: boolean) => void
  setDoorsOpen: (open: boolean) => void
  resetView: () => void
}

export const useUiStore = create<UiState>((set) => ({
  wallsVisible: true,
  roofVisible: false,
  doorsOpen: false,
  resetViewNonce: 0,

  toggleWalls: () => set((s) => ({ wallsVisible: !s.wallsVisible })),
  toggleRoof: () => set((s) => ({ roofVisible: !s.roofVisible })),
  toggleDoors: () => set((s) => ({ doorsOpen: !s.doorsOpen })),
  setWallsVisible: (visible) => set({ wallsVisible: visible }),
  setRoofVisible: (visible) => set({ roofVisible: visible }),
  setDoorsOpen: (open) => set({ doorsOpen: open }),
  resetView: () => set((s) => ({ resetViewNonce: s.resetViewNonce + 1 })),
}))
