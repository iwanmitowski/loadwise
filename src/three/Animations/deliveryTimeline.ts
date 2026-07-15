// Pure route/op-list math for the delivery simulation (T15). No React, no
// Three — unit-testable in the node environment, exactly like loadingTimeline.
//
// A route is simulated stop by stop. For each stop, the choreography is a flat,
// deterministic op list executed on one per-stop clock:
//
//   door-open (0.6s) → highlight (0.6s)
//   → move-blocker-out × B   (later-stop items in the way slide out the door)
//   → deliver × D            (this stop's cargo slides out, closest-first)
//   → return-blocker × B     (blockers slide back, reverse order)
//   → door-close (0.6s)
//
// Blocker detection reuses `findBlockers` (T06) filtered to later-stop items —
// the SAME rule T08's metrics use, so this module's `extraMovesTotal` always
// equals the report's `extraUnloadingMoves`.

import { getTemplate } from '@/features/cargo/templates'
import { findBlockers } from '@/features/optimizer/accessibility'
import { toPlacedBox, type PlacedBox } from '@/features/optimizer/geometry'
import type {
  DeliveryTrip,
  DoorSide,
  Scenario,
  VehicleDefinition,
  VehicleDoor,
} from '@/types'
import type { Vec3Tuple } from './loadingTimeline'

/** Seconds per choreography phase and per op, at speed 1. */
export const DELIVERY_PHASE_S = 0.6

export type DeliveryOpType = 'move-blocker-out' | 'deliver' | 'return-blocker'

export type DeliveryOp = {
  type: DeliveryOpType
  cargoId: string
  /** Door this op's slide passes through (the item's own assigned door). */
  door: DoorSide
}

export type StopPlan = {
  stopNumber: number
  shopId: string
  /** The stop's assigned door (held open for the whole stop). */
  door: DoorSide
  /** cargoIds delivered at this stop, in unload order (closest to door first). */
  deliverIds: string[]
  /**
   * Distinct later-stop items that must temporarily move to reach this stop's
   * cargo, in move-out order (closest to the door first, tiebreak id). One
   * entry here = one "extra unloading move" — same rule as T08's metrics.
   */
  blockerIds: string[]
  ops: DeliveryOp[]
}

export type RoutePlan = {
  stops: StopPlan[]
  /** Σ blockerIds.length — must equal the trip metric `extraUnloadingMoves`. */
  extraMovesTotal: number
}

/** Distance (cm) from a box to the wall its exit door sits on, along the exit axis. */
export function distanceToDoor(
  box: PlacedBox,
  door: VehicleDoor,
  vehicle: VehicleDefinition,
): number {
  if (door.side === 'rear') return box.min.z
  if (door.side === 'left') return box.min.x
  return vehicle.cargoSpace.width - (box.min.x + box.size.width)
}

/**
 * Build the full deterministic route plan for one trip. Walks stops in stop
 * order, maintaining the set of boxes still in the truck (delivered items
 * leave; blockers return). Same seed/trip in ⇒ identical plan out.
 */
export function buildRoutePlan(trip: DeliveryTrip, scenario: Scenario): RoutePlan {
  const { vehicle } = scenario
  const doorBySide = new Map(vehicle.doors.map((d) => [d.side, d]))
  const cargoById = new Map(
    scenario.shops.flatMap((s) => s.requestedCargo.map((c) => [c.id, c] as const)),
  )
  const shopByCargo = new Map(
    scenario.shops.flatMap((s) => s.requestedCargo.map((c) => [c.id, s.id] as const)),
  )
  const stopByShop = new Map(trip.stops.map((s) => [s.shopId, s.stopNumber]))
  const stopOf = (cargoId: string): number | undefined => {
    const shopId = shopByCargo.get(cargoId)
    return shopId === undefined ? undefined : stopByShop.get(shopId)
  }

  const doorOf = new Map<string, VehicleDoor>()
  let remaining: PlacedBox[] = []
  for (const placement of trip.placements) {
    const cargo = cargoById.get(placement.cargoId)
    if (!cargo) continue
    const door =
      doorBySide.get(placement.assignedDoor) ?? doorBySide.get('rear') ?? vehicle.doors[0]
    doorOf.set(placement.cargoId, door)
    remaining.push(toPlacedBox(placement, getTemplate(cargo.templateId)))
  }

  const stops = [...trip.stops].sort((a, b) => a.stopNumber - b.stopNumber)
  const plans: StopPlan[] = []
  let extraMovesTotal = 0

  for (const stop of stops) {
    const stopBoxes = remaining.filter((b) => stopOf(b.cargoId) === stop.stopNumber)
    const byDistance = (a: PlacedBox, b: PlacedBox): number => {
      const da = distanceToDoor(a, doorOf.get(a.cargoId)!, vehicle)
      const db = distanceToDoor(b, doorOf.get(b.cargoId)!, vehicle)
      return da - db || (a.cargoId < b.cargoId ? -1 : 1)
    }

    const deliverBoxes = [...stopBoxes].sort(byDistance)

    // Distinct later-stop blockers across all of this stop's targets. Each
    // blocker exits through the door of the first target it blocks.
    const blockerDoor = new Map<string, DoorSide>()
    for (const target of deliverBoxes) {
      const door = doorOf.get(target.cargoId)!
      for (const id of findBlockers(target, door, remaining)) {
        const s = stopOf(id)
        if (s !== undefined && s > stop.stopNumber && !blockerDoor.has(id)) {
          blockerDoor.set(id, door.side)
        }
      }
    }
    const boxById = new Map(remaining.map((b) => [b.cargoId, b]))
    const blockerBoxes = [...blockerDoor.keys()].map((id) => boxById.get(id)!).sort(byDistance)

    const deliverIds = deliverBoxes.map((b) => b.cargoId)
    const blockerIds = blockerBoxes.map((b) => b.cargoId)
    const ops: DeliveryOp[] = [
      ...blockerIds.map<DeliveryOp>((id) => ({
        type: 'move-blocker-out',
        cargoId: id,
        door: blockerDoor.get(id)!,
      })),
      ...deliverBoxes.map<DeliveryOp>((b) => ({
        type: 'deliver',
        cargoId: b.cargoId,
        door: doorOf.get(b.cargoId)!.side,
      })),
      ...[...blockerIds].reverse().map<DeliveryOp>((id) => ({
        type: 'return-blocker',
        cargoId: id,
        door: blockerDoor.get(id)!,
      })),
    ]

    extraMovesTotal += blockerIds.length
    plans.push({
      stopNumber: stop.stopNumber,
      shopId: stop.shopId,
      door: stop.door,
      deliverIds,
      blockerIds,
      ops,
    })

    remaining = remaining.filter((b) => stopOf(b.cargoId) !== stop.stopNumber)
  }

  return { stops: plans, extraMovesTotal }
}

