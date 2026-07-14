// Emissive pulse applied imperatively to cargo meshes by the animators (T14
// loading flight, T15 delivery highlight/blocker flash). Uses the same
// emissive channel as the React-driven selection highlight in CargoBox, so a
// pulse is always CLEARED exactly once when it ends (tracked via userData) —
// never reset every frame, which would stomp the selection material props.

import type { Mesh, MeshStandardMaterial } from 'three'

export function setPulse(mesh: Mesh, color: string, intensity: number): void {
  const material = mesh.material as MeshStandardMaterial
  material.emissive.set(color)
  material.emissiveIntensity = intensity
  mesh.userData.animPulse = true
}

export function clearPulse(mesh: Mesh): void {
  if (!mesh.userData.animPulse) return
  const material = mesh.material as MeshStandardMaterial
  material.emissive.set('#000000')
  material.emissiveIntensity = 0
  mesh.userData.animPulse = false
}
