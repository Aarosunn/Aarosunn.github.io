import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { makeMaterial, type Palette, type Variant } from './materials'

const SIZE = 1 // touching; seams are drawn in-shader, coplanar interior faces are back-face culled
const AXES = ['x', 'y', 'z'] as const
type Axis = (typeof AXES)[number]

type Cubie = { mesh: THREE.Mesh; pos: THREE.Vector3 }

export type CubeHandle = {
  turn: (axis?: Axis, layer?: -1 | 0 | 1, dir?: 1 | -1) => Promise<void>
  positions: () => number[][]
  busy: () => boolean
}

type Props = {
  variant: Variant
  palette: Palette
  auto: boolean
  onTurn: () => void
  handle: React.MutableRefObject<CubeHandle | null>
}

const BOX = new THREE.BoxGeometry(SIZE, SIZE, SIZE)

export function Cube({ variant, palette, auto, onTurn, handle }: Props) {
  const root = useRef<THREE.Group>(null!)
  const pivot = useRef<THREE.Group>(null!)
  const cubies = useRef<Cubie[]>([])
  const busy = useRef(false)
  const material = useMemo(() => makeMaterial(variant, palette), [variant, palette])

  useEffect(() => () => material.dispose(), [material])

  const turn = useMemo<CubeHandle['turn']>(
    () => (axis, layer, dir) => {
      if (busy.current) return Promise.resolve()
      busy.current = true
      const ax = axis ?? AXES[Math.floor(Math.random() * 3)]
      const ly = layer ?? (([-1, 0, 1] as const)[Math.floor(Math.random() * 3)])
      const d = dir ?? (Math.random() < 0.5 ? 1 : -1)
      const slice = cubies.current.filter((c) => Math.round(c.pos[ax]) === ly)
      const pv = pivot.current
      pv.rotation.set(0, 0, 0)
      slice.forEach((c) => pv.attach(c.mesh))
      return new Promise<void>((res) => {
        gsap.to(pv.rotation, {
          [ax]: (d * Math.PI) / 2,
          duration: 0.55,
          ease: 'power3.inOut',
          onComplete: () => {
            const rot = new THREE.Vector3().set(ax === 'x' ? 1 : 0, ax === 'y' ? 1 : 0, ax === 'z' ? 1 : 0)
            slice.forEach((c) => {
              root.current.attach(c.mesh)
              c.pos.applyAxisAngle(rot, (d * Math.PI) / 2).round()
              c.mesh.position.copy(c.pos)
              // snap rotation to exact quarter turns so error never accumulates
              const e = c.mesh.rotation
              e.set(snap(e.x), snap(e.y), snap(e.z))
            })
            busy.current = false
            onTurn()
            res()
          },
        })
      })
    },
    [onTurn],
  )

  useEffect(() => {
    handle.current = {
      turn,
      positions: () => cubies.current.map((c) => c.pos.toArray()),
      busy: () => busy.current,
    }
  }, [turn, handle])

  // Auto mode: chain turns with a short breath between.
  useEffect(() => {
    if (!auto) return
    let live = true
    const loop = async () => {
      while (live) {
        await turn()
        await new Promise((r) => setTimeout(r, 350))
      }
    }
    loop()
    return () => {
      live = false
    }
  }, [auto, turn])

  // Entrance: one orchestrated moment.
  useEffect(() => {
    const g = root.current
    g.scale.setScalar(0)
    gsap.to(g.scale, { x: 1, y: 1, z: 1, duration: 1.4, ease: 'expo.out', delay: 0.15 })
  }, [])

  useFrame((s, dt) => {
    root.current.rotation.y += dt * 0.12
    root.current.updateMatrixWorld()
    material.uniforms.uTime.value = s.clock.elapsedTime
    material.uniforms.uRootInv.value.copy(root.current.matrixWorld).invert()
  })

  const coords = useMemo(() => {
    const out: THREE.Vector3[] = []
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) out.push(new THREE.Vector3(x, y, z))
    return out
  }, [])

  return (
    <group ref={root} rotation={[0.45, -0.6, 0]}>
      <group ref={pivot} />
      {coords.map((p, i) => (
        <mesh
          key={i}
          geometry={BOX}
          material={material}
          position={p}
          ref={(m: THREE.Mesh | null) => {
            if (m) cubies.current[i] = { mesh: m, pos: p.clone() }
          }}
        />
      ))}
    </group>
  )
}

const Q = Math.PI / 2
const snap = (r: number) => Math.round(r / Q) * Q
