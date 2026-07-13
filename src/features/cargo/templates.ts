import type { CargoCategory, CargoTemplate, Dimensions } from '@/types'

const TEMPLATES: Record<CargoCategory, CargoTemplate> = {
  'standard-pallet': {
    id: 'standard-pallet',
    name: 'Standard pallet',
    category: 'standard-pallet',
    dimensions: { width: 120, height: 150, depth: 80 },
    weightKg: 350,
    stackable: true,
    maxSupportedWeightKg: 400,
    floorOnly: false,
    mustStayUpright: true,
  },
  'beverage-pallet': {
    id: 'beverage-pallet',
    name: 'Beverage pallet',
    category: 'beverage-pallet',
    dimensions: { width: 120, height: 160, depth: 80 },
    weightKg: 600,
    stackable: false,
    maxSupportedWeightKg: 0,
    floorOnly: true,
    mustStayUpright: true,
  },
  'beverage-stack': {
    id: 'beverage-stack',
    name: 'Crate stack',
    category: 'beverage-stack',
    dimensions: { width: 40, height: 105, depth: 30 },
    weightKg: 45,
    stackable: false,
    maxSupportedWeightKg: 0,
    floorOnly: false,
    mustStayUpright: true,
  },
  'large-box': {
    id: 'large-box',
    name: 'Large box',
    category: 'large-box',
    dimensions: { width: 80, height: 60, depth: 60 },
    weightKg: 40,
    stackable: true,
    maxSupportedWeightKg: 80,
    floorOnly: false,
    mustStayUpright: true,
  },
  'medium-box': {
    id: 'medium-box',
    name: 'Medium box',
    category: 'medium-box',
    dimensions: { width: 60, height: 40, depth: 40 },
    weightKg: 20,
    stackable: true,
    maxSupportedWeightKg: 40,
    floorOnly: false,
    mustStayUpright: true,
  },
  'fragile-box': {
    id: 'fragile-box',
    name: 'Fragile box',
    category: 'fragile-box',
    dimensions: { width: 50, height: 40, depth: 40 },
    weightKg: 12,
    stackable: false,
    maxSupportedWeightKg: 0,
    floorOnly: false,
    mustStayUpright: true,
  },
}

export function getTemplate(id: CargoCategory): CargoTemplate {
  return TEMPLATES[id]
}

/**
 * Footprint of a template at a given rotation. `rotationY: 90` swaps width and
 * depth; height is unchanged (cargo stays upright).
 */
export function itemDimensions(
  template: CargoTemplate,
  rotationY: 0 | 90,
): Dimensions {
  const { width, height, depth } = template.dimensions
  return rotationY === 90
    ? { width: depth, height, depth: width }
    : { width, height, depth }
}

/** Volume of a template in cm³ (rotation-independent). */
export function itemVolume(template: CargoTemplate): number {
  const { width, height, depth } = template.dimensions
  return width * height * depth
}

export const CARGO_CATEGORIES: CargoCategory[] = [
  'standard-pallet',
  'beverage-pallet',
  'beverage-stack',
  'large-box',
  'medium-box',
  'fragile-box',
]
