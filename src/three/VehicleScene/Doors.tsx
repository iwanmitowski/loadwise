import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, type Group } from 'three'
import type { VehicleDefinition, VehicleDoor } from '@/types'
import { CM } from '../units'
import { useUiStore } from '@/state/uiStore'

const DOOR_COLOR = '#f59e0b'
const REAR_OPEN_ANGLE = Math.PI * 0.62 // ~112° — swings clear of the opening
const SMOOTH_RATE = 7 // exponential approach; ~0.5s to settle

/**
 * Doors are forced open while the loading animation plays (cargo must fly in
 * through an open door); otherwise the user's toggle rules.
 */
function useDoorsOpen(): boolean {
  return useUiStore((s) => s.doorsOpen || s.playback.mode === 'loading')
}

/** Framerate-independent exponential approach toward `target`. */
function approach(current: number, target: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-SMOOTH_RATE * delta))
}

function doorMaterial() {
  return (
    <meshStandardMaterial
      color={DOOR_COLOR}
      transparent
      opacity={0.7}
      side={DoubleSide}
      depthWrite={false}
    />
  )
}

/** Rear door: two half-panels hinged at the outer edges, swinging outward (−z). */
function RearDoor({ door }: { door: VehicleDoor }) {
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)
  const progress = useRef(0)
  const doorsOpen = useDoorsOpen()

  const dx = door.position.x * CM
  const dw = door.width * CM
  const dh = door.height * CM
  const half = dw / 2

  useFrame((_, delta) => {
    progress.current = approach(progress.current, doorsOpen ? 1 : 0, delta)
    const angle = progress.current * REAR_OPEN_ANGLE
    if (left.current) left.current.rotation.y = angle
    if (right.current) right.current.rotation.y = -angle
  })

  return (
    <group>
      {/* Left half — hinged at x=dx, panel extends toward centre (+x). */}
      <group ref={left} position={[dx, dh / 2, 0]}>
        <mesh position={[half / 2, 0, 0]}>
          <planeGeometry args={[half, dh]} />
          {doorMaterial()}
        </mesh>
      </group>
      {/* Right half — hinged at x=dx+dw, panel extends toward centre (−x). */}
      <group ref={right} position={[dx + dw, dh / 2, 0]}>
        <mesh position={[-half / 2, 0, 0]}>
          <planeGeometry args={[half, dh]} />
          {doorMaterial()}
        </mesh>
      </group>
    </group>
  )
}

/** Side door: a panel on the x=0 / x=w wall that slides along +z to open. */
function SideDoor({
  door,
  wallX,
}: {
  door: VehicleDoor
  wallX: number
}) {
  const panel = useRef<Group>(null)
  const progress = useRef(0)
  const doorsOpen = useDoorsOpen()

  const dw = door.width * CM // runs along Z for side doors
  const dh = door.height * CM
  const dz = door.position.z * CM
  const closedZ = dz + dw / 2

  useFrame((_, delta) => {
    progress.current = approach(progress.current, doorsOpen ? 1 : 0, delta)
    if (panel.current) panel.current.position.z = closedZ + progress.current * dw
  })

  return (
    <group ref={panel} position={[wallX, dh / 2, closedZ]}>
      {/* Rotate the plane onto the x=wallX wall (normal ±x); width maps along z. */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[dw, dh]} />
        {doorMaterial()}
      </mesh>
    </group>
  )
}

/** Renders every door the scenario vehicle carries. */
export function Doors({ vehicle }: { vehicle: VehicleDefinition }) {
  const wallW = vehicle.cargoSpace.width * CM
  return (
    <group>
      {vehicle.doors.map((door) => {
        if (door.side === 'rear') return <RearDoor key={door.id} door={door} />
        const wallX = door.side === 'left' ? 0 : wallW
        return <SideDoor key={door.id} door={door} wallX={wallX} />
      })}
    </group>
  )
}
