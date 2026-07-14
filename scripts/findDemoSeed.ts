/**
 * Dev-only seed finder for LoadWise demo mode (T17). NOT shipped, NOT part of
 * the test suite. Loops candidate seeds through the real scenario generator +
 * optimizer and prints the ones that satisfy every idea.md §Demo Mode criterion,
 * so demo mode can hard-code a seed that reliably shows the product off.
 *
 * Run (no repo dep on tsx — relative imports keep it alias-free):
 *
 *   npx tsx scripts/findDemoSeed.ts
 *
 * Fixed demo config is `{ vehicleId: 'box-truck', sideDoor: 'left', shopCount: 6 }`
 * (see src/fixtures/demoConfig.ts); only the seed varies.
 *
 * Criteria (all must hold for a "clean but interesting" demo):
 *   - ≥ 2 trips
 *   - ≥ 1 deferred item (moved to a later trip)
 *   - ≥ 1 shop unloaded through the side door
 *   - mixed cargo categories (≥ 4 distinct)
 *   - 0 permanently unplaceable items
 *
 * Relaxation order if nothing qualifies (documented in the prompt):
 *   mixed categories → side-door shop.
 */

import { generateScenario } from '../src/features/scenario/generate'
import { optimize } from '../src/features/optimizer/optimize'
import { DEFAULT_OPTIMIZER_CONFIG } from '../src/features/optimizer/config'
import type { ScenarioConfig } from '../src/types'

export type DemoChecks = {
  trips: number
  deferred: number
  sideDoorShops: number
  categories: number
  permanentUnplaceable: number
}

const BASE: Omit<ScenarioConfig, 'seed'> = {
  vehicleId: 'box-truck',
  sideDoor: 'left',
  shopCount: 6,
}

/** Run one seed and report the demo-relevant counts. */
export function evaluateSeed(seed: string): DemoChecks {
  const scenario = generateScenario({ ...BASE, seed })
  const result = optimize(scenario, DEFAULT_OPTIMIZER_CONFIG)

  const categories = new Set(
    scenario.shops.flatMap((s) => s.requestedCargo.map((c) => c.templateId)),
  )
  const deferred = result.trips.reduce((n, t) => n + t.deferredCargo.length, 0)
  const sideDoorShops = new Set(
    result.trips.flatMap((t) => t.stops.filter((s) => s.door !== 'rear').map((s) => s.shopId)),
  ).size

  return {
    trips: result.trips.length,
    deferred,
    sideDoorShops,
    categories: categories.size,
    permanentUnplaceable: result.unplaceableCargo.length,
  }
}

/** All criteria satisfied (strict). */
export function isCleanDemo(c: DemoChecks): boolean {
  return (
    c.trips >= 2 &&
    c.deferred >= 1 &&
    c.sideDoorShops >= 1 &&
    c.categories >= 4 &&
    c.permanentUnplaceable === 0
  )
}

/** Search `demo-1`..`demo-N`, returning every qualifying seed with its counts. */
export function findDemoSeeds(count = 3000): Array<{ seed: string; checks: DemoChecks }> {
  const hits: Array<{ seed: string; checks: DemoChecks }> = []
  for (let i = 1; i <= count; i++) {
    const seed = `demo-${i}`
    const checks = evaluateSeed(seed)
    if (isCleanDemo(checks)) hits.push({ seed, checks })
  }
  return hits
}

// Direct-run entry point (tsx / node --import). Guarded so importing this module
// (e.g. from a scratch test) doesn't kick off the search.
const isMain =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /findDemoSeed\.ts$/.test(process.argv[1] ?? '')

if (isMain) {
  const hits = findDemoSeeds()
  if (hits.length === 0) {
    console.log('No seed satisfied every criterion — relax (mixed categories, then side-door).')
  } else {
    console.log(`Found ${hits.length} clean demo seed(s). First 10:`)
    for (const h of hits.slice(0, 10)) {
      console.log(`  ${h.seed}  ${JSON.stringify(h.checks)}`)
    }
  }
}
