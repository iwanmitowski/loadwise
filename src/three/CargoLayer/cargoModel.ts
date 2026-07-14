// Presentation model for the cargo layer. Turns a trip's domain placements into
// render-ready items (scene-space centre + size, resolved shop colour, template
// + shop metadata, delivery context) so the R3F components stay declarative.
//
// This is the render layer, so it MAY import from features/ and units — but it
// is deliberately kept free of React/Three so the resolution and centre-of-mass
// maths are unit-testable in the node environment. Rendering conversion (cm→m)
// lives in units.ts and is the only place `* 0.01` happens.

import { getTemplate } from '@/features/cargo/templates'
import { toPlacedBox } from '@/features/optimizer/geometry'
import { shopColorById } from '@/utils/shopColors'
import type {
  CargoCategory,
  DeliveryTrip,
  Dimensions,
  DoorSide,
  Scenario,
  Vec3,
} from '@/types'
import { boxCenter, sizeToScene } from '../units'

/** One placement resolved to everything the scene + info panel need to draw it. */
export type CargoRenderItem = {
  cargoId: string
  templateId: CargoCategory
  templateName: string
  shopId: string
  shopName: string
  /** Shop colour, resolved once against the full shop set (stable across trips). */
  color: string
  weightKg: number
  loadingOrder: number
  assignedDoor: DoorSide
  /** Delivery stop the owning shop is served at, or null if it has no stop. */
  stopNumber: number | null
  /** Fragile cargo cannot be stacked on — gets a distinct visual tell. */
  fragile: boolean
  /** Domain min-corner (cm) — retained for animation/debug. */
  min: Vec3
  /** Footprint/height at the placement's rotation, i.e. 90° already applied (cm). */
  size: Dimensions
  /** Scene-space mesh centre (metres) — where the centred box mesh sits. */
  center: [number, number, number]
  /** Scene-space box size (metres) for the boxGeometry args. */
  sceneSize: [number, number, number]
}

/** Fragile = the fragile-box template; the only category flagged delicate in MVP. */
function isFragile(templateId: CargoCategory): boolean {
  return templateId === 'fragile-box'
}

/**
 * Resolve every placement in `trip` into a `CargoRenderItem`, ordered by
 * loadingOrder (tiebreak cargoId) so iteration and mount order are stable.
 * Placements whose cargo isn't found in the scenario are skipped defensively.
 */
export function buildCargoRenderItems(
  trip: DeliveryTrip,
  scenario: Scenario,
): CargoRenderItem[] {
  const shopIds = scenario.shops.map((s) => s.id)
  const shopById = new Map(scenario.shops.map((s) => [s.id, s]))
  const cargoById = new Map(
    scenario.shops.flatMap((s) => s.requestedCargo.map((c) => [c.id, c] as const)),
  )
  const stopByShop = new Map(trip.stops.map((s) => [s.shopId, s.stopNumber]))

  const items: CargoRenderItem[] = []
  for (const placement of trip.placements) {
    const cargo = cargoById.get(placement.cargoId)
    if (!cargo) continue
    const shop = shopById.get(cargo.shopId)
    if (!shop) continue

    const template = getTemplate(cargo.templateId)
    const box = toPlacedBox(placement, template)

    items.push({
      cargoId: placement.cargoId,
      templateId: template.id,
      templateName: template.name,
      shopId: shop.id,
      shopName: shop.name,
      color: shopColorById(shop.id, shopIds),
      weightKg: template.weightKg,
      loadingOrder: placement.loadingOrder,
      assignedDoor: placement.assignedDoor,
      stopNumber: stopByShop.get(shop.id) ?? null,
      fragile: isFragile(template.id),
      min: box.min,
      size: box.size,
      center: boxCenter(box.min, box.size),
      sceneSize: sizeToScene(box.size),
    })
  }

  items.sort((a, b) => a.loadingOrder - b.loadingOrder || (a.cargoId < b.cargoId ? -1 : 1))
  return items
}

/** Marker position for the centre-of-mass overlay. */
export type CenterOfMass = {
  /** Weight-weighted centroid in scene metres. */
  center: [number, number, number]
  totalWeightKg: number
}

/**
 * Weight-weighted centroid of the placed items, in scene metres. Returns null
 * for an empty or weightless trip (nothing to mark). Centres are already linear
 * in scene space, so averaging them directly is exact.
 */
export function centerOfMass(items: readonly CargoRenderItem[]): CenterOfMass | null {
  let w = 0
  let x = 0
  let y = 0
  let z = 0
  for (const item of items) {
    w += item.weightKg
    x += item.center[0] * item.weightKg
    y += item.center[1] * item.weightKg
    z += item.center[2] * item.weightKg
  }
  if (w <= 0) return null
  return { center: [x / w, y / w, z / w], totalWeightKg: w }
}

/**
 * Darken a `#rrggbb` hex colour toward black by `amount` (0..1). Used for cargo
 * edge outlines so a box reads as a solid volume against its own fill colour.
 */
export function darkenHex(hex: string, amount: number): string {
  const clamped = Math.max(0, Math.min(1, amount))
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 0xff) * (1 - clamped))
  const g = Math.round(((n >> 8) & 0xff) * (1 - clamped))
  const b = Math.round((n & 0xff) * (1 - clamped))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
