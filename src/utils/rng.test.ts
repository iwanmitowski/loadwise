import { describe, expect, it } from 'vitest'
import { createRng } from './rng'

describe('createRng determinism', () => {
  it('produces identical first 100 outputs for the same seed', () => {
    const a = createRng('loadwise')
    const b = createRng('loadwise')
    const seqA = Array.from({ length: 100 }, () => a.next())
    const seqB = Array.from({ length: 100 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('diverges for different seeds', () => {
    const a = createRng('seed-a')
    const b = createRng('seed-b')
    const seqA = Array.from({ length: 100 }, () => a.next())
    const seqB = Array.from({ length: 100 }, () => b.next())
    expect(seqA).not.toEqual(seqB)
  })
})

describe('next', () => {
  it('stays within [0, 1)', () => {
    const rng = createRng('bounds')
    for (let i = 0; i < 1000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('int', () => {
  it('is inclusive on both ends', () => {
    const rng = createRng('int-range')
    let sawMin = false
    let sawMax = false
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(1, 6)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
      expect(Number.isInteger(v)).toBe(true)
      if (v === 1) sawMin = true
      if (v === 6) sawMax = true
    }
    expect(sawMin).toBe(true)
    expect(sawMax).toBe(true)
  })

  it('returns the single value when min === max', () => {
    const rng = createRng('int-single')
    expect(rng.int(5, 5)).toBe(5)
  })
})

describe('pick', () => {
  it('returns an element of the array and is deterministic per seed', () => {
    const arr = ['a', 'b', 'c', 'd'] as const
    const a = createRng('pick')
    const b = createRng('pick')
    const picksA = Array.from({ length: 20 }, () => a.pick(arr))
    const picksB = Array.from({ length: 20 }, () => b.pick(arr))
    expect(picksA).toEqual(picksB)
    for (const p of picksA) expect(arr).toContain(p)
  })

  it('throws on an empty array', () => {
    expect(() => createRng('empty').pick([])).toThrow()
  })
})

describe('shuffle', () => {
  it('returns a new array (does not mutate the input)', () => {
    const input = [1, 2, 3, 4, 5]
    const snapshot = [...input]
    const out = createRng('shuffle').shuffle(input)
    expect(input).toEqual(snapshot)
    expect(out).not.toBe(input)
  })

  it('is a permutation of the input', () => {
    const input = Array.from({ length: 50 }, (_, i) => i)
    const out = createRng('perm').shuffle(input)
    expect([...out].sort((x, y) => x - y)).toEqual(input)
  })

  it('is deterministic per seed', () => {
    const input = Array.from({ length: 50 }, (_, i) => i)
    const a = createRng('shuffle-det').shuffle(input)
    const b = createRng('shuffle-det').shuffle(input)
    expect(a).toEqual(b)
  })
})

describe('chance', () => {
  it('is deterministic per seed', () => {
    const a = createRng('chance')
    const b = createRng('chance')
    const seqA = Array.from({ length: 100 }, () => a.chance(0.5))
    const seqB = Array.from({ length: 100 }, () => b.chance(0.5))
    expect(seqA).toEqual(seqB)
  })

  it('always false at p=0 and always true at p=1', () => {
    const rng = createRng('chance-edge')
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false)
      expect(rng.chance(1)).toBe(true)
    }
  })
})
