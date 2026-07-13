import { describe, expect, it } from 'vitest'
import { isScreenEnabled } from './navigation'

describe('isScreenEnabled', () => {
  const none = { hasScenario: false, hasResult: false }
  const scenarioOnly = { hasScenario: true, hasResult: false }
  const withResult = { hasScenario: true, hasResult: true }

  it('always allows setup', () => {
    expect(isScreenEnabled('setup', none)).toBe(true)
  })

  it('gates planning behind a scenario', () => {
    expect(isScreenEnabled('planning', none)).toBe(false)
    expect(isScreenEnabled('planning', scenarioOnly)).toBe(true)
  })

  it('gates simulation and report behind a result', () => {
    for (const screen of ['simulation', 'report'] as const) {
      expect(isScreenEnabled(screen, scenarioOnly)).toBe(false)
      expect(isScreenEnabled(screen, withResult)).toBe(true)
    }
  })
})
