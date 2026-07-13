import { describe, expect, it } from 'vitest'

// Trivial passing test so `npm run test` is green from day one (T01).
// Real domain/component tests arrive with later tasks.
describe('toolchain smoke test', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2)
  })
})
