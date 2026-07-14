import { describe, expect, it } from 'vitest'
import { SHOP_PALETTE, shopColor, shopColorById } from './shopColors'

describe('shopColor', () => {
  it('maps each index to its palette entry', () => {
    SHOP_PALETTE.forEach((color, i) => {
      expect(shopColor(i)).toBe(color)
    })
  })

  it('is deterministic — same index, same color', () => {
    expect(shopColor(3)).toBe(shopColor(3))
    expect(shopColor(0)).toBe('#4f9dde')
  })

  it('wraps indices beyond the palette length', () => {
    expect(shopColor(SHOP_PALETTE.length)).toBe(shopColor(0))
    expect(shopColor(-1)).toBe(shopColor(SHOP_PALETTE.length - 1))
  })
})

describe('shopColorById', () => {
  it('assigns colors by id-sorted position, independent of input order', () => {
    const ids = ['shop-3', 'shop-1', 'shop-2']
    expect(shopColorById('shop-1', ids)).toBe(shopColor(0))
    expect(shopColorById('shop-2', ids)).toBe(shopColor(1))
    expect(shopColorById('shop-3', ids)).toBe(shopColor(2))
    // Reordering the id list must not change any shop's color.
    const reordered = ['shop-1', 'shop-2', 'shop-3']
    expect(shopColorById('shop-2', reordered)).toBe(shopColorById('shop-2', ids))
  })

  it('falls back to index 0 for an unknown id', () => {
    expect(shopColorById('shop-9', ['shop-1'])).toBe(shopColor(0))
  })
})
