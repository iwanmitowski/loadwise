import type { CargoItem } from './cargo'
import type { DoorSide } from './vehicle'

export type ShopType =
  | 'supermarket'
  | 'beverage-store'
  | 'electronics-store'
  | 'general-store'
  | 'warehouse'

export type Shop = {
  id: string
  name: string
  type: ShopType
  deliveryOrder: number
  preferredDoor: DoorSide
  requestedCargo: CargoItem[]
}
