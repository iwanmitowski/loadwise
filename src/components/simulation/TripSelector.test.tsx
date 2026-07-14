// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TripSelector } from './TripSelector'
import { demoResult } from '@/fixtures/demo'
import { useUiStore } from '@/state/uiStore'
import type { DeliveryTrip } from '@/types'

const trip1 = demoResult.trips[0]
const trip2: DeliveryTrip = { ...trip1, id: 'trip-2', tripNumber: 2 }

beforeEach(() => useUiStore.getState().resetForNewScenario())
afterEach(cleanup)

describe('TripSelector', () => {
  it('renders a tab per trip with a micro-summary', () => {
    render(<TripSelector trips={[trip1, trip2]} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    // 3 stops · 9 units · <weight%> for the demo trip.
    expect(tabs[0]).toHaveTextContent('3 stops · 9 units')
  })

  it('selects a trip on click', () => {
    render(<TripSelector trips={[trip1, trip2]} />)
    fireEvent.click(screen.getByRole('tab', { name: /Trip 2/ }))
    expect(useUiStore.getState().selectedTripId).toBe('trip-2')
  })

  it('marks the active tab, falling back to the first when unselected', () => {
    render(<TripSelector trips={[trip1, trip2]} />)
    // Nothing selected yet → first tab reads active.
    expect(screen.getByRole('tab', { name: /Trip 1/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('renders nothing for an empty trip list', () => {
    const { container } = render(<TripSelector trips={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
