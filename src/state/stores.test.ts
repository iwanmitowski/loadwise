import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeOptimizerClient } from '@/test/fakeOptimizerClient'
import { useScenarioStore } from './scenarioStore'
import { setOptimizerClient, useOptimizationStore } from './optimizationStore'
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

describe('optimizationStore.run (fake worker client)', () => {
  beforeEach(() => {
    setOptimizerClient(createFakeOptimizerClient())
    vi.useFakeTimers()
  })
  afterEach(() => {
    setOptimizerClient(null)
    vi.useRealTimers()
  })

  it('runs to done and exposes a result + selected trip', async () => {
    useScenarioStore.getState().setConfig({ seed: 'run-seed' })
    useScenarioStore.getState().generate()
    const scenario = useScenarioStore.getState().scenario!

    useOptimizationStore.getState().run(scenario)
    expect(useOptimizationStore.getState().status).toBe('running')
    expect(useOptimizationStore.getState().progress).not.toBeNull()

    await vi.runAllTimersAsync()

    const opt = useOptimizationStore.getState()
    expect(opt.status).toBe('done')
    expect(opt.result).not.toBeNull()
    expect(opt.result!.seed).toBe('run-seed')
    // selectedTripId defaults to the first trip when a result arrives.
    expect(useUiStore.getState().selectedTripId).toBe(opt.result!.trips[0]!.id)
  })

  it('cancel rejects the in-flight run without flipping back to done', async () => {
    const scenario = (useScenarioStore.getState().generate(),
    useScenarioStore.getState().scenario!)
    useOptimizationStore.getState().run(scenario)
    useOptimizationStore.getState().cancel()
    expect(useOptimizationStore.getState().status).toBe('cancelled')

    await vi.runAllTimersAsync()
    // The cancelled run must not complete and overwrite the status.
    expect(useOptimizationStore.getState().status).toBe('cancelled')
    expect(useOptimizationStore.getState().result).toBeNull()
  })

  it('a second run supersedes the first; only the latest result lands', async () => {
    // Build both scenarios first — generate() itself resets the optimization
    // store, and this test wants two back-to-back run() calls.
    useScenarioStore.getState().setConfig({ seed: 'first' })
    useScenarioStore.getState().generate()
    const scenario1 = useScenarioStore.getState().scenario!
    useScenarioStore.getState().setConfig({ seed: 'second' })
    useScenarioStore.getState().generate()
    const scenario2 = useScenarioStore.getState().scenario!

    useOptimizationStore.getState().run(scenario1)
    useOptimizationStore.getState().run(scenario2)

    await vi.runAllTimersAsync()

    const opt = useOptimizationStore.getState()
    expect(opt.status).toBe('done')
    expect(opt.result!.seed).toBe('second')
  })

  it('reset returns to idle', () => {
    useOptimizationStore.setState({ status: 'done', result: {} as never })
    useOptimizationStore.getState().reset()
    const opt = useOptimizationStore.getState()
    expect(opt.status).toBe('idle')
    expect(opt.result).toBeNull()
  })
})
