// Shared shop color palette. The 3D scene, the legend, and any per-shop UI all
// derive a shop's color from the same function so colors stay consistent.
//
// The color for a shop is a function of its *index* — the position of the shop
// when shops are sorted by id. Callers compute that index once (see
// `shopColorById`) and pass it here; the mapping is deterministic and stable.

/**
 * Fixed 8-color palette: distinct hues, readable on the dark app background.
 * Order is load-bearing — index 0 → first palette entry, and so on.
 */
export const SHOP_PALETTE = [
  '#4f9dde', // blue
  '#e8843a', // orange
  '#58b978', // green
  '#d95f8c', // pink
  '#8f7ee0', // purple
  '#d9b13b', // gold
  '#4fc2c9', // teal
  '#a86f4f', // brown
] as const

/** Color for the shop at `index` (index = position in id-sorted shop list). */
export function shopColor(index: number): string {
  // Wrap so any index is safe; scenarios are capped at 8 shops so real inputs
  // never wrap, but demo/test data and future growth stay well-defined.
  const i = ((index % SHOP_PALETTE.length) + SHOP_PALETTE.length) % SHOP_PALETTE.length
  return SHOP_PALETTE[i]
}

/**
 * Resolve a shop's color from its id given the full set of shop ids. Sorts ids
 * (stable, string order) and uses the sorted position as the palette index, so
 * two callers holding the same shop set always agree on colors.
 */
export function shopColorById(shopId: string, allShopIds: readonly string[]): string {
  const sorted = [...allShopIds].sort()
  const index = sorted.indexOf(shopId)
  return shopColor(index < 0 ? 0 : index)
}
