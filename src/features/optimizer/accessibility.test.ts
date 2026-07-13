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

  it('left door — a box at smaller x with overlapping Z/Y blocks', () => {
    const target = box('t', 'medium-box', { x: 120, y: 0, z: 0 })
    const inside = box('i', 'medium-box', { x: 0, y: 0, z: 0 }) // smaller x, same z/y
    const beside = box('s', 'medium-box', { x: 0, y: 0, z: 200 }) // smaller x but Z disjoint
    expect(findBlockers(target, leftDoor, [inside, beside])).toEqual(['i'])
  })

  it('right door — mirror of left: a box at larger x blocks', () => {
    const target = box('t', 'medium-box', { x: 0, y: 0, z: 0 })
    const outside = box('o', 'medium-box', { x: 120, y: 0, z: 0 }) // larger x, same z/y
    expect(findBlockers(target, rightDoor, [outside])).toEqual(['o'])
  })

  it('returns cargoIds sorted and ignores the target itself', () => {
    const target = box('t', 'medium-box', { x: 0, y: 0, z: 300 })
    const b2 = box('b2', 'medium-box', { x: 0, y: 0, z: 100 })
    const b1 = box('b1', 'medium-box', { x: 0, y: 0, z: 200 })
    expect(findBlockers(target, rearDoor, [target, b2, b1])).toEqual(['b1', 'b2'])
  })
})
