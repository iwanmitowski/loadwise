// The single useFrame driver for the loading animation (T14). Mounted by
// CargoLayer only while playback mode is 'loading'; on unmount it restores
// every mesh to its exact placed transform, so leaving the mode (or the screen)
// can never wedge boxes mid-flight.
//
// No per-frame React state: the timeline lives in the shared loadingClock, and
// transforms are written straight onto the CargoBox meshes. The only store
// writes are discrete — the current item index changing, and auto-pausing when
// the timeline completes.

import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshStandardMaterial } from 'three'
import type { VehicleDefinition } from '@/types'
import { useUiStore } from '@/state/uiStore'
import type { CargoRenderItem } from '../CargoLayer/cargoModel'
import { itemIndexAt, transformAt } from './loadingTimeline'
import { loadingClock, resetLoadingClock } from './playbackClock'
import { useLoadingTimeline } from './useLoadingTimeline'

// Emissive pulse on the in-flight box — same emissive channel the selection
// highlight uses (CargoBox), so the two visuals read as one family. Rises and
// falls over the flight so the box lands with the pulse already faded.
const PULSE_PEAK = 0.75

type LoadingAnimatorProps = {
  /** Trip items, loadingOrder-sorted (buildCargoRenderItems guarantees it). */
  items: readonly CargoRenderItem[]
  vehicle: VehicleDefinition
  /** Live cargoId → mesh registry maintained by CargoLayer. */
  meshes: ReadonlyMap<string, Mesh>
}

export function LoadingAnimator({ items, vehicle, meshes }: LoadingAnimatorProps) {
  const { paths, duration } = useLoadingTimeline(items, vehicle)

  // Entering loading mode starts from an empty vehicle. (Trip switches remount
  // the whole CargoLayer, so a stale clock can never leak across trips.)
  useEffect(() => {
    resetLoadingClock(duration)
  }, [duration])

  // Restore exact placed transforms when the animator leaves the scene —
  // mode → idle shows the full load, per the prompt.
  useEffect(() => {
    return () => {
      for (const item of items) {
        const mesh = meshes.get(item.cargoId)
        if (!mesh) continue
        mesh.visible = true
        mesh.position.set(...item.center)
        clearPulse(mesh)
      }
    }
  }, [items, meshes])

  useFrame((_, delta) => {
    const ui = useUiStore.getState()
    const { playing, speed, index } = ui.playback

    if (playing) {
      loadingClock.t = Math.min(loadingClock.t + delta * speed, duration)
      // Timeline exhausted → auto-pause (stay in loading mode so Restart works).
      if (loadingClock.t >= duration) ui.setPlayback({ playing: false })
    }
    const t = loadingClock.t

    for (let k = 0; k < items.length; k++) {
      const item = items[k]
      const mesh = meshes.get(item.cargoId)
      if (!mesh) continue

      const transform = transformAt(t, k, paths[k])
      mesh.visible = transform.visible
      mesh.position.set(...transform.position)

      if (transform.phase === 'moving') {
        const material = mesh.material as MeshStandardMaterial
        material.emissive.set(item.color)
        material.emissiveIntensity = PULSE_PEAK * Math.sin(transform.flight * Math.PI)
        mesh.userData.loadingPulse = true
      } else if (mesh.userData.loadingPulse) {
        // Reset once when a box stops flying — never every frame, so React's
        // selection-highlight emissive (CargoBox props) stays untouched.
        clearPulse(mesh)
      }
    }

    // Discrete store sync: HUD shows "item k / N".
    const currentIndex = itemIndexAt(t, items.length)
    if (currentIndex !== index) ui.setPlayback({ index: currentIndex })
  })

  return null
}

function clearPulse(mesh: Mesh): void {
  if (!mesh.userData.loadingPulse) return
  const material = mesh.material as MeshStandardMaterial
  material.emissive.set('#000000')
  material.emissiveIntensity = 0
  mesh.userData.loadingPulse = false
}
