// Geometry & constraint validation — the correctness heart of LoadWise.
// `validateCandidate` is the allocation-light fast path the placement heuristic
// (T06) calls thousands of times. `validateLoad` is the full re-check the report
// (T08) and tests run over a finished trip. Both return every violation found
// (ordered cheapest check first) so callers can use `.length === 0` for "valid".

import { getTemplate, itemDimensions } from '@/features/cargo/templates'
import type {
  CargoPlacement,
  CargoTemplate,
  OptimizerConfig,
  Scenario,
  VehicleDefinition,
} from '@/types'
import {
  fitsThroughDoor,
  boxesOverlap,
  insideVehicle,
  toPlacedBox,
  type PlacedBox,
} from './geometry'
import { overloadBreaches, supportLoads } from './axles'
import { computeSupport, directLoadOnSupporter } from './support'

export type ConstraintViolation = {
  code:
    | 'out-of-bounds'
    | 'overlap'
    | 'over-payload'
    | 'insufficient-support'
    | 'floor-only-violated'
    | 'unstackable-support'
    | 'support-overweight'
    | 'axle-overload'
    | 'door-fit'
  cargoId: string
  detail: string
}

/**
 * Validate one candidate box against the already-placed boxes. Checks run
 * cheapest-first (bounds → overlap → payload → support chain) but none short-
 * circuit: every violation found is returned. Upright orientation needs no check
 * — rotationY only swaps width/depth, height is invariant (see prompt rule 9).
 *
 * Door fit is intentionally NOT checked here: door assignment is T06's job and
 * this is the hot path. `validateLoad` is the self-check that catches a bad
 * assignment after the fact.
 */
export function validateCandidate(
  candidate: PlacedBox,
  placed: PlacedBox[],
  vehicle: VehicleDefinition,
  config: OptimizerConfig,
  currentWeightKg: number,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  const template = getTemplate(candidate.templateId)

  // 1. Bounds
  if (!insideVehicle(candidate, vehicle.cargoSpace)) {
    violations.push({
      code: 'out-of-bounds',
      cargoId: candidate.cargoId,
      detail: 'Box extends outside the cargo space.',
    })
  }

  // 2. Overlap
  for (const p of placed) {
    if (boxesOverlap(candidate, p)) {
      violations.push({
        code: 'overlap',
        cargoId: candidate.cargoId,
        detail: `Overlaps placed cargo '${p.cargoId}'.`,
      })
    }
  }

  // 3. Payload
  if (currentWeightKg + candidate.weightKg > vehicle.maxPayloadKg) {
    violations.push({
      code: 'over-payload',
      cargoId: candidate.cargoId,
      detail: `Load ${currentWeightKg + candidate.weightKg}kg exceeds payload ${vehicle.maxPayloadKg}kg.`,
    })
  }

  // 3b. Axle maxima (planning estimate; only when the vehicle has axle data).
  // Sound at candidate time because per-item contributions superpose: a plated
  // max already breached mid-pack cannot be un-breached by placing more cargo
  // elsewhere. The min-share (steer/kingpin underload) rule is NOT checked here
  // — it is a ratio that legitimately moves both ways while packing, so it is
  // evaluated on drive states by the warnings layer instead.
  if (vehicle.axles) {
    const loads = supportLoads([...placed, candidate], vehicle.axles)
    for (const breach of overloadBreaches(loads, vehicle.axles)) {
      violations.push({
        code: 'axle-overload',
        cargoId: candidate.cargoId,
        detail: `${breach} (planning estimate).`,
      })
    }
  }

  // 4-7. Support chain
  violations.push(
    ...supportViolations(candidate, placed, config, template),
  )

  return violations
}

/** Rules 4-7: floor-only, minimum support, unstackable supporters, supporter overload. */
function supportViolations(
  box: PlacedBox,
  placed: PlacedBox[],
  config: OptimizerConfig,
  template: CargoTemplate,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // 5. Floor-only
  if (template.floorOnly && box.min.y !== 0) {
    violations.push({
      code: 'floor-only-violated',
      cargoId: box.cargoId,
      detail: `${template.name} must rest on the floor (y=0), placed at y=${box.min.y}.`,
    })
  }

  const support = computeSupport(box, placed)

  // 4. Minimum support ratio
  if (support.ratio < config.supportThreshold) {
    violations.push({
      code: 'insufficient-support',
      cargoId: box.cargoId,
      detail: `Only ${(support.ratio * 100).toFixed(1)}% of the base is supported (needs ${(config.supportThreshold * 100).toFixed(0)}%).`,
    })
  }

  // 6 & 7. Per-supporter checks
  const withCandidate = [...placed, box]
  for (const supporterId of support.supporters) {
    const supporter = placed.find((p) => p.cargoId === supporterId)
    if (!supporter) continue
    const supporterTemplate = getTemplate(supporter.templateId)

    // 6. Unstackable supporter
    if (!supporterTemplate.stackable) {
      violations.push({
        code: 'unstackable-support',
        cargoId: box.cargoId,
        detail: `Cannot rest on '${supporterId}' (${supporterTemplate.name} is not stackable).`,
      })
    }

    // 7. Supporter weight limit (direct load only)
    const load = directLoadOnSupporter(supporter, withCandidate)
    if (load > supporterTemplate.maxSupportedWeightKg) {
      violations.push({
        code: 'support-overweight',
        cargoId: box.cargoId,
        detail: `Overloads '${supporterId}': ${load.toFixed(1)}kg on it exceeds its ${supporterTemplate.maxSupportedWeightKg}kg limit.`,
      })
    }
  }

  return violations
}

