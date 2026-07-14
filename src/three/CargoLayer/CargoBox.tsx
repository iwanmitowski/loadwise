import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges, Text } from '@react-three/drei'
import { Vector3, type Mesh } from 'three'
import { useUiStore } from '@/state/uiStore'
import type { CargoRenderItem } from './cargoModel'
import { darkenHex } from './cargoModel'

// Opacity a box drops to when it doesn't match the active shop filter.
const FILTERED_OPACITY = 0.12
// White outline flags fragile cargo (cheap "handle with care" tell).
const FRAGILE_EDGE = '#f8fafc'

type CargoBoxProps = {
  item: CargoRenderItem
  labelsVisible: boolean
  /**
   * Registers this box's mesh in the layer's cargoId → mesh map (null on
   * unmount). The loading animator (T14) drives positions through that map.
   */
  registerMesh?: (cargoId: string, mesh: Mesh | null) => void
}

/**
 * One placement rendered as a centred box. Colour comes from the owning shop;
 * `<Edges>` outline gives the volume definition (white for fragile items).
 * Selection highlights with emissive + a brighter, thicker edge; the shop filter
 * dims and disables non-matching boxes.
 *
 * Selection/filter state is read via *derived* selectors so a selection change
 * only re-renders the two boxes whose selected-ness actually flips, not all 100.
 */
export function CargoBox({ item, labelsVisible, registerMesh }: CargoBoxProps) {
  const [w, h, d] = item.sceneSize
  const selected = useUiStore((s) => s.selectedCargoId === item.cargoId)
  const shopFilter = useUiStore((s) => s.shopFilter)
  const setSelectedCargo = useUiStore((s) => s.setSelectedCargo)

  const filteredOut = shopFilter !== null && shopFilter !== item.shopId
  const edgeColor = item.fragile ? FRAGILE_EDGE : darkenHex(item.color, 0.45)

  return (
    <mesh
      ref={(mesh: Mesh | null) => registerMesh?.(item.cargoId, mesh)}
      position={item.center}
      castShadow
      receiveShadow
      // Filtered-out boxes are ghosts: no ray hits, so they can't be selected.
      raycast={filteredOut ? () => null : undefined}
      onClick={(e) => {
        if (filteredOut) return
        e.stopPropagation()
        setSelectedCargo(item.cargoId)
      }}
      onPointerOver={(e) => {
        if (filteredOut) return
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial
        color={item.color}
        roughness={0.7}
        metalness={0.05}
        emissive={selected ? item.color : '#000000'}
        emissiveIntensity={selected ? 0.55 : 0}
        transparent={filteredOut}
        opacity={filteredOut ? FILTERED_OPACITY : 1}
        depthWrite={!filteredOut}
      />
      <Edges
        color={selected ? '#ffffff' : edgeColor}
        lineWidth={selected ? 2.5 : 1}
        // Hide the outline on filtered ghosts so they don't read as solid.
        visible={!filteredOut}
      />
      {labelsVisible && !filteredOut ? (
        <CargoLabels text={item.templateName} width={w} depth={d} height={h} />
      ) : null}
    </mesh>
  )
}

/**
* Template name on all four vertical faces (front, back, left, right) of the
* box, so it reads no matter which side is facing the camera — a single face
* (previously just −Z, rear-door) is invisible whenever the box is viewed or
* occluded from any other angle. Each face gets its own Text mesh, sized to
* that face's actual width so labels never spill onto neighbouring cargo.
* Top/bottom are skipped — they're rarely in view while inspecting a load.
*/

function CargoLabels({
  text,
  width,
  depth,
  height,
}: {
  text: string
  width: number
  depth: number
  height: number
}) {
  const eps = 0.005

  // rotationY values rotate the label (default: facing +Z) to face outward on
  // each side, i.e. toward whatever direction that face's outward normal
  // points — the only orientation from which the face is ever actually seen.
  // (Previously these were each off by 180°, so every label faced *into* the
  // box; troika's Text is double-sided, so from outside that rendered as a
  // mirror image rather than disappearing.) faceWidth is the horizontal
  // extent of that face, used to size the font/wrap so text fits the face
  // it's actually drawn on.

  const faces = [
    {
      key: 'rear',
      position: [0, 0, -depth / 2 - eps] as const,
      rotationY: Math.PI,
      faceWidth: width,
    },

    {
      key: 'front',
      position: [0, 0, depth / 2 + eps] as const,
      rotationY: 0,
      faceWidth: width,
    },

    {
      key: 'left',
      position: [-width / 2 - eps, 0, 0] as const,
      rotationY: -Math.PI / 2,
      faceWidth: depth,
    },

    {
      key: 'right',
      position: [width / 2 + eps, 0, 0] as const,
      rotationY: Math.PI / 2,
      faceWidth: depth,
    },
  ]

  return (
    <>
      {faces.map((f) => (
        <CargoLabel
          key={f.key}

          text={text}

          position={f.position}

          rotationY={f.rotationY}

          faceWidth={f.faceWidth}

          height={height}
        />
      ))}
    </>
  )
}

// Camera distance (scene metres) past which labels hide, to declutter when the
// whole vehicle is in frame. Under it they show — legible while inspecting.
const LABEL_HIDE_DISTANCE = 6

/**
* One face's worth of label text, shown only while the camera is near enough.
* Mounted only when labels are enabled, so the per-frame distance check exists
* only while it's needed. A hard cutoff (rather than a troika fillOpacity
* fade, which needs a costly per-frame sync) keeps it cheap and reliable
* across 100 boxes × 4 faces.
*/

function CargoLabel({
  text,
  position,
  rotationY,
  faceWidth,
  height,
}: {
  text: string
  position: readonly [number, number, number]
  rotationY: number
  faceWidth: number
  height: number
}) {
  const ref = useRef<Mesh>(null)
  const worldPos = useRef(new Vector3())

  useFrame(({ camera }) => {
    const label = ref.current
    if (!label) return
    label.getWorldPosition(worldPos.current)
    label.visible = camera.position.distanceTo(worldPos.current) < LABEL_HIDE_DISTANCE
  })

  // Fit the label to this face's actual width × height, not just height — a
  // narrow face previously got the same fontSize/maxWidth as a wide one, so
  // its label overflowed past the box edges onto neighbouring cargo. Both
  // dimensions cap the font size now, and overflowWrap lets a long single word
  // break instead of spilling past maxWidth.
  
  const padding = 0.88
  const longestWord = Math.max(...text.split(/\s+/).map((w) => w.length))
  const smallestSide = Math.min(faceWidth, height)
  const fontSize = Math.min(0.1,smallestSide * 0.32,faceWidth / (longestWord * 0.6))

  return (
    <Text
      ref={ref}
      position={position}
      rotation={[0, rotationY, 0]}
      fontSize={fontSize}
      maxWidth={faceWidth * padding}
      overflowWrap="normal"
      textAlign="center"
      color="#0f172a"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.004}
      outlineColor="#f8fafc"
    >
      {text}
    </Text>
  )
}
