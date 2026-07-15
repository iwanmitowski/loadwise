import { describe, expect, it } from 'vitest'
import { demoResult, demoScenario } from '@/fixtures/demo'
import type { OptimizationResult } from '@/types'
import { fmtPctSafe } from '@/utils/format'
import {
  buildPlacementTripNumbers,
  buildTemplateNames,
  destinationLabel,
  REASON_LABEL,
  scoreBand,
  warningSeverity,
} from './reportView'

describe('buildTemplateNames', () => {
  it('maps every requested cargo id to its template name', () => {
    const names = buildTemplateNames(demoScenario)
    expect(names.get('shop-1-c1')).toBe('Standard pallet')
    expect(names.get('shop-2-c1')).toBe('Beverage pallet')
    expect(names.get('shop-3-c3')).toBe('Fragile box')
    // Deferred item still has a name (it was requested).
    expect(names.get('shop-2-c4')).toBe('Beverage pallet')
  })
})

describe('destination trip derivation', () => {
  it('reports the placing trip number, else "not placed"', () => {
    const twoTrip: OptimizationResult = {
      ...demoResult,
      trips: [
        demoResult.trips[0],
        {
          ...demoResult.trips[0],
          id: 'trip-2',
          tripNumber: 2,
          placements: [
            {
              cargoId: 'shop-2-c4',
              tripId: 'trip-2',
              position: { x: 0, y: 0, z: 0 },
              rotationY: 0,
              loadingOrder: 1,
              assignedDoor: 'rear',
            },
          ],
        },
      ],
    }
    const byCargo = buildPlacementTripNumbers(twoTrip)
    expect(destinationLabel('shop-2-c4', byCargo)).toBe('→ Trip 2')
    expect(destinationLabel('shop-1-c1', byCargo)).toBe('→ Trip 1')

    const single = buildPlacementTripNumbers(demoResult)
    expect(destinationLabel('shop-2-c4', single)).toBe('not placed')
  })
})

describe('label + severity maps', () => {
  it('has a plain-language label for every reason', () => {
    expect(REASON_LABEL['exceeds-vehicle-dimensions']).toBe('Too large for vehicle')
    expect(REASON_LABEL['no-valid-placement']).toBe('No valid position found')
  })

  it('marks hard-failure warnings as errors, the rest as warn', () => {
    expect(warningSeverity('unplaceable-cargo')).toBe('error')
    expect(warningSeverity('empty-trip')).toBe('error')
    expect(warningSeverity('time-limit')).toBe('error')
    expect(warningSeverity('deferred-cargo')).toBe('warn')
    expect(warningSeverity('shop-split')).toBe('warn')
    expect(warningSeverity('imbalance')).toBe('warn')
  })

  it('bands the score red/amber/green', () => {
    expect(scoreBand(0)).toBe('low')
    expect(scoreBand(49)).toBe('low')
    expect(scoreBand(50)).toBe('mid')
    expect(scoreBand(74)).toBe('mid')
    expect(scoreBand(75)).toBe('high')
    expect(scoreBand(100)).toBe('high')
  })
})

describe('fmtPctSafe', () => {
  it('formats finite ratios and dashes non-finite ones', () => {
    expect(fmtPctSafe(0.834)).toBe('83%')
    expect(fmtPctSafe(1)).toBe('100%')
    expect(fmtPctSafe(NaN)).toBe('—')
    expect(fmtPctSafe(Infinity)).toBe('—')
    expect(fmtPctSafe(0 / 0)).toBe('—')
  })
})