/**
 * Full re-check of a finished trip's placements. Re-runs every geometry and
 * constraint rule over the whole placement list, plus checks that door assignment
 * is honoured (rule 8) and that no cargoId is placed twice (idea.md edge case
 * "Two cargo items receive overlapping positions"). Empty array ⇒ the trip is valid.
 */
export function validateLoad(
  placements: CargoPlacement[],
  scenario: Scenario,
  config: OptimizerConfig,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  const vehicle = scenario.vehicle
  const templateByCargoId = new Map<string, CargoTemplate>()
  for (const shop of scenario.shops) {
    for (const item of shop.requestedCargo) {
      templateByCargoId.set(item.id, getTemplate(item.templateId))
    }
  }

  // Duplicate cargoIds: the same physical item placed in two spots. Reported
  // under 'overlap' (no dedicated code in the contract) with an explicit detail.
  const seen = new Set<string>()
  for (const p of placements) {
    if (seen.has(p.cargoId)) {
      violations.push({
        code: 'overlap',
        cargoId: p.cargoId,
        detail: `Cargo '${p.cargoId}' is placed more than once.`,
      })
    }
    seen.add(p.cargoId)
  }

  // Resolve boxes (skip any placement whose cargo the scenario never requested).
  const boxes: PlacedBox[] = []
  const doorByCargoId = new Map<string, CargoPlacement>()
  for (const p of placements) {
    const template = templateByCargoId.get(p.cargoId)
    if (!template) continue
    boxes.push(toPlacedBox(p, template))
    doorByCargoId.set(p.cargoId, p)
  }

  // 1. Bounds
  for (const box of boxes) {
    if (!insideVehicle(box, vehicle.cargoSpace)) {
      violations.push({
        code: 'out-of-bounds',
        cargoId: box.cargoId,
        detail: 'Box extends outside the cargo space.',
      })
    }
  }

  // 2. Overlap — every unordered pair once.
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesOverlap(boxes[i], boxes[j])) {
        violations.push({
          code: 'overlap',
          cargoId: boxes[j].cargoId,
          detail: `Overlaps '${boxes[i].cargoId}'.`,
        })
      }
    }
  }

  // 3. Payload — a single load-level violation.
  const totalWeight = boxes.reduce((sum, b) => sum + b.weightKg, 0)
  if (totalWeight > vehicle.maxPayloadKg) {
    violations.push({
      code: 'over-payload',
      cargoId: '',
      detail: `Total load ${totalWeight}kg exceeds payload ${vehicle.maxPayloadKg}kg.`,
    })
  }

  // 3b. Axle maxima at departure (planning estimate). Underload (min-share) is
  // a warning-layer concern, not a violation — see validateCandidate.
  if (vehicle.axles) {
    const loads = supportLoads(boxes, vehicle.axles)
    for (const breach of overloadBreaches(loads, vehicle.axles)) {
      violations.push({
        code: 'axle-overload',
        cargoId: '',
        detail: `${breach} (planning estimate).`,
      })
    }
  }

  // 4-7. Support chain, each box against all the others.
  for (const box of boxes) {
    const others = boxes.filter((b) => b.cargoId !== box.cargoId)
    violations.push(
      ...supportViolations(box, others, config, getTemplate(box.templateId)),
    )
  }

  // 8. Door fit — each item must pass its assigned door in at least one rotation.
  for (const box of boxes) {
    const placement = doorByCargoId.get(box.cargoId)!
    const door = vehicle.doors.find((d) => d.side === placement.assignedDoor)
    if (!door) {
      violations.push({
        code: 'door-fit',
        cargoId: box.cargoId,
        detail: `Assigned door '${placement.assignedDoor}' is not present on the vehicle.`,
      })
      continue
    }
    const template = getTemplate(box.templateId)
    const fits =
      fitsThroughDoor(itemDimensions(template, 0), door) ||
      fitsThroughDoor(itemDimensions(template, 90), door)
    if (!fits) {
      violations.push({
        code: 'door-fit',
        cargoId: box.cargoId,
        detail: `${template.name} does not fit through the ${door.side} door in any rotation.`,
      })
    }
  }

  return violations
}
