import { useMemo, useRef, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import type { VehicleDefinition } from '@/types'
import { sizeToScene } from '../units'
import { initialCameraPose, orbitLimits } from './camera'
import { useCameraReset, type OrbitControlsImpl } from './useCameraReset'
import { VehicleShell } from './VehicleShell'

/**
 * The 3D scene for one vehicle: canvas, lighting, orbit controls, the vehicle
 * shell, and a slot (`children`) where the cargo layer (T13) mounts. All framing
 * derives from `vehicle.cargoSpace`, so every vehicle renders in proportion.
 */
export function VehicleScene({
  vehicle,
  children,
}: {
  vehicle: VehicleDefinition
  children?: ReactNode
}) {
  const pose = useMemo(() => initialCameraPose(vehicle), [vehicle])
  const [w, h, d] = sizeToScene(vehicle.cargoSpace)
  const maxDim = Math.max(w, h, d)

  return (
    <Canvas shadows camera={{ position: pose.position, fov: 50, near: 0.05, far: maxDim * 20 }}>
      <color attach="background" args={['#0f172a']} />
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[w * 1.5, maxDim * 2, -maxDim]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.1}
        shadow-camera-far={maxDim * 6}
        shadow-camera-left={-maxDim}
        shadow-camera-right={maxDim}
        shadow-camera-top={maxDim}
        shadow-camera-bottom={-maxDim}
      />

      <ContactShadows
        position={[w / 2, -0.005, d / 2]}
        scale={maxDim * 2}
        blur={2}
        opacity={0.5}
        far={h}
      />

      <VehicleShell vehicle={vehicle} />
      {children}

      <SceneControls vehicle={vehicle} />
    </Canvas>
  )
}

/** Orbit controls + camera-reset wiring. Lives inside the Canvas (needs r3f ctx). */
function SceneControls({ vehicle }: { vehicle: VehicleDefinition }) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const pose = useMemo(() => initialCameraPose(vehicle), [vehicle])
  const limits = useMemo(() => orbitLimits(vehicle), [vehicle])

  useCameraReset(controlsRef, pose)

  return (
    <OrbitControls
      ref={controlsRef}
      target={pose.target}
      enablePan
      minDistance={limits.minDistance}
      maxDistance={limits.maxDistance}
      maxPolarAngle={limits.maxPolarAngle}
    />
  )
}
