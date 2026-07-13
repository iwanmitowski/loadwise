import { describe, expect, it } from 'vitest'
import { getTemplate, itemDimensions } from '@/features/cargo/templates'
import { buildScenarioVehicle } from '@/features/vehicles/vehicles'
import type {
  CargoCategory,
  CargoItem,
  DoorSide,
  Scenario,
  VehicleDefinition,
  VehicleId,
} from '@/types'
import { DEFAULT_OPTIMIZER_CONFIG as CFG } from './config'
import type { PlacedBox } from './geometry'
import { planSingleTrip, type TripPlanOutput } from './placeTrip'
import { validateLoad } from './validate'

// --- Builders -------------------------------------------------------------

function makeShop(
  id: string,
  deliveryOrder: number,
  preferredDoor: DoorSide,
  cargos: CargoCategory[],
) {
  return {
    id,
    name: id,
    type: 'general-store' as const,
    deliveryOrder,
    preferredDoor,
    requestedCargo: cargos.map((templateId, i) => ({
      id: `${id}-c${i + 1}`,
      templateId,
      shopId: id,
    })),
  }
}

function itemsOf(shops: ReturnType<typeof makeShop>[]): CargoItem[] {
  return shops.flatMap((s) => s.requestedCargo)
}

/** Resolve a plan's placements back into boxes for geometric assertions. */
function boxesOf(out: TripPlanOutput, items: CargoItem[]): PlacedBox[] {
  const templateByCargo = new Map(items.map((i) => [i.id, getTemplate(i.templateId)]))
  return out.placements.map((p) => {
    const template = templateByCargo.get(p.cargoId)!
    return {
      cargoId: p.cargoId,
      templateId: template.id,
      min: p.position,
      size: itemDimensions(template, p.rotationY),
      weightKg: template.weightKg,
    }
  })
}

/** Wrap a plan's placements as full CargoPlacements so validateLoad can re-check them. */
function asScenario(
  shops: ReturnType<typeof makeShop>[],
  vehicle: VehicleDefinition,
  vehicleId: VehicleId,
): Scenario {
  return {
    config: { seed: 'test', vehicleId, sideDoor: 'none', shopCount: shops.length },
    vehicle,
    shops,
  }
}

const centerZ = (b: PlacedBox) => b.min.z + b.size.depth / 2
const mean = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / ns.length

// --- Tests ----------------------------------------------------------------

