// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ShopCard } from './ShopCard'
import type { Shop } from '@/types'

const baseShop: Shop = {
  id: 'shop-1',
  name: 'Metro Market',
  type: 'supermarket',
  deliveryOrder: 1,
  preferredDoor: 'left',
  requestedCargo: [
    { id: 'shop-1-c1', templateId: 'standard-pallet', shopId: 'shop-1' },
  ],
}

afterEach(cleanup)

describe('ShopCard pre-warning chip', () => {
  it('shows the amber chip when items cannot fit the vehicle', () => {
    render(<ShopCard shop={baseShop} color="#fff" unfittableCount={2} />)
    expect(screen.getByText(/2 items won’t fit this vehicle/)).toBeInTheDocument()
  })

  it('omits the chip when everything fits', () => {
    render(<ShopCard shop={baseShop} color="#fff" unfittableCount={0} />)
    expect(screen.queryByText(/won’t fit/)).not.toBeInTheDocument()
  })

  it('singularizes the chip for one item', () => {
    render(<ShopCard shop={baseShop} color="#fff" unfittableCount={1} />)
    expect(screen.getByText(/1 item won’t fit this vehicle/)).toBeInTheDocument()
  })
})

describe('ShopCard preferred-door fallback', () => {
  it('strikes through the preferred side door and shows → rear when unavailable', () => {
    // Vehicle has only the rear door → left preference falls back.
    render(<ShopCard shop={baseShop} color="#fff" vehicleDoorSides={['rear']} />)
    const struck = screen.getByText('left side door')
    expect(struck).toHaveClass('line-through')
    expect(screen.getByText('→ rear')).toBeInTheDocument()
  })

  it('shows the side door normally when the vehicle has it', () => {
    render(<ShopCard shop={baseShop} color="#fff" vehicleDoorSides={['rear', 'left']} />)
    expect(screen.getByText('left side door')).not.toHaveClass('line-through')
    expect(screen.queryByText('→ rear')).not.toBeInTheDocument()
  })

  it('renders rear-door shops plainly', () => {
    const rearShop: Shop = { ...baseShop, preferredDoor: 'rear' }
    render(<ShopCard shop={rearShop} color="#fff" vehicleDoorSides={['rear']} />)
    expect(screen.getByText('rear door')).toBeInTheDocument()
  })
})
