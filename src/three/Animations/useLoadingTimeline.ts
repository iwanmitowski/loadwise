// Hook that memoizes the per-item flight paths + timeline length for one trip's
// render items. Pure-ish: all real math lives in loadingTimeline.ts; this only
// caches it per (items, vehicle) so the useFrame driver does zero allocation.

import { useMemo } from 'react'
import type { VehicleDefinition } from '@/types'
import type { CargoRenderItem } from '../CargoLayer/cargoModel'
import {
  buildItemPath,
  itemObstacle,
  timelineDuration,
  type ItemPath,
  type Obstacle,
} from './loadingTimeline'

export type LoadingTimeline = {
  /** Flight path per item, aligned with `items` (already loadingOrder-sorted). */
  paths: ItemPath[]
  /** Timeline length in seconds at speed 1. */
  duration: number
}

export function useLoadingTimeline(
  items: readonly CargoRenderItem[],
  vehicle: VehicleDefinition,
): LoadingTimeline {
  return useMemo(() => {
    // Item k flies while items 0..k-1 already sit at their final placements
    // (flights never overlap: DUR < STEP) — those are its solid obstacles.
    const placedSoFar: Obstacle[] = []
    const paths = items.map((item) => {
      const path = buildItemPath(item, vehicle, item.assignedDoor, placedSoFar)
      placedSoFar.push(itemObstacle(item))
      return path
    })
    return { paths, duration: timelineDuration(items.length) }
  }, [items, vehicle])
}
