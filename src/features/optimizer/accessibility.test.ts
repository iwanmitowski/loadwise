import { describe, expect, it } from 'vitest'
import { getTemplate, itemDimensions } from '@/features/cargo/templates'
import { getVehicle } from '@/features/vehicles/vehicles'
import type { CargoCategory, Vec3 } from '@/types'
import { findBlockers } from './accessibility'
import type { PlacedBox } from './geometry'

const vehicle = getVehicle('box-truck') // rear + both side doors
const rearDoor = vehicle.doors.find((d) => d.side === 'rear')!
const leftDoor = vehicle.doors.find((d) => d.side === 'left')!
const rightDoor = vehicle.doors.find((d) => d.side === 'right')!

function box(cargoId: string, templateId: CargoCategory, min: Vec3): PlacedBox {
  const template = getTemplate(templateId)
  return { cargoId, templateId, min, size: itemDimensions(template, 0), weightKg: template.weightKg }
}

describe('findBlockers', () => {
  it('rear door — a box nearer the door with overlapping X/Y blocks; a box beside does not', () => {
    const target = box('t', 'medium-box', { x: 0, y: 0, z: 200 })
    const inFront = box('f', 'medium-box', { x: 0, y: 0, z: 100 }) // lower z, same x/y column
    const beside = box('s', 'medium-box', { x: 120, y: 0, z: 100 }) // lower z but X disjoint
    const behind = box('b', 'medium-box', { x: 0, y: 0, z: 300 }) // higher z, not in the way
    expect(findBlockers(target, rearDoor, [inFront, beside, behind])).toEqual(['f'])
  })

  // Box-truck left/right doors open only at z∈[210,410] (position.z 210, width 200).
  it('left door — target in front of the opening: a smaller-x box at the same z blocks', () => {
    const target = box('t', 'medium-box', { x: 120, y: 0, z: 250 }) // z 250–290 ⊂ opening
    const inside = box('i', 'medium-box', { x: 0, y: 0, z: 250 }) // smaller x, same z/y
    const beside = box('s', 'medium-box', { x: 0, y: 0, z: 120 }) // smaller x but Z disjoint
    expect(findBlockers(target, leftDoor, [inside, beside])).toEqual(['i'])
  })

  it('left door — target BEHIND the opening: a smaller-x box at the target’s own z does NOT block', () => {
    // The target (z 460–500) sits past the opening (ends at z 410), so it never
    // slides straight out sideways there — it drives to the opening first. A box
    // to its left at its own z is not on that route. (This is the demo-1 bug:
    // shop-6-c1/c2 wrongly flagged as blocked by shop-2.)
    const target = box('t', 'medium-box', { x: 120, y: 0, z: 460 })
    const sideways = box('s', 'medium-box', { x: 0, y: 0, z: 460 }) // left of target, same z — behind door
    expect(findBlockers(target, leftDoor, [sideways])).toEqual([])
  })

  it('left door — target behind the opening: a box in the near-wall Z-corridor blocks', () => {
    // As the target drives −Z along its own x-lane toward the opening, a box in
    // that lane between it and the opening is a genuine blocker.
    const target = box('t', 'medium-box', { x: 120, y: 0, z: 460 }) // x 120–180, z 460–500
    const inLane = box('c', 'medium-box', { x: 120, y: 0, z: 410 }) // same x-lane, z 410–450 (toward opening)
    expect(findBlockers(target, leftDoor, [inLane])).toEqual(['c'])
  })

  it('right door — mirror of left: a larger-x box at the same z within the opening blocks', () => {
    const target = box('t', 'medium-box', { x: 0, y: 0, z: 250 })
    const outside = box('o', 'medium-box', { x: 120, y: 0, z: 250 }) // larger x, same z/y
    expect(findBlockers(target, rightDoor, [outside])).toEqual(['o'])
  })

  it('returns cargoIds sorted and ignores the target itself', () => {
    const target = box('t', 'medium-box', { x: 0, y: 0, z: 300 })
    const b2 = box('b2', 'medium-box', { x: 0, y: 0, z: 100 })
    const b1 = box('b1', 'medium-box', { x: 0, y: 0, z: 200 })
    expect(findBlockers(target, rearDoor, [target, b2, b1])).toEqual(['b1', 'b2'])
  })
})
