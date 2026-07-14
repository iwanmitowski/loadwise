import { describe, expect, it } from 'vitest'
import { fmtDims, fmtKg, fmtM, fmtM3, fmtPct } from './format'

describe('format helpers', () => {
  it('fmtM converts cm to metres with 1 decimal', () => {
    expect(fmtM(620)).toBe('6.2 m')
    expect(fmtM(180)).toBe('1.8 m')
    expect(fmtM(248)).toBe('2.5 m')
    expect(fmtM(0)).toBe('0.0 m')
  })

  it('fmtKg rounds and adds thousands separators', () => {
    expect(fmtKg(5000)).toBe('5,000 kg')
    expect(fmtKg(24000)).toBe('24,000 kg')
    expect(fmtKg(1234567)).toBe('1,234,567 kg')
    expect(fmtKg(42.6)).toBe('43 kg')
    expect(fmtKg(0)).toBe('0 kg')
  })

  it('fmtPct rounds a ratio to whole percent and may exceed 100%', () => {
    expect(fmtPct(0.834)).toBe('83%')
    expect(fmtPct(0)).toBe('0%')
    expect(fmtPct(1)).toBe('100%')
    expect(fmtPct(1.4)).toBe('140%')
  })

  it('fmtM3 converts cm³ to m³ with 2 decimals', () => {
    expect(fmtM3(340_000)).toBe('0.34 m³')
    expect(fmtM3(34_224_000)).toBe('34.22 m³')
    expect(fmtM3(0)).toBe('0.00 m³')
  })

  it('fmtDims renders W × H × D in metres', () => {
    expect(fmtDims({ width: 240, height: 230, depth: 620 })).toBe(
      '2.4 × 2.3 × 6.2 m',
    )
  })
})
