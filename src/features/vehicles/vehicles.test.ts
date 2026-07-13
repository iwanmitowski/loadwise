import { describe, expect, it } from 'vitest'
import { buildScenarioVehicle, getVehicle } from './vehicles'

describe('getVehicle', () => {
  it('returns all candidate doors (rear + both sides)', () => {
    const van = getVehicle('cargo-van')
    expect(van.doors.map((d) => d.side)).toEqual(['rear', 'left', 'right'])
    expect(van.cargoSpace).toEqual({ width: 180, height: 180, depth: 320 })
    expect(van.maxPayloadKg).toBe(1200)
  })

  it('centres the rear door on the z=0 wall along X', () => {
    const rear = getVehicle('box-truck').doors.find((d) => d.side === 'rear')!
    // (240 - 220) / 2 = 10
    expect(rear.position).toEqual({ x: 10, y: 0, z: 0 })
    expect(rear.width).toBe(220)
    expect(rear.height).toBe(210)
  })

  it('positions side doors on their wall with width along Z', () => {
    const truck = getVehicle('box-truck')
    const left = truck.doors.find((d) => d.side === 'left')!
    const right = truck.doors.find((d) => d.side === 'right')!
    expect(left.position).toEqual({ x: 0, y: 0, z: 210 })
    expect(right.position).toEqual({ x: 240, y: 0, z: 210 })
    expect(left.width).toBe(200)
  })
})

describe('buildScenarioVehicle', () => {
  it('keeps only the rear door when sideDoor is none', () => {
    const v = buildScenarioVehicle('semi-trailer', 'none')
    expect(v.doors.map((d) => d.side)).toEqual(['rear'])
  })

  it('adds the chosen side door', () => {
    const left = buildScenarioVehicle('semi-trailer', 'left')
    expect(left.doors.map((d) => d.side)).toEqual(['rear', 'left'])
    const right = buildScenarioVehicle('semi-trailer', 'right')
    expect(right.doors.map((d) => d.side)).toEqual(['rear', 'right'])
    expect(right.doors[1].position).toEqual({ x: 248, y: 0, z: 560 })
  })
})
