import type { ComponentRef, RefObject } from 'react'
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { OrbitControls } from '@react-three/drei'
import { useUiStore } from '@/state/uiStore'
import type { CameraPose } from './camera'

/** The imperative OrbitControls instance drei exposes via ref. */
export type OrbitControlsImpl = ComponentRef<typeof OrbitControls>

/**
 * Snaps the camera back to `pose` whenever `resetView()` is called (tracked via
 * the store's monotonic nonce). Also applies the pose once on mount, and again
 * whenever the pose changes (vehicle swap), so the initial framing matches the
 * reset target.
 */
export function useCameraReset(
  controlsRef: RefObject<OrbitControlsImpl | null>,
  pose: CameraPose,
): void {
  const camera = useThree((s) => s.camera)
  const resetViewNonce = useUiStore((s) => s.resetViewNonce)

  useEffect(() => {
    const controls = controlsRef.current
    camera.position.set(...pose.position)
    if (controls) {
      controls.target.set(...pose.target)
      controls.update()
    } else {
      camera.lookAt(...pose.target)
    }
    // Re-frame on reset (nonce change) and on vehicle swap (pose change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetViewNonce, pose.position[0], pose.position[1], pose.position[2]])
}
