// Memoized route plan + slide paths for the delivery simulation. All real math
// lives in deliveryTimeline.ts / loadingTimeline.ts; this caches it per
// (trip, scenario, items) so the useFrame driver allocates nothing.

import { useMemo } from 'react'
import type { DeliveryTrip, Scenario } from '@/types'
import type { CargoRenderItem } from '../CargoLayer/cargoModel'
import {
  blockerStagingSlot,
  buildRoutePlan,
  stopDuration,
  type RoutePlan,
} from './deliveryTimeline'
import { buildItemPath, type ItemPath, type Vec3Tuple } from './loadingTimeline'

export type DeliveryTimeline = {
  plan: RoutePlan
  /** Per stop: cargoId → dog-leg path through the door that op slides through. */
  pathsByStop: Map<string, ItemPath>[]
  /** Per stop: blocker cargoId → its parked position outside the door. */
  blockerSlotsByStop: Map<string, Vec3Tuple>[]
  /** Per stop: choreography length in seconds at speed 1. */
  durations: number[]
  /** cargoId → the stop index (0-based) it is delivered at, for visibility. */
  deliveredAtStop: Map<string, number>
}

export function useDeliveryTimeline(
  trip: DeliveryTrip,
  scenario: Scenario,
  items: readonly CargoRenderItem[],
): DeliveryTimeline {
  return useMemo(() => {
    const itemById = new Map(items.map((i) => [i.cargoId, i]))
    const plan = buildRoutePlan(trip, scenario)

    const pathsByStop: Map<string, ItemPath>[] = []
    const blockerSlotsByStop: Map<string, Vec3Tuple>[] = []
    const durations: number[] = []
    const deliveredAtStop = new Map<string, number>()

    plan.stops.forEach((stop, stopIndex) => {
      const paths = new Map<string, ItemPath>()
      const slots = new Map<string, Vec3Tuple>()
      for (const op of stop.ops) {
        const item = itemById.get(op.cargoId)
        if (!item || paths.has(op.cargoId)) continue
        paths.set(op.cargoId, buildItemPath(item, scenario.vehicle, op.door))
      }
      stop.blockerIds.forEach((id, slot) => {
        const path = paths.get(id)
        if (!path) return
        const door = stop.ops.find((op) => op.cargoId === id)?.door ?? 'rear'
        slots.set(id, blockerStagingSlot(path.staging, door, slot))
      })
      for (const id of stop.deliverIds) deliveredAtStop.set(id, stopIndex)

      pathsByStop.push(paths)
      blockerSlotsByStop.push(slots)
      durations.push(stopDuration(stop))
    })

    return { plan, pathsByStop, blockerSlotsByStop, durations, deliveredAtStop }
  }, [trip, scenario, items])
}
