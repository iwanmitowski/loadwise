import { buildScenarioVehicle } from '@/features/vehicles/vehicles'
import { createRng, type Rng } from '@/utils/rng'
import type {
  CargoCategory,
  CargoItem,
  DoorSide,
  Scenario,
  ScenarioConfig,
  Shop,
  ShopType,
} from '@/types'
import {
  MAX_SHOP_COUNT,
  MIN_SHOP_COUNT,
  NAME_POOLS,
  SHOP_PROFILES,
  SHOP_TYPES,
  SIDE_DOOR_PREFERENCE,
  ZERO_CARGO_CHANCE,
  type MixEntry,
  type ShopProfile,
} from './profiles'

/**
 * Build a fully-resolved {@link Scenario} from a {@link ScenarioConfig}.
 *
 * Pure and deterministic: a single {@link Rng} is created from `config.seed` and
 * threaded through generation in a **fixed call order**, so the same config
 * always yields a deep-equal scenario. The order below is load-bearing — any
 * reordering of the rng calls changes the output stream:
 *
 *   1. shuffle `[1..n]` → each shop's delivery order
 *   2. per shop, in id order shop-1..shop-n:
 *        a. type      (uniform pick)
 *        b. name      (prefix + suffix pick, deduped)
 *        c. door      (side-door chance vs rear)
 *        d. cargo     (zero-chance roll, then quantity, then one pick per unit)
 */
export function generateScenario(config: ScenarioConfig): Scenario {
  const rng = createRng(config.seed)
  const n = clamp(config.shopCount, MIN_SHOP_COUNT, MAX_SHOP_COUNT)

  const deliveryOrders = rng.shuffle(range(1, n))

  const usedNames = new Set<string>()
  const shops: Shop[] = []
  for (let i = 0; i < n; i++) {
    const id = `shop-${i + 1}`
    const type = rng.pick(SHOP_TYPES)
    const name = pickName(rng, type, usedNames)
    const preferredDoor = pickDoor(rng, config.sideDoor)
    const requestedCargo = generateCargo(rng, SHOP_PROFILES[type], id)
    shops.push({
      id,
      name,
      type,
      deliveryOrder: deliveryOrders[i],
      preferredDoor,
      requestedCargo,
    })
  }

  return {
    config,
    vehicle: buildScenarioVehicle(config.vehicleId, config.sideDoor),
    shops,
  }
}

/** Inclusive integer range `[from, to]`. */
function range(from: number, to: number): number[] {
  const out: number[] = []
  for (let v = from; v <= to; v++) out.push(v)
  return out
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Pick a unique shop name from the type's pool, deduped with " 2", " 3", …. */
function pickName(rng: Rng, type: ShopType, used: Set<string>): string {
  const pool = NAME_POOLS[type]
  const base = `${rng.pick(pool.prefixes)} ${rng.pick(pool.suffixes)}`
  let name = base
  let suffix = 2
  while (used.has(name)) {
    name = `${base} ${suffix}`
    suffix++
  }
  used.add(name)
  return name
}

/**
 * Preferred door for a shop. With no side door on the vehicle it is always the
 * rear; otherwise the side door is preferred with {@link SIDE_DOOR_PREFERENCE}.
 */
function pickDoor(rng: Rng, sideDoor: ScenarioConfig['sideDoor']): DoorSide {
  if (sideDoor === 'none') return 'rear'
  return rng.chance(SIDE_DOOR_PREFERENCE) ? sideDoor : 'rear'
}

/** Requested cargo for one shop: zero-cargo edge case, else a weighted mix. */
function generateCargo(rng: Rng, profile: ShopProfile, shopId: string): CargoItem[] {
  if (rng.chance(ZERO_CARGO_CHANCE)) return []
  const qty = rng.int(profile.qtyMin, profile.qtyMax)
  const items: CargoItem[] = []
  for (let k = 1; k <= qty; k++) {
    items.push({
      id: `${shopId}-c${k}`,
      templateId: weightedPick(rng, profile.mix),
      shopId,
    })
  }
  return items
}

/** Pick a template id by weight. Mix weights sum to 1, so we sample in [0, 1). */
function weightedPick(rng: Rng, mix: MixEntry[]): CargoCategory {
  let r = rng.next()
  for (const entry of mix) {
    r -= entry.weight
    if (r < 0) return entry.templateId
  }
  // Float rounding fallback: r landed exactly on the total.
  return mix[mix.length - 1].templateId
}
