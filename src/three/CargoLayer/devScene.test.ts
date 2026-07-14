import { describe, expect, it } from 'vitest'
import { buildCargoRenderItems } from './cargoModel'
import { buildSyntheticScene } from './devScene'

describe('buildSyntheticScene', () => {
  it('is deterministic for the same count', () => {
    expect(buildSyntheticScene(50)).toEqual(buildSyntheticScene(50))
  })

  it('packs a full 100-item trip that resolves to 100 in-bounds render items', () => {
    const { scenario, trip } = buildSyntheticScene(100)
    expect(trip.placements).toHaveLength(100)

    const items = buildCargoRenderItems(trip, scenario)
    expect(items).toHaveLength(100)

    const space = scenario.vehicle.cargoSpace
    for (const item of items) {
      expect(item.min.x + item.size.width).toBeLessThanOrEqual(space.width)
      expect(item.min.z + item.size.depth).toBeLessThanOrEqual(space.depth)
    }
  })

  it('includes rotated (90°) placements with swapped footprints', () => {
    const { scenario, trip } = buildSyntheticScene(100)
    const rotated = trip.placements.filter((p) => p.rotationY === 90)
    expect(rotated.length).toBeGreaterThan(0)

    // Every rotated medium-box (60×40×40) must render as 40 wide / 60 deep.
    const items = buildCargoRenderItems(trip, scenario)
    const rotatedMedium = items.find(
      (i) => i.templateId === 'medium-box' &&
        rotated.some((p) => p.cargoId === i.cargoId),
    )!
    expect(rotatedMedium.size).toEqual({ width: 40, height: 40, depth: 60 })
  })
})
