// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ScreenReport } from './ScreenReport'
import { demoResult, demoScenario } from '@/fixtures/demo'
import { useOptimizationStore } from '@/state/optimizationStore'
import { useScenarioStore } from '@/state/scenarioStore'
import { useUiStore } from '@/state/uiStore'
import type { DeliveryTrip, OptimizationResult, UnplacedCargo } from '@/types'

// downloadJson is a DOM side-effect helper — mock it and assert the call.
const downloadJson = vi.fn()
vi.mock('@/utils/download', () => ({
  downloadJson: (name: string, data: unknown) => downloadJson(name, data),
}))

const trip1 = demoResult.trips[0]

// A second trip that ultimately places the item trip 1 deferred (shop-2-c4),
// so the deferred table can resolve its destination as "→ Trip 2".
const trip2: DeliveryTrip = {
  id: 'trip-2',
  tripNumber: 2,
  stops: [{ shopId: 'shop-2', stopNumber: 1, door: 'rear' }],
  placements: [
    {
      cargoId: 'shop-2-c4',
      tripId: 'trip-2',
      position: { x: 0, y: 0, z: 0 },
      rotationY: 0,
      loadingOrder: 1,
      assignedDoor: 'rear',
    },
  ],
  deferredCargo: [],
  metrics: trip1.metrics,
}

const twoTripResult: OptimizationResult = {
  ...demoResult,
  trips: [trip1, trip2],
}

function renderReport(result: OptimizationResult = twoTripResult) {
  useScenarioStore.setState({ scenario: demoScenario })
  useOptimizationStore.setState({ status: 'done', result })
  useUiStore.getState().resetForNewScenario()
  useUiStore.getState().setSelectedTrip(result.trips[0].id)
  useUiStore.getState().goTo('report')
  return render(<ScreenReport />)
}

beforeEach(() => {
  downloadJson.mockClear()
  useOptimizationStore.getState().reset()
})
afterEach(cleanup)

describe('ScreenReport', () => {
  it('renders every metric label from idea.md’s display list', () => {
    renderReport()
    for (const label of [
      'Shops served',
      'Requested units',
      'Loaded units',
      'Deferred units',
      'Total weight',
      'Weight utilization',
      'Used volume',
      'Volume utilization',
      'Empty volume',
      'Left/right balance',
      'Load stability (axle/CoG)',
      'Blocked cargo',
      'Extra unloading moves',
      'Split shop orders',
      'Constraint violations',
      'Trip score',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('shows the overall header: vehicle, trips count, seed', () => {
    renderReport()
    expect(screen.getByText('Box truck')).toBeInTheDocument()
    expect(screen.getByText(/2 trips/)).toBeInTheDocument()
    expect(screen.getByText('demo')).toBeInTheDocument() // seed badge
  })

  it('renders warnings from the optimizer', () => {
    renderReport()
    expect(screen.getByText('1 item(s) moved to trip 2.')).toBeInTheDocument()
  })

  it('deferred table resolves the destination trip', () => {
    renderReport()
    // shop-2-c4 was deferred in trip 1 and placed in trip 2.
    expect(screen.getByText('→ Trip 2')).toBeInTheDocument()
    // Rendered by template name, not raw cargo id.
    expect(screen.getByText('Beverage pallet')).toBeInTheDocument()
  })

  it('shows "not placed" for a permanently deferred item', () => {
    renderReport(demoResult) // single trip; shop-2-c4 never lands anywhere
    expect(screen.getByText('not placed')).toBeInTheDocument()
  })

  it('shows the all-placed empty state when nothing is unplaceable', () => {
    renderReport()
    expect(screen.getByText('All cargo was placed.')).toBeInTheDocument()
  })

  it('renders unplaceable cargo with a reason chip and detail', () => {
    const unplaceable: UnplacedCargo = {
      cargoId: 'shop-1-c1',
      shopId: 'shop-1',
      reason: 'exceeds-vehicle-dimensions',
      permanent: true,
      detail: 'Item is taller than the cargo space.',
    }
    renderReport({ ...demoResult, unplaceableCargo: [unplaceable] })
    expect(screen.getByText('Too large for vehicle')).toBeInTheDocument()
    expect(screen.getByText('Item is taller than the cargo space.')).toBeInTheDocument()
  })

  it('export buttons call downloadJson with the scenario and result', () => {
    renderReport()

    fireEvent.click(screen.getByRole('button', { name: 'Scenario JSON' }))
    fireEvent.click(screen.getByRole('button', { name: 'Result JSON' }))

    expect(downloadJson).toHaveBeenCalledTimes(2)
    const [scenarioCall, resultCall] = downloadJson.mock.calls
    expect(scenarioCall[0]).toMatch(/scenario-demo\.json$/)
    expect(scenarioCall[1]).toBe(demoScenario)
    expect(resultCall[0]).toMatch(/result-demo\.json$/)
    expect(resultCall[1]).toBe(twoTripResult)

    // Exports round-trip cleanly through JSON (acceptance criterion).
    expect(() => JSON.parse(JSON.stringify(resultCall[1]))).not.toThrow()
  })

  it('switching trips updates the metric view via the TripSelector', () => {
    renderReport()
    fireEvent.click(screen.getByRole('tab', { name: /Trip 2/ }))
    expect(useUiStore.getState().selectedTripId).toBe('trip-2')
    expect(screen.getByText('Trip 2 metrics')).toBeInTheDocument()
  })

  it('falls back to a gated message with no result', () => {
    useScenarioStore.setState({ scenario: demoScenario })
    useOptimizationStore.setState({ status: 'idle', result: null })
    render(<ScreenReport />)
    expect(screen.getByText(/No optimization result yet/)).toBeInTheDocument()
  })
})
