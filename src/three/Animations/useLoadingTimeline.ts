// Hook that memoizes the per-item flight paths + timeline length for one trip's
// render items. Pure-ish: all real math lives in loadingTimeline.ts; this only
// caches it per (items, vehicle) so the useFrame driver does zero allocation.

import { useMemo } from 'react'
import type { VehicleDefinition } from '@/types'
import type { CargoRenderItem } from '../CargoLayer/cargoModel'
import { buildItemPath, timelineDuration, type ItemPath } from './loadingTimeline'

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
  return useMemo(
    () => ({
      paths: items.map((item) => buildItemPath(item, vehicle)),
      duration: timelineDuration(items.length),
    }),
    [items, vehicle],
  )
}
