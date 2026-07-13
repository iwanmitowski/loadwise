import type { CargoCategory, ShopType } from '@/types'

// Scenario-generation reference data — table, not logic (see docs/prompts/T04).
// generate.ts reads these; it contains no per-shop-type branching.

/** All shop types, in the order used for the generator's uniform pick. */
export const SHOP_TYPES: ShopType[] = [
  'supermarket',
  'beverage-store',
  'electronics-store',
  'general-store',
  'warehouse',
]

/** One weighted entry in a shop type's cargo mix (weights are pick probabilities). */
export type MixEntry = { templateId: CargoCategory; weight: number }

/**
 * Per-shop-type cargo profile: inclusive quantity range and the weighted
 * template mix. Zero-weight templates from the spec table are omitted (they are
 * never picked). Weights within a mix sum to 1.
 */
export type ShopProfile = {
  qtyMin: number
  qtyMax: number
  mix: MixEntry[]
}

// Source: docs/prompts/T04 §Decisions already made — cargo quantity + mix table.
export const SHOP_PROFILES: Record<ShopType, ShopProfile> = {
  supermarket: {
    qtyMin: 4,
    qtyMax: 10,
    mix: [
      { templateId: 'standard-pallet', weight: 0.25 },
      { templateId: 'beverage-pallet', weight: 0.15 },
      { templateId: 'beverage-stack', weight: 0.15 },
      { templateId: 'large-box', weight: 0.15 },
      { templateId: 'medium-box', weight: 0.25 },
      { templateId: 'fragile-box', weight: 0.05 },
    ],
  },
  'beverage-store': {
    qtyMin: 3,
    qtyMax: 8,
    mix: [
      { templateId: 'standard-pallet', weight: 0.05 },
      { templateId: 'beverage-pallet', weight: 0.4 },
      { templateId: 'beverage-stack', weight: 0.4 },
      { templateId: 'medium-box', weight: 0.15 },
    ],
  },
  'electronics-store': {
    qtyMin: 2,
    qtyMax: 6,
    mix: [
      { templateId: 'standard-pallet', weight: 0.05 },
      { templateId: 'large-box', weight: 0.3 },
      { templateId: 'medium-box', weight: 0.25 },
      { templateId: 'fragile-box', weight: 0.4 },
    ],
  },
  'general-store': {
    qtyMin: 2,
    qtyMax: 8,
    mix: [
      { templateId: 'standard-pallet', weight: 0.15 },
      { templateId: 'beverage-stack', weight: 0.15 },
      { templateId: 'large-box', weight: 0.25 },
      { templateId: 'medium-box', weight: 0.35 },
      { templateId: 'fragile-box', weight: 0.1 },
    ],
  },
  warehouse: {
    qtyMin: 6,
    qtyMax: 14,
    mix: [
      { templateId: 'standard-pallet', weight: 0.4 },
      { templateId: 'beverage-pallet', weight: 0.1 },
      { templateId: 'large-box', weight: 0.3 },
      { templateId: 'medium-box', weight: 0.2 },
    ],
  },
}

/**
 * Shop-name pools per type: every prefix × suffix combination is a candidate
 * name. Collisions are deduplicated by the generator (" 2", " 3", …).
 */
export const NAME_POOLS: Record<ShopType, { prefixes: string[]; suffixes: string[] }> = {
  supermarket: {
    prefixes: ['Fresh', 'Metro', 'Daily', 'Family', 'Green'],
    suffixes: ['Market', 'Foods', 'Grocers'],
  },
  'beverage-store': {
    prefixes: ['Hop', 'Vine', 'Barrel', 'Spring'],
    suffixes: ['Cellar', 'Drinks', 'Beverages'],
  },
  'electronics-store': {
    prefixes: ['Volt', 'Pixel', 'Nova', 'Circuit'],
    suffixes: ['Hub', 'Electronics', 'Tech'],
  },
  'general-store': {
    prefixes: ['Corner', 'Central', 'Oak', 'Main'],
    suffixes: ['Store', 'Goods', 'Trading'],
  },
  warehouse: {
    prefixes: ['North', 'Prime', 'Cargo', 'East'],
    suffixes: ['Depot', 'Warehouse', 'Logistics'],
  },
}

/** shopCount is clamped to this inclusive range (UI enforces it too). */
export const MIN_SHOP_COUNT = 3
export const MAX_SHOP_COUNT = 8

/** Probability that the chosen side door is preferred over the rear door. */
export const SIDE_DOOR_PREFERENCE = 0.4

/** Probability that a shop requests zero cargo (edge case by design). */
export const ZERO_CARGO_CHANCE = 0.05
