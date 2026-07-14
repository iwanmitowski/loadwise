import { create } from 'zustand'

export type Screen = 'setup' | 'planning' | 'simulation' | 'report'
export type PlaybackMode = 'idle' | 'loading' | 'delivery'
export type PlaybackSpeed = 0.5 | 1 | 2 | 4

export type Playback = {
  mode: PlaybackMode
  playing: boolean
  speed: PlaybackSpeed
  /** Step index within the active animation (loading order / delivery stop). */
  index: number
}

export type UiState = {
  screen: Screen
  selectedTripId: string | null
  selectedCargoId: string | null
  /** shopId to filter cargo/highlights by, or null = show all. */
  shopFilter: string | null
  wallsVisible: boolean
  roofVisible: boolean
  doorsOpen: boolean
  playback: Playback
  /**
   * Monotonic counter bumped whenever the view is reset. The 3D camera-reset
   * hook (T12) subscribes to it: a change (not the value) is the signal to snap
   * the camera back to its initial pose. A counter avoids the "already at
   * default" problem a boolean flag would have.
   */
  resetViewNonce: number

  goTo(screen: Screen): void
  setSelectedTrip(tripId: string | null): void
  setSelectedCargo(cargoId: string | null): void
  setShopFilter(shopId: string | null): void
  setWallsVisible(visible: boolean): void
  setRoofVisible(visible: boolean): void
  setDoorsOpen(open: boolean): void
  setPlayback(patch: Partial<Playback>): void
  /** Reset the 3D view toggles + playback to defaults (keeps screen/selection). */
  resetView(): void
  /** Full reset of selections, filter, view and screen — used on new scenario. */
  resetForNewScenario(): void
}

const DEFAULT_PLAYBACK: Playback = {
  mode: 'idle',
  playing: false,
  speed: 1,
  index: 0,
}

// Roof hidden by default so the loaded cargo is visible from above; walls on.
const DEFAULT_VIEW = {
  wallsVisible: true,
  roofVisible: false,
  doorsOpen: false,
  playback: DEFAULT_PLAYBACK,
} as const

export const useUiStore = create<UiState>((set) => ({
  screen: 'setup',
  selectedTripId: null,
  selectedCargoId: null,
  shopFilter: null,
  resetViewNonce: 0,
  ...DEFAULT_VIEW,

  goTo: (screen) => set({ screen }),
  setSelectedTrip: (selectedTripId) => set({ selectedTripId }),
  setSelectedCargo: (selectedCargoId) => set({ selectedCargoId }),
  setShopFilter: (shopFilter) => set({ shopFilter }),
  setWallsVisible: (wallsVisible) => set({ wallsVisible }),
  setRoofVisible: (roofVisible) => set({ roofVisible }),
  setDoorsOpen: (doorsOpen) => set({ doorsOpen }),
  setPlayback: (patch) =>
    set((state) => ({ playback: { ...state.playback, ...patch } })),

  // Bump the nonce so the camera-reset hook fires alongside the toggle reset.
  resetView: () =>
    set((state) => ({ ...DEFAULT_VIEW, resetViewNonce: state.resetViewNonce + 1 })),
  resetForNewScenario: () =>
    set((state) => ({
      screen: 'setup',
      selectedTripId: null,
      selectedCargoId: null,
      shopFilter: null,
      resetViewNonce: state.resetViewNonce + 1,
      ...DEFAULT_VIEW,
    })),
}))
