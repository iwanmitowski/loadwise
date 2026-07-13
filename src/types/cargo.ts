import type { Dimensions } from './geometry'

export type CargoCategory =
  | 'standard-pallet'
  | 'beverage-pallet'
  | 'beverage-stack'
  | 'large-box'
  | 'medium-box'
  | 'fragile-box'

/**
 * A cargo archetype. `stackable: false` ⇒ nothing may rest on top of this item.
 * `floorOnly: true` ⇒ item must rest at y=0. `maxSupportedWeightKg` = max total
 * weight resting directly on top (no transitive propagation in MVP).
 */
export type CargoTemplate = {
  id: CargoCategory
  name: string
  category: CargoCategory
  dimensions: Dimensions
  weightKg: number
  stackable: boolean
  maxSupportedWeightKg: number
  floorOnly: boolean
  mustStayUpright: boolean
}

/** A concrete cargo unit requested by a shop. */
export type CargoItem = {
  id: string
  templateId: CargoCategory
  shopId: string
}
