// Dev-only synthetic scene builder. There is no Storybook in this repo, so the
// "100-item trip" and "rotated placement" acceptance checks live here as a pure,
// deterministic generator: import it from a scratch dev route to eyeball 60fps,
// and it's covered by devScene.test.ts. NOT used in production screens.
//
// Pure (no React/Three) — it only assembles domain objects, so the same 3D path
// (buildCargoRenderItems → CargoBox) that serves real results renders it.

import { getTemplate, itemDimensions } from '@/features/cargo/templates'
import { buildScenarioVehicle } from '@/features/vehicles/vehicles'
import type {
  CargoCategory,
  CargoItem,
  CargoPlacement,
  DeliveryStop,
  DeliveryTrip,
  Scenario,
  Shop,
} from '@/types'

// A rotation-friendly mix: a few footprints that tile cleanly on the floor.
const TEMPLATE_CYCLE: CargoCategory[] = [
  'medium-box',
  'large-box',
  'fragile-box',
  'beverage-stack',
]

const SHOP_COUNT = 4

/**
 * Build a synthetic `{ scenario, trip }` with `count` floor-packed boxes spread
 * across a few shops, every 4th one rotated 90°. Deterministic: no RNG, no dates
 * — same `count` in, same objects out. Uses the semi-trailer for the floor area.
 */
export function buildSyntheticScene(count = 100): {
  scenario: Scenario
  trip: DeliveryTrip
} {
  const vehicle = buildScenarioVehicle('semi-trailer', 'none')
  const space = vehicle.cargoSpace

  const shops: Shop[] = Array.from({ length: SHOP_COUNT }, (_, s) => ({
    id: `shop-${s + 1}`,
    name: `Shop ${s + 1}`,
    type: 'general-store',
    deliveryOrder: s + 1,
    preferredDoor: 'rear',
    requestedCargo: [],
  }))

  // Taller than any template (max height 105 cm) so stacked layers never overlap.
  const LAYER_HEIGHT = 120

  const placements: CargoPlacement[] = []
  let cursorX = 0
  let cursorZ = 0
  let cursorY = 0
  let rowDepth = 0

  for (let i = 0; i < count; i++) {
    const templateId = TEMPLATE_CYCLE[i % TEMPLATE_CYCLE.length]
    const template = getTemplate(templateId)
    const rotationY: 0 | 90 = i % 4 === 0 ? 90 : 0
    const size = itemDimensions(template, rotationY)

    // Shelf-pack along +X, wrap rows in +Z, then stack in +Y when the floor fills.
    if (cursorX + size.width > space.width) {
      cursorX = 0
      cursorZ += rowDepth
      rowDepth = 0
    }
    if (cursorZ + size.depth > space.depth) {
      cursorX = 0
      cursorZ = 0
      rowDepth = 0
      cursorY += LAYER_HEIGHT
    }
    if (cursorY + LAYER_HEIGHT > space.height) break

    const shopIndex = i % SHOP_COUNT
    const shopId = `shop-${shopIndex + 1}`
    const cargo: CargoItem = { id: `syn-${i + 1}`, templateId, shopId }
    shops[shopIndex].requestedCargo.push(cargo)

    placements.push({
      cargoId: cargo.id,
      tripId: 'trip-1',
      position: { x: cursorX, y: cursorY, z: cursorZ },
      rotationY,
      loadingOrder: i + 1,
      assignedDoor: 'rear',
    })

    cursorX += size.width
    rowDepth = Math.max(rowDepth, size.depth)
  }

  const stops: DeliveryStop[] = shops.map((shop) => ({
    shopId: shop.id,
    stopNumber: shop.deliveryOrder,
    door: 'rear',
  }))

  const scenario: Scenario = {
    config: { seed: 'synthetic', vehicleId: 'semi-trailer', sideDoor: 'none', shopCount: SHOP_COUNT },
    vehicle,
    shops,
  }

  const trip: DeliveryTrip = {
    id: 'trip-1',
    tripNumber: 1,
    stops,
    placements,
    deferredCargo: [],
    // Metrics aren't needed to render the cargo layer; a zeroed shell keeps this
    // generator dependency-light (real metrics come from T08 in production).
    metrics: {
      requestedUnits: placements.length,
      loadedUnits: placements.length,
      deferredUnits: 0,
      totalWeightKg: 0,
      weightUtilization: 0,
      usedVolumeCm3: 0,
      volumeUtilization: 0,
      emptyVolumeCm3: 0,
      leftRightBalance: 0,
      frontRearBalance: 0,
      longitudinalStability: 0,
      blockedCargoCount: 0,
      extraUnloadingMoves: 0,
      splitShopIds: [],
      constraintViolations: 0,
      overallScore: 0,
    },
  }

  return { scenario, trip }
}
