import { describe, expect, it } from 'vitest'
import { getTemplate, itemDimensions } from '@/features/cargo/templates'
import { buildScenarioVehicle, getVehicle } from '@/features/vehicles/vehicles'
import { demoResult, demoScenario } from '@/fixtures/demo'
import type { CargoCategory, CargoPlacement, Scenario, Vec3 } from '@/types'
import type { PlacedBox } from './geometry'
import { DEFAULT_OPTIMIZER_CONFIG as CFG } from './config'
import { validateCandidate, validateLoad } from './validate'

const truck = getVehicle('box-truck') // 240 × 230 × 620, payload 5000

/** Build a real-template box; weight defaults to the template's own weight. */
function place(
  cargoId: string,
  templateId: CargoCategory,
  min: Vec3,
  rotationY: 0 | 90 = 0,
  weightKg?: number,
): PlacedBox {
  const template = getTemplate(templateId)
  return {
    cargoId,
    templateId,
    min,
    size: itemDimensions(template, rotationY),
    weightKg: weightKg ?? template.weightKg,
  }
}

const codes = (vs: { code: string }[]) => vs.map((v) => v.code)

describe('validateCandidate', () => {
  it('rule 1 bounds — poking through a wall vs flush inside', () => {
    const bad = place('c', 'standard-pallet', { x: 200, y: 0, z: 0 })
    expect(codes(validateCandidate(bad, [], truck, CFG, 0))).toContain('out-of-bounds')
    const ok = place('c', 'standard-pallet', { x: 0, y: 0, z: 0 })
    expect(validateCandidate(ok, [], truck, CFG, 0)).toHaveLength(0)
  })

  it('rule 2 overlap — intersecting vs flush-abutting placed cargo', () => {
    const placed = [place('p', 'standard-pallet', { x: 0, y: 0, z: 0 })]
    const overlapping = place('c', 'medium-box', { x: 0, y: 0, z: 0 })
    expect(codes(validateCandidate(overlapping, placed, truck, CFG, 0))).toContain('overlap')
    // abut the pallet's far X face (x = 120): touching is not overlap
    const abutting = place('c', 'medium-box', { x: 120, y: 0, z: 0 })
    expect(validateCandidate(abutting, placed, truck, CFG, 0)).toHaveLength(0)
  })

  it('rule 3 payload — candidate that tips over vs stays under maxPayload', () => {
    const c = place('c', 'standard-pallet', { x: 0, y: 0, z: 0 }) // 350kg
    expect(codes(validateCandidate(c, [], truck, CFG, 4700))).toContain('over-payload')
    expect(validateCandidate(c, [], truck, CFG, 4600)).toHaveLength(0)
  })

  it('rule 4 support — floating vs floor-resting', () => {
    const floating = place('c', 'medium-box', { x: 0, y: 100, z: 0 })
    expect(codes(validateCandidate(floating, [], truck, CFG, 0))).toContain('insufficient-support')
    const grounded = place('c', 'medium-box', { x: 0, y: 0, z: 0 })
    expect(validateCandidate(grounded, [], truck, CFG, 0)).toHaveLength(0)
  })

  it('rule 5 floor-only — beverage pallet lifted off the floor vs on it', () => {
    const support = [place('p', 'standard-pallet', { x: 0, y: 0, z: 0 })] // top y=150
    const lifted = place('c', 'beverage-pallet', { x: 0, y: 150, z: 0 })
    expect(codes(validateCandidate(lifted, support, truck, CFG, 0))).toContain('floor-only-violated')
    const grounded = place('c', 'beverage-pallet', { x: 0, y: 0, z: 0 })
    expect(validateCandidate(grounded, [], truck, CFG, 0)).toHaveLength(0)
  })

  it('rule 6 unstackable supporter — resting on a beverage pallet vs a standard pallet', () => {
    const onBeverage = [place('p', 'beverage-pallet', { x: 0, y: 0, z: 0 })] // top y=160, stackable:false
    const boxed = place('c', 'large-box', { x: 0, y: 160, z: 0 })
    expect(codes(validateCandidate(boxed, onBeverage, truck, CFG, 0))).toContain('unstackable-support')
    const onStandard = [place('p', 'standard-pallet', { x: 0, y: 0, z: 0 })] // top y=150, stackable:true
    const boxed2 = place('c', 'large-box', { x: 0, y: 150, z: 0 })
    expect(validateCandidate(boxed2, onStandard, truck, CFG, 0)).toHaveLength(0)
  })

  it('rule 7 supporter weight — full load exceeds vs meets the supporter limit', () => {
    const supporter = [place('p', 'large-box', { x: 0, y: 0, z: 0 })] // top y=60, limit 80kg, stackable
    // Same footprint on top, full support; synthetic weight isolates the check.
    const tooHeavy = place('c', 'large-box', { x: 0, y: 60, z: 0 }, 0, 100)
    expect(codes(validateCandidate(tooHeavy, supporter, truck, CFG, 0))).toContain('support-overweight')
    const atLimit = place('c', 'large-box', { x: 0, y: 60, z: 0 }, 0, 80)
    expect(validateCandidate(atLimit, supporter, truck, CFG, 0)).toHaveLength(0)
  })
})

describe('validateLoad', () => {
  it('passes the T03 demo fixture cleanly', () => {
    const violations = validateLoad(demoResult.trips[0].placements, demoScenario, CFG)
    expect(violations).toEqual([])
  })

  it('flags a cargoId placed more than once', () => {
    const placements = demoResult.trips[0].placements
    const dup = [...placements, { ...placements[0] }]
    const violations = validateLoad(dup, demoScenario, CFG)
    expect(violations.some((v) => v.detail.includes('placed more than once'))).toBe(true)
  })

  it('flags a box placed out of bounds', () => {
    const placements = demoResult.trips[0].placements.map((p, i) =>
      i === 0 ? { ...p, position: { ...p.position, z: 600 } } : p,
    )
    // shop-1-c1 (depth 80) now runs z 600..680, past the 620 wall.
    const violations = validateLoad(placements, demoScenario, CFG)
    expect(codes(violations)).toContain('out-of-bounds')
  })

  it('rule 8 door fit — beverage pallet fails the van side door, passes its rear door', () => {
    const vanScenario: Scenario = {
      config: { seed: 't', vehicleId: 'cargo-van', sideDoor: 'left', shopCount: 1 },
      vehicle: buildScenarioVehicle('cargo-van', 'left'),
      shops: [
        {
          id: 'shop-1',
          name: 'Depot',
          type: 'beverage-store',
          deliveryOrder: 1,
          preferredDoor: 'left',
          requestedCargo: [
            { id: 'shop-1-c1', templateId: 'beverage-pallet', shopId: 'shop-1' },
          ],
        },
      ],
    }
    const base: CargoPlacement = {
      cargoId: 'shop-1-c1',
      tripId: 'trip-1',
      position: { x: 0, y: 0, z: 0 },
      rotationY: 0,
      loadingOrder: 1,
      assignedDoor: 'left',
    }
    expect(codes(validateLoad([base], vanScenario, CFG))).toContain('door-fit')
    const viaRear = [{ ...base, assignedDoor: 'rear' as const }]
    expect(validateLoad(viaRear, vanScenario, CFG)).toEqual([])
  })
})
