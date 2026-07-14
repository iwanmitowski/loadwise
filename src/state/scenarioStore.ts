import { create } from 'zustand'
import type { Scenario, ScenarioConfig } from '@/types'
import { generateScenario } from '@/features/scenario/generate'
import { DEMO_CONFIG } from '@/fixtures/demoConfig'
import { useOptimizationStore } from './optimizationStore'
import { useUiStore } from './uiStore'

export type ScenarioState = {
  config: ScenarioConfig
  scenario: Scenario | null
  setConfig(patch: Partial<ScenarioConfig>): void
  generate(): void
  randomizeSeed(): void
  /** Demo mode (T17): apply the hard-coded demo config and generate. */
  loadDemo(): void
}

const DEFAULT_CONFIG: ScenarioConfig = {
  seed: 'loadwise-1',
  vehicleId: 'box-truck',
  sideDoor: 'none',
  shopCount: 5,
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  config: DEFAULT_CONFIG,
  scenario: null,

  setConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),

  generate: () => {
    const scenario = generateScenario(get().config)
    set({ scenario })
    // A fresh scenario invalidates any prior optimization and UI selections.
    useOptimizationStore.getState().reset()
    useUiStore.getState().resetForNewScenario()
  },

  // UI-layer id generation — allowed to use crypto.randomUUID (not domain code).
  randomizeSeed: () =>
    set((state) => ({
      config: { ...state.config, seed: crypto.randomUUID().slice(0, 8) },
    })),

  loadDemo: () => {
    set({ config: { ...DEMO_CONFIG } })
    get().generate()
  },
}))
