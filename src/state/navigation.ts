import type { Screen } from './uiStore'

/** Ordered screens for the stepper. */
export const SCREEN_ORDER: Screen[] = [
  'setup',
  'planning',
  'simulation',
  'report',
]

export type NavContext = {
  hasScenario: boolean
  hasResult: boolean
}

/**
 * Whether a stepper screen is reachable given current progress.
 * Pure so the gating rules are unit-testable without rendering the header.
 *  - setup: always
 *  - planning: needs a generated scenario
 *  - simulation / report: need an optimization result
 */
export function isScreenEnabled(screen: Screen, ctx: NavContext): boolean {
  switch (screen) {
    case 'setup':
      return true
    case 'planning':
      return ctx.hasScenario
    case 'simulation':
    case 'report':
      return ctx.hasResult
  }
}
