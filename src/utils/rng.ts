// Seeded, deterministic pseudo-random number generator.
// Foundation of seed replay: same seed ⇒ identical stream (see CLAUDE.md §Determinism).
// Implementation: xmur3 string hash → mulberry32 PRNG (well-known, tiny, deterministic).
// No Math.random anywhere.

export type Rng = {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [min, max], both ends inclusive. */
  int(min: number, max: number): number
  /** Uniformly pick one element. Throws on an empty array. */
  pick<T>(arr: readonly T[]): T
  /** New array containing a deterministic Fisher–Yates permutation of `arr`. */
  shuffle<T>(arr: readonly T[]): T[]
  /** `true` with probability `p` (clamped to [0, 1]). */
  chance(p: number): boolean
}

/** xmur3 string hash — produces a sequence of 32-bit seed values from a string. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

/** mulberry32 — 32-bit state PRNG returning floats in [0, 1). */
function mulberry32(seedInt: number): () => number {
  let a = seedInt >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createRng(seed: string): Rng {
  const seedGen = xmur3(seed)
  const next = mulberry32(seedGen())

  const rng: Rng = {
    next,
    int(min, max) {
      // Inclusive both ends. next() ∈ [0,1) ⇒ floor maps evenly across the range.
      return min + Math.floor(next() * (max - min + 1))
    },
    pick(arr) {
      if (arr.length === 0) throw new Error('rng.pick: cannot pick from an empty array')
      return arr[rng.int(0, arr.length - 1)]
    },
    shuffle(arr) {
      const out = arr.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = rng.int(0, i)
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
    chance(p) {
      return next() < p
    },
  }
  return rng
}
