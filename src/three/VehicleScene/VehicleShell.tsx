import { Edges, Grid } from '@react-three/drei'
import { DoubleSide } from 'three'
import type { VehicleDefinition } from '@/types'
import { sizeToScene } from '../units'
import { useUiStore } from '@/state/uiStore'
import { Doors } from './Doors'

const FRAME_COLOR = '#94a3b8'
const WALL_COLOR = '#7dd3fc'
const FLOOR_COLOR = '#334155'
const CAB_COLOR = '#475569'

type PanelProps = {
  position: [number, number, number]
  rotation?: [number, number, number]
  args: [number, number]
  visible: boolean
}

/** A single transparent wall/roof panel — the volume still reads via <Edges>. */
function Panel({ position, rotation, args, visible }: PanelProps) {
  return (
    <mesh position={position} rotation={rotation} visible={visible}>
      <planeGeometry args={args} />
      <meshStandardMaterial
        color={WALL_COLOR}
        transparent
        opacity={0.15}
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

/**
 * The vehicle interior: solid floor, transparent side/front walls + roof, a
 * frame outline that stays visible when walls are hidden, the doors, plus ground
 * context (grid, cab silhouette). All proportions come from `vehicle.cargoSpace`.
 */
export function VehicleShell({ vehicle }: { vehicle: VehicleDefinition }) {
  const wallsVisible = useUiStore((s) => s.wallsVisible)
  const roofVisible = useUiStore((s) => s.roofVisible)
  const [w, h, d] = sizeToScene(vehicle.cargoSpace)

  return (
    <group>
      {/* Ground context, sitting just below the load deck so it frames the vehicle. */}
      <Grid
        position={[w / 2, -0.01, d / 2]}
        args={[w * 6, d * 3]}
        cellSize={0.25}
        cellThickness={0.5}
        cellColor="#1e293b"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#334155"
        fadeDistance={Math.max(w, d) * 4}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* Solid load deck at y=0 — cargo rests on this (T13). */}
      <mesh
        position={[w / 2, 0, d / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={FLOOR_COLOR} side={DoubleSide} />
      </mesh>

      {/* Frame outline of the full cargo volume — always visible. */}
      <mesh position={[w / 2, h / 2, d / 2]}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        <Edges color={FRAME_COLOR} />
      </mesh>

      {/* Transparent walls. Rear (z=0) is left open — that's the doorway. */}
      {/* Left wall x=0 */}
      <Panel
        position={[0, h / 2, d / 2]}
        rotation={[0, Math.PI / 2, 0]}
        args={[d, h]}
        visible={wallsVisible}
      />
      {/* Right wall x=w */}
      <Panel
        position={[w, h / 2, d / 2]}
        rotation={[0, Math.PI / 2, 0]}
        args={[d, h]}
        visible={wallsVisible}
      />
      {/* Front wall (cabin end) z=d */}
      <Panel position={[w / 2, h / 2, d]} args={[w, h]} visible={wallsVisible} />
      {/* Roof y=h */}
      <Panel
        position={[w / 2, h, d / 2]}
        rotation={[Math.PI / 2, 0, 0]}
        args={[w, d]}
        visible={roofVisible}
      />

      <Doors vehicle={vehicle} />

      <CabSilhouette width={w} height={h} depth={d} />
    </group>
  )
}

/** Simple gray boxes at the +Z (cabin) end so the orientation is obvious. */
function CabSilhouette({
  width,
  height,
  depth,
}: {
  width: number
  height: number
  depth: number
}) {
  const cabDepth = Math.min(1.4, depth * 0.25)
  const cabHeight = height * 0.9
  const hoodDepth = cabDepth * 0.7
  return (
    <group>
      {/* Cabin block, flush against the cargo front wall. */}
      <mesh
        position={[width / 2, cabHeight / 2, depth + cabDepth / 2]}
        castShadow
      >
        <boxGeometry args={[width * 0.98, cabHeight, cabDepth]} />
        <meshStandardMaterial color={CAB_COLOR} />
      </mesh>
      {/* Lower hood, projecting further forward. */}
      <mesh
        position={[width / 2, cabHeight * 0.3, depth + cabDepth + hoodDepth / 2]}
        castShadow
      >
        <boxGeometry args={[width * 0.98, cabHeight * 0.6, hoodDepth]} />
        <meshStandardMaterial color={CAB_COLOR} />
      </mesh>
    </group>
  )
}
