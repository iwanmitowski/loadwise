import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScenarioStore } from './scenarioStore'
import { useOptimizationStore } from './optimizationStore'
import { useUiStore } from './uiStore'

// These stores are module singletons; reset them to a known baseline per test.
function resetStores() {
  useUiStore.getState().resetForNewScenario()
  useOptimizationStore.getState().reset()
  useScenarioStore.setState({ config: useScenarioStore.getState().config, scenario: null })
}

beforeEach(resetStores)

describe('scenarioStore.generate', () => {
  it('populates the scenario from config', () => {
    useScenarioStore.getState().setConfig({ shopCount: 4, seed: 'test-seed' })
    useScenarioStore.getState().generate()

    const { scenario } = useScenarioStore.getState()
    expect(scenario).not.toBeNull()
    expect(scenario!.config.seed).toBe('test-seed')
    expect(scenario!.shops.length).toBe(4)
  })

  it('is deterministic for the same config', () => {
    useScenarioStore.getState().setConfig({ seed: 'same' })
    useScenarioStore.getState().generate()
    const first = useScenarioStore.getState().scenario
    useScenarioStore.getState().generate()
    const second = useScenarioStore.getState().scenario
    expect(second).toEqual(first)
  })

  it('resets optimization + ui selections (generate → reset chain)', () => {
    // Dirty the other stores first.
    useOptimizationStore.setState({
      status: 'done',
      result: { seed: 'x' } as never,
    })
    useUiStore.getState().setSelectedTrip('trip-1')
    useUiStore.getState().setShopFilter('shop-1')
    useUiStore.getState().goTo('report')

    useScenarioStore.getState().generate()

    const opt = useOptimizationStore.getState()
    expect(opt.status).toBe('idle')
    expect(opt.result).toBeNull()

    const ui = useUiStore.getState()
    expect(ui.selectedTripId).toBeNull()
    expect(ui.shopFilter).toBeNull()
    expect(ui.screen).toBe('setup')
  })
})

describe('optimizationStore.run (fixture scaffold)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('runs to done and exposes a result + selected trip', () => {
    useScenarioStore.getState().setConfig({ seed: 'run-seed' })
    useScenarioStore.getState().generate()
    const scenario = useScenarioStore.getState().scenario!

    useOptimizationStore.getState().run(scenario)
    expect(useOptimizationStore.getState().status).toBe('running')

    vi.runAllTimers()

    const opt = useOptimizationStore.getState()
    expect(opt.status).toBe('done')
    expect(opt.result).not.toBeNull()
    expect(opt.result!.seed).toBe('run-seed')
    // selectedTripId defaults to the first trip when a result arrives.
    expect(useUiStore.getState().selectedTripId).toBe(opt.result!.trips[0]!.id)
  })

  it('cancel prevents a stale timer from completing', () => {
    const scenario = (useScenarioStore.getState().generate(),
    useScenarioStore.getState().scenario!)
    useOptimizationStore.getState().run(scenario)
    useOptimizationStore.getState().cancel()
    expect(useOptimizationStore.getState().status).toBe('cancelled')

    vi.runAllTimers()
    // The pending timer must not flip a cancelled run back to done.
    expect(useOptimizationStore.getState().status).toBe('cancelled')
    expect(useOptimizationStore.getState().result).toBeNull()
  })

  it('reset returns to idle', () => {
    useOptimizationStore.setState({ status: 'done', result: {} as never })
    useOptimizationStore.getState().reset()
    const opt = useOptimizationStore.getState()
    expect(opt.status).toBe('idle')
    expect(opt.result).toBeNull()
  })
})
