// Axle-load estimation — static beam equilibrium per
// docs/deep-research-cargo-loading.md §Weight distribution and docs/physics.md.
//
// Everything here is a PLANNING ESTIMATE built on invented-but-plausible axle
// geometry (see vehicles.ts): useful to steer placement and to warn, never a
// legal compliance check. All positions are cargo-space Z in cm (z=0 rear door,
// +z toward cabin); axles may sit outside [0, depth].
//
// The key property the optimizer relies on: per-item axle contributions are
// LINEAR and position-fixed (superposition). A contribution can be negative —
// an item behind the rear axle UNLOADS the front axle (rear-overhang lever) —
// which is exactly the steering-axle hazard the physics doc describes.
//
// Pure, deterministic, no React/Three — runs in the optimizer worker hot loop.

import type { AxleModel, RigidAxleModel, SemiAxleModel } from '@/types'
import type { PlacedBox } from './geometry'

/** Loads on the two support points, kg. `a` = front axle / kingpin, `b` = rear axle / trailer axle group. */
export type SupportLoads = {
  kind: AxleModel['kind']
  aKg: number
  bKg: number
  totalKg: number
}

/** One item's (possibly negative) contribution to the two supports, kg. */
export function itemSupportDelta(
  zCm: number,
  weightKg: number,
  model: AxleModel,
): { aKg: number; bKg: number } {
  if (model.kind === 'rigid') {
    const wb = model.frontAxleZ - model.rearAxleZ
    const bKg = (weightKg * (model.frontAxleZ - zCm)) / wb
    return { aKg: weightKg - bKg, bKg }
  }
  const lk = model.kingpinZ - model.axleGroupZ
  const bKg = (weightKg * (model.kingpinZ - zCm)) / lk
  return { aKg: weightKg - bKg, bKg }
}

/** Empty-vehicle support loads for a model. */
export function emptySupportLoads(model: AxleModel): SupportLoads {
  const aKg = model.kind === 'rigid' ? model.emptyFrontKg : model.emptyKingpinKg
  const bKg = model.kind === 'rigid' ? model.emptyRearKg : model.emptyAxleGroupKg
  return { kind: model.kind, aKg, bKg, totalKg: aKg + bKg }
}

/** Support loads of the loaded vehicle: empty loads + every box's contribution. */
export function supportLoads(boxes: readonly PlacedBox[], model: AxleModel): SupportLoads {
  const empty = emptySupportLoads(model)
  let aKg = empty.aKg
  let bKg = empty.bKg
  for (const box of boxes) {
    const z = box.min.z + box.size.depth / 2
    const d = itemSupportDelta(z, box.weightKg, model)
    aKg += d.aKg
    bKg += d.bKg
  }
  return { kind: model.kind, aKg, bKg, totalKg: aKg + bKg }
}

function maxima(model: AxleModel): { maxA: number; maxB: number } {
  return model.kind === 'rigid'
    ? { maxA: model.maxFrontKg, maxB: model.maxRearKg }
    : { maxA: model.maxKingpinKg, maxB: model.maxAxleGroupKg }
}

function minShareA(model: AxleModel): number {
  return model.kind === 'rigid'
    ? (model as RigidAxleModel).minSteerShare
    : (model as SemiAxleModel).minKingpinShare
}

const SUPPORT_NAMES: Record<AxleModel['kind'], { a: string; b: string }> = {
  rigid: { a: 'front axle', b: 'rear axle' },
  semi: { a: 'kingpin', b: 'trailer axle group' },
}

/**
 * Human-readable over-maximum breaches for a load state ([] = within limits).
 * Because contributions superpose, an overload found mid-pack can only persist
 * or worsen as more cargo is added in the same region — which is what makes
 * candidate-time hard rejection sound for maxima (unlike the min-share rule,
 * whose ratio moves both ways during packing and is checked on drive states).
 */
export function overloadBreaches(loads: SupportLoads, model: AxleModel): string[] {
  const { maxA, maxB } = maxima(model)
  const names = SUPPORT_NAMES[model.kind]
  const out: string[] = []
  if (loads.aKg > maxA) {
    out.push(`${names.a} ${Math.round(loads.aKg)}kg exceeds ${maxA}kg`)
  }
  if (loads.bKg > maxB) {
    out.push(`${names.b} ${Math.round(loads.bKg)}kg exceeds ${maxB}kg`)
  }
  return out
}

/**
 * Steering-axle / kingpin underload check on a DRIVE state (departure or after
 * a stop): too little share on the front support degrades steering or
 * fifth-wheel grip. Null when fine.
 */
export function underloadBreach(loads: SupportLoads, model: AxleModel): string | null {
  if (loads.totalKg <= 0) return null
  const share = loads.aKg / loads.totalKg
  const min = minShareA(model)
  if (share >= min) return null
  const names = SUPPORT_NAMES[model.kind]
  return `${names.a} carries ${Math.round(share * 100)}% of total weight (min ${Math.round(min * 100)}%)`
}

/**
 * Placement-quality score 0..1 for a load state: how far both supports stay
 * inside their envelope (min margin to a plated max), scaled down when the
 * front share drops toward the underload floor. Deterministic, cheap, and
 * comparable across candidates of equal weight — the placement heuristic uses
 * it in place of the blind mid-bay/front CoG target when axle data exists.
 * Rewards MARGIN, so a lighter/more-forward candidate always outranks — the
 * right signal for choosing among placements, but NOT for grading a finished
 * load (see `axleComplianceScore`).
 */
export function axleScore(loads: SupportLoads, model: AxleModel): number {
  const { maxA, maxB } = maxima(model)
  const margin = Math.min(1 - loads.aKg / maxA, 1 - loads.bKg / maxB)
  const marginScore = Math.max(0, Math.min(1, margin))
  const share = loads.totalKg <= 0 ? 1 : loads.aKg / loads.totalKg
  const guard = Math.max(0, Math.min(1, share / minShareA(model)))
  return marginScore * (0.5 + 0.5 * guard)
}

/**
 * Report-quality compliance score 0..1 for a finished load: full marks while
 * BOTH supports sit comfortably within their plated maxima and the steer/
 * kingpin share is healthy; falls off only as an axle nears (≥90%) or exceeds
 * its limit, or the front share drops below its minimum. Unlike `axleScore`,
 * using a lot of legal axle capacity is NOT penalised — a truck loaded to 70%
 * of its rear-axle limit is a good plan, not a mediocre one. This is what the
 * overall score should reward (docs/physics.md — compliance, not empty axles).
 */
export function axleComplianceScore(loads: SupportLoads, model: AxleModel): number {
  const { maxA, maxB } = maxima(model)
  const worstUse = Math.max(loads.aKg / maxA, loads.bKg / maxB)
  // Full marks up to 90% of the plated max; linear to 0 at 110% (over-limit).
  const envelope = worstUse <= 0.9 ? 1 : Math.max(0, Math.min(1, (1.1 - worstUse) / 0.2))
  const share = loads.totalKg <= 0 ? 1 : loads.aKg / loads.totalKg
  const min = minShareA(model)
  const steer = share >= min ? 1 : Math.max(0, Math.min(1, share / min))
  return envelope * steer
}
