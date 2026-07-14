import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import type { DeliveryTrip, Scenario } from '@/types'
import { useUiStore } from '@/state/uiStore'
import { CargoBox } from './CargoBox'
import { buildCargoRenderItems, centerOfMass } from './cargoModel'

/**
 * All of one trip's cargo, rendered inside the vehicle shell. Source-agnostic:
 * it only ever sees a `DeliveryTrip` + `Scenario`, so the same component serves
 * the demo fixture and real optimizer results.
 *
 * Mount this with `key={trip.id}` so switching trips remounts cleanly. Clicking
 * empty space (a click that hits no box) clears the current selection.
 */
export function CargoLayer({
  trip,
  scenario,
}: {
  trip: DeliveryTrip
  scenario: Scenario
}) {
  const labelsVisible = useUiStore((s) => s.labelsVisible)
  const comVisible = useUiStore((s) => s.comVisible)
  const setSelectedCargo = useUiStore((s) => s.setSelectedCargo)

  const items = useMemo(
    () => buildCargoRenderItems(trip, scenario),
    [trip, scenario],
  )
  const com = useMemo(() => centerOfMass(items), [items])

  return (
    <group onPointerMissed={() => setSelectedCargo(null)}>
      {items.map((item) => (
        <CargoBox key={item.cargoId} item={item} labelsVisible={labelsVisible} />
      ))}
      {comVisible && com ? <CenterOfMassMarker center={com.center} /> : null}
    </group>
  )
}

const COM_COLOR = '#ef4444'

/** Red sphere at the weight-weighted centroid + a plumb line to the floor. */
function CenterOfMassMarker({ center }: { center: [number, number, number] }) {
  const [x, y, z] = center
  return (
    <group>
      <mesh position={[x, y, z]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color={COM_COLOR} depthTest={false} transparent opacity={0.9} />
      </mesh>
      <Line
        points={[
          [x, y, z],
          [x, 0, z],
        ]}
        color={COM_COLOR}
        lineWidth={2}
        dashed
        dashSize={0.06}
        gapSize={0.04}
        depthTest={false}
        transparent
        opacity={0.8}
      />
    </group>
  )
}
