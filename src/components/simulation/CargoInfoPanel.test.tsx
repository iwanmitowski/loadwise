// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { demoResult, demoScenario } from '@/fixtures/demo'
import { useUiStore } from '@/state/uiStore'
import { CargoInfoPanel } from './CargoInfoPanel'

const trip = demoResult.trips[0]

afterEach(() => {
  cleanup()
  useUiStore.getState().setSelectedCargo(null)
})

describe('CargoInfoPanel', () => {
  it('renders nothing when no cargo is selected', () => {
    const { container } = render(
      <CargoInfoPanel trip={trip} scenario={demoScenario} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows metadata for the selected cargo', () => {
    useUiStore.getState().setSelectedCargo('shop-1-c1')
    render(<CargoInfoPanel trip={trip} scenario={demoScenario} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Standard pallet')).toBeInTheDocument()
    expect(screen.getByText('Metro Market')).toBeInTheDocument()
    expect(screen.getByText('350 kg')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument() // loading order
    expect(screen.getByText('Rear door')).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument() // stop number
  })

  it('flags fragile cargo', () => {
    useUiStore.getState().setSelectedCargo('shop-3-c3')
    render(<CargoInfoPanel trip={trip} scenario={demoScenario} />)
    expect(screen.getByText(/nothing stacked on top/)).toBeInTheDocument()
  })

  it('clears the selection when the close button is clicked', () => {
    useUiStore.getState().setSelectedCargo('shop-1-c1')
    render(<CargoInfoPanel trip={trip} scenario={demoScenario} />)

    fireEvent.click(screen.getByLabelText('Clear selection'))
    expect(useUiStore.getState().selectedCargoId).toBeNull()
  })
})
