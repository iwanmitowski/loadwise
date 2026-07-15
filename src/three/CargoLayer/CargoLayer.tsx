import { useCallback, useMemo, useRef } from 'react'
import { Line } from '@react-three/drei'
import type { Mesh } from 'three'
import type { DeliveryTrip, Scenario } from '@/types'
import { useUiStore } from '@/state/uiStore'
import { DeliveryAnimator, LoadingAnimator } from '../Animations'
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
  const liveComCenter = useUiStore((s) => s.liveComCenter)
  const setSelectedCargo = useUiStore((s) => s.setSelectedCargo)
  const playbackMode = useUiStore((s) => s.playback.mode)

  const items = useMemo(
    () => buildCargoRenderItems(trip, scenario),
    [trip, scenario],
  )
  const com = useMemo(() => centerOfMass(items), [items])

  // During delivery the balance point tracks the cargo still aboard (published
  // by the DeliveryAnimator as boxes leave); otherwise it's the full-load
  // centroid. When delivery has emptied the truck there's nothing to mark.
  const comCenter =
    playbackMode === 'delivery' ? liveComCenter : (com?.center ?? null)

  // cargoId → mesh registry, filled by CargoBox ref callbacks. The loading
  // animator (T14) drives box transforms through it.
  const meshes = useRef(new Map<string, Mesh>()).current
  const registerMesh = useCallback(
    (cargoId: string, mesh: Mesh | null) => {
      if (mesh) meshes.set(cargoId, mesh)
      else meshes.delete(cargoId)
    },
    [meshes],
  )

  // No unmount-side playback reset here: the T14/T15 state-machine guard lives
  // in uiStore (goTo / setSelectedTrip / resetForNewScenario), because a
  // cleanup with store side effects fires spuriously under StrictMode's
  // double-mount and would kill playback the moment it starts.

  return (
    <group onPointerMissed={() => setSelectedCargo(null)}>
      {items.map((item) => (
        <CargoBox
          key={item.cargoId}
          item={item}
          labelsVisible={labelsVisible}
          registerMesh={registerMesh}
        />
      ))}
      {comVisible && comCenter ? <CenterOfMassMarker center={comCenter} /> : null}
      {playbackMode === 'loading' ? (
        <LoadingAnimator items={items} vehicle={scenario.vehicle} meshes={meshes} />
      ) : null}
      {playbackMode === 'delivery' ? (
        <DeliveryAnimator trip={trip} scenario={scenario} items={items} meshes={meshes} />
      ) : null}
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
