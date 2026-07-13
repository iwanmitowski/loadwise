import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'

function SpinningBox() {
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    meshRef.current.rotation.x += delta * 0.6
    meshRef.current.rotation.y += delta * 0.8
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1.6, 1.6, 1.6]} />
      <meshStandardMaterial color="#6366f1" />
    </mesh>
  )
}

function App() {
  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <header className="px-6 pt-10 pb-4 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">LoadWise</h1>
        <p className="mt-2 text-slate-400">
          Plan how cargo is loaded into a delivery vehicle — and watch every trip
          in 3D.
        </p>
      </header>
      <main className="min-h-0 flex-1">
        <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} />
          <SpinningBox />
        </Canvas>
      </main>
    </div>
  )
}

export default App