describe('planSingleTrip', () => {
  it('everything fits — all boxes placed, none unplaced, validateLoad clean', () => {
    const vehicle = buildScenarioVehicle('box-truck', 'none')
    const shops = [
      makeShop('shop-1', 1, 'rear', ['medium-box', 'large-box']),
      makeShop('shop-2', 2, 'rear', ['medium-box', 'medium-box', 'large-box']),
    ]
    const items = itemsOf(shops)
    const out = planSingleTrip({ items, shops, vehicle, config: CFG })

    expect(out.unplaced).toHaveLength(0)
    expect(out.placements).toHaveLength(items.length)

    const placements = out.placements.map((p) => ({ ...p, tripId: 'trip-1' }))
    expect(validateLoad(placements, asScenario(shops, vehicle, 'box-truck'), CFG)).toHaveLength(0)
  })

  it('rear-door ordering — the later-delivery shop ends up deeper (greater mean z)', () => {
    const vehicle = buildScenarioVehicle('box-truck', 'none')
    const shops = [
      makeShop('shop-1', 1, 'rear', ['standard-pallet', 'standard-pallet']), // first stop
      makeShop('shop-2', 2, 'rear', ['standard-pallet', 'standard-pallet']), // later stop
    ]
    const items = itemsOf(shops)
    const out = planSingleTrip({ items, shops, vehicle, config: CFG })
    expect(out.unplaced).toHaveLength(0)

    const boxes = boxesOf(out, items)
    const zBy = (prefix: string) =>
      mean(boxes.filter((b) => b.cargoId.startsWith(prefix)).map(centerZ))
    expect(zBy('shop-2')).toBeGreaterThan(zBy('shop-1'))
  })

  it('side door — a left-preferring shop routes to the left door and populates its z-band', () => {
    const vehicle = buildScenarioVehicle('box-truck', 'left') // side door z-interval [210, 410]
    const door = vehicle.doors.find((d) => d.side === 'left')!
    const dz0 = door.position.z
    const dz1 = door.position.z + door.width

    const shops = [makeShop('shop-1', 1, 'left', Array<CargoCategory>(24).fill('medium-box'))]
    const items = itemsOf(shops)
    const out = planSingleTrip({ items, shops, vehicle, config: CFG })

    expect(out.unplaced).toHaveLength(0)
    // Every item is small enough for the side door → routed to it.
    expect(out.placements.every((p) => p.assignedDoor === 'left')).toBe(true)

    // At least some cargo lands in the door's z-band (its z-interval overlaps).
    const boxes = boxesOf(out, items)
    const overlapping = boxes.filter((b) => b.min.z < dz1 && dz0 < b.min.z + b.size.depth)
    expect(overlapping.length).toBeGreaterThan(0)

    const placements = out.placements.map((p) => ({ ...p, tripId: 'trip-1' }))
    expect(validateLoad(placements, asScenario(shops, vehicle, 'box-truck'), CFG)).toHaveLength(0)
  })

  it('floor-only pallets stay on the floor; nothing is stacked on a fragile box', () => {
    const vehicle = buildScenarioVehicle('box-truck', 'none')
    // Temptation: light stackable boxes alongside a floor-only pallet and a fragile box.
    const shops = [
      makeShop('shop-1', 1, 'rear', [
        'beverage-pallet', // floorOnly, unstackable
        'fragile-box', // unstackable
        'medium-box',
        'medium-box',
        'large-box',
        'large-box',
      ]),
    ]
    const items = itemsOf(shops)
    const out = planSingleTrip({ items, shops, vehicle, config: CFG })
    expect(out.unplaced).toHaveLength(0)

    const boxes = boxesOf(out, items)
    // Every beverage pallet rests on the floor.
    for (const b of boxes.filter((x) => x.templateId === 'beverage-pallet')) {
      expect(b.min.y).toBe(0)
    }
    // Nothing rests directly on top of a fragile box.
    for (const fragile of boxes.filter((x) => x.templateId === 'fragile-box')) {
      const top = fragile.min.y + fragile.size.height
      const restsOn = boxes.some(
        (b) =>
          b.cargoId !== fragile.cargoId &&
          b.min.y === top &&
          b.min.x < fragile.min.x + fragile.size.width &&
          fragile.min.x < b.min.x + b.size.width &&
          b.min.z < fragile.min.z + fragile.size.depth &&
          fragile.min.z < b.min.z + b.size.depth,
      )
      expect(restsOn).toBe(false)
    }
  })

  it('determinism — the same input twice yields deep-equal output', () => {
    const vehicle = buildScenarioVehicle('box-truck', 'left')
    const shops = [
      makeShop('shop-1', 1, 'left', ['beverage-pallet', 'large-box', 'medium-box']),
      makeShop('shop-2', 2, 'rear', ['standard-pallet', 'fragile-box', 'medium-box']),
      makeShop('shop-3', 3, 'rear', ['standard-pallet', 'large-box']),
    ]
    const items = itemsOf(shops)
    const a = planSingleTrip({ items, shops, vehicle, config: CFG })
    const b = planSingleTrip({ items, shops, vehicle, config: CFG })
    expect(a).toEqual(b)
  })

  it('overweight single item → exceeds-payload', () => {
    // Custom vehicle with a tiny payload so a single pallet is over on its own.
    const vehicle: VehicleDefinition = {
      id: 'box-truck',
      name: 'Featherweight',
      cargoSpace: { width: 400, height: 400, depth: 400 },
      maxPayloadKg: 100,
      doors: [{ id: 'r', side: 'rear', width: 300, height: 300, position: { x: 0, y: 0, z: 0 } }],
    }
    const shops = [makeShop('shop-1', 1, 'rear', ['standard-pallet'])] // 350kg > 100kg
    const items = itemsOf(shops)
    const out = planSingleTrip({ items, shops, vehicle, config: CFG })

    expect(out.placements).toHaveLength(0)
    expect(out.unplaced).toHaveLength(1)
    expect(out.unplaced[0].reason).toBe('exceeds-payload')
  })

  it('oversized item → exceeds-vehicle-dimensions', () => {
    // Cargo space smaller than any pallet in every orientation.
    const vehicle: VehicleDefinition = {
      id: 'cargo-van',
      name: 'Shoebox',
      cargoSpace: { width: 100, height: 100, depth: 100 },
      maxPayloadKg: 10000,
      doors: [{ id: 'r', side: 'rear', width: 90, height: 90, position: { x: 0, y: 0, z: 0 } }],
    }
    const shops = [makeShop('shop-1', 1, 'rear', ['standard-pallet'])] // 120×150×80
    const items = itemsOf(shops)
    const out = planSingleTrip({ items, shops, vehicle, config: CFG })

    expect(out.placements).toHaveLength(0)
    expect(out.unplaced[0].reason).toBe('exceeds-vehicle-dimensions')
  })

  it('perf smoke — 100 mixed items complete promptly (not CI-gating)', () => {
    const vehicle = buildScenarioVehicle('semi-trailer', 'right')
    const categories: CargoCategory[] = [
      'standard-pallet',
      'large-box',
      'medium-box',
      'fragile-box',
      'beverage-stack',
    ]
    const shops = Array.from({ length: 5 }, (_, s) =>
      makeShop(
        `shop-${s + 1}`,
        s + 1,
        s % 2 === 0 ? 'rear' : 'right',
        Array.from({ length: 20 }, (_, i) => categories[i % categories.length]),
      ),
    )
    const items = itemsOf(shops)
    const start = performance.now()
    const out = planSingleTrip({ items, shops, vehicle, config: CFG })
    const elapsed = performance.now() - start

    // Every item is accounted for exactly once.
    expect(out.placements.length + out.unplaced.length).toBe(items.length)
    // Informational only — no hard assertion so slow CI runners never fail this.
    console.log(`perf smoke: 100 items in ${elapsed.toFixed(0)}ms`)
  })
})