// ---------------------------------------------------------------------------
// Per-stop clock
// ---------------------------------------------------------------------------

export type StopPhase = 'door-open' | 'highlight' | 'op' | 'door-close' | 'done'

export type StopState = {
  phase: StopPhase
  /** Index into plan.ops while phase is 'op', else null. */
  opIndex: number | null
  /** 0..1 progress through the active op (0 outside 'op' phase). */
  opProgress: number
  /** Whether the stop's door should currently be held open. */
  doorOpen: boolean
}

/** Full length of one stop's choreography in seconds at speed 1. */
export function stopDuration(plan: StopPlan): number {
  return DELIVERY_PHASE_S * (3 + plan.ops.length)
}

/** Choreography state of one stop at local time t (seconds, speed applied by caller). */
export function stopStateAt(t: number, plan: StopPlan): StopState {
  const opsStart = 2 * DELIVERY_PHASE_S
  const closeStart = opsStart + plan.ops.length * DELIVERY_PHASE_S
  const end = closeStart + DELIVERY_PHASE_S

  if (t < DELIVERY_PHASE_S) {
    return { phase: 'door-open', opIndex: null, opProgress: 0, doorOpen: true }
  }
  if (t < opsStart) {
    return { phase: 'highlight', opIndex: null, opProgress: 0, doorOpen: true }
  }
  if (t < closeStart) {
    const opIndex = Math.min(
      plan.ops.length - 1,
      Math.floor((t - opsStart) / DELIVERY_PHASE_S),
    )
    const opProgress = (t - opsStart - opIndex * DELIVERY_PHASE_S) / DELIVERY_PHASE_S
    return { phase: 'op', opIndex, opProgress, doorOpen: true }
  }
  if (t < end) {
    return { phase: 'door-close', opIndex: null, opProgress: 0, doorOpen: false }
  }
  return { phase: 'done', opIndex: null, opProgress: 0, doorOpen: false }
}

/**
 * Whether `cargoId` has already been handed off at the current playback moment,
 * i.e. it is no longer aboard the truck. This is the single source of truth for
 * both the box's visibility and whether it still counts toward the load's
 * balance point:
 *   - delivered at an earlier stop, or
 *   - delivered at this stop and the stop's choreography is done, or
 *   - delivered at this stop and its own `deliver` op already completed.
 * A box is still considered aboard while its own delivery slide is in progress
 * (it counts until fully handed off).
 */
export function itemDeliveredNow(
  cargoId: string,
  stopIndex: number,
  state: StopState,
  stop: StopPlan | undefined,
  deliveredAtStop: ReadonlyMap<string, number>,
): boolean {
  const deliveredAt = deliveredAtStop.get(cargoId)
  if (deliveredAt === undefined) return false
  if (deliveredAt < stopIndex) return true
  if (deliveredAt > stopIndex) return false
  // Delivered at exactly this stop: gone once its deliver op has completed.
  if (state.phase === 'done' || state.phase === 'door-close') return true
  const opsSoFar =
    state.phase === 'op' && state.opIndex !== null ? (stop?.ops.slice(0, state.opIndex) ?? []) : []
  return opsSoFar.some((op) => op.type === 'deliver' && op.cargoId === cargoId)
}

// ---------------------------------------------------------------------------
// Blocker staging slots
// ---------------------------------------------------------------------------

/**
 * Where blocker `slot` (0-based, in move-out order) parks outside its door:
 * the item's normal staging point shifted along the door's wall axis in an
 * alternating fan (+0.9m, −0.9m, +1.8m, …) so parked blockers never overlap
 * each other or the delivery slide path through the door centre.
 */
export function blockerStagingSlot(
  staging: Vec3Tuple,
  door: DoorSide,
  slot: number,
): Vec3Tuple {
  const step = 0.9 * (Math.floor(slot / 2) + 1) * (slot % 2 === 0 ? 1 : -1)
  return door === 'rear'
    ? [staging[0] + step, staging[1], staging[2]]
    : [staging[0], staging[1], staging[2] + step]
}
