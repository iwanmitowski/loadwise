import { SeedField } from '@/components/setup/SeedField'
import { ShopCountField } from '@/components/setup/ShopCountField'
import { SideDoorPicker } from '@/components/setup/SideDoorPicker'
import { VehiclePicker } from '@/components/setup/VehiclePicker'
import { useScenarioStore } from '@/state/scenarioStore'
import { useUiStore } from '@/state/uiStore'

/**
 * Scenario Setup — vehicle, side door, shop count and seed, then generate.
 * All config lives in the scenario store; this screen is a pure form over it.
 */
export function ScreenSetup() {
  const config = useScenarioStore((s) => s.config)
  const setConfig = useScenarioStore((s) => s.setConfig)
  const generate = useScenarioStore((s) => s.generate)
  const randomizeSeed = useScenarioStore((s) => s.randomizeSeed)
  const loadDemo = useScenarioStore((s) => s.loadDemo)
  const goTo = useUiStore((s) => s.goTo)

  const onGenerate = () => {
    generate()
    goTo('planning')
  }

  const onLoadDemo = () => {
    loadDemo()
    goTo('planning')
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <div>
        <h2 className="text-xl font-semibold">Set up scenario</h2>
        <p className="mt-1 text-sm text-slate-400">
          Pick a vehicle and delivery settings, then generate a reproducible
          scenario.
        </p>
      </div>

      <Field label="Vehicle">
        <VehiclePicker
          value={config.vehicleId}
          onChange={(vehicleId) => setConfig({ vehicleId })}
        />
      </Field>

      <Field label="Side door">
        <SideDoorPicker
          value={config.sideDoor}
          onChange={(sideDoor) => setConfig({ sideDoor })}
        />
      </Field>

      <Field label="Shops">
        <ShopCountField
          value={config.shopCount}
          onChange={(shopCount) => setConfig({ shopCount })}
        />
      </Field>

      <Field label="Seed">
        <SeedField
          value={config.seed}
          onChange={(seed) => setConfig({ seed })}
          onRandomize={randomizeSeed}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-6">
        <button
          type="button"
          onClick={onGenerate}
          className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium hover:bg-indigo-500"
        >
          Generate scenario
        </button>
        <button
          type="button"
          onClick={onLoadDemo}
          title="Generate the curated demo scenario and jump to planning"
          className="rounded-md border border-slate-700 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
        >
          Load demo
        </button>
      </div>
      <p className="-mt-4 text-xs text-slate-500">
        The demo uses a fixed seed for a reproducible walkthrough: multiple
        trips, side-door loading, mixed cargo and a deferred item.
      </p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      {children}
    </div>
  )
}
