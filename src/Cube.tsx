import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { makeMaterial, type Variant } from './materials/v1'
import { makeShared, makeV2, type Palette, type V2Material } from './materials/v2'

export type Shape = 'classic' | 'solid'
export type Set = 'v1' | 'v2'
export const SHAPES: Shape[] = ['classic', 'solid']
export const SETS: Set[] = ['v1', 'v2']

// classic = first iteration exactly: rounded, gapped. solid = rounded corners, touching; the bevels are the seams.
const SHAPE = {
  classic: { gap: 1.06, radius: 0.09 },
  solid: { gap: 1.0, radius: 0.045 },
}

const AXES = ['x', 'y', 'z'] as const
type Axis = (typeof AXES)[number]
type Cubie = { mesh: THREE.Mesh; pos: THREE.Vector3 }

export type CubeHandle = {
  turn: (axis?: Axis, layer?: -1 | 0 | 1, dir?: 1 | -1) => Promise<void>
  positions: () => number[][]
  busy: () => boolean
}

type Props = {
  shape: Shape
  set: Set
  variant: Variant
  palette: Palette
  auto: boolean
  float: boolean
  onTurn: () => void
  handle: React.MutableRefObject<CubeHandle | null>
}

export function Cube({ shape, set, variant, palette, auto, float, onTurn, handle }: Props) {
  const root = useRef<THREE.Group>(null!)
  const pivot = useRef<THREE.Group>(null!)
  const cubies = useRef<Cubie[]>([])
  const busy = useRef(false)
  const { gap, radius } = SHAPE[shape]

  // v1: one shared material, as shipped. v2: one per cubie so rest-space uniforms can differ.
  const shared = useMemo(makeShared, [])
  const mats = useMemo<THREE.Material[]>(
    () =>
      set === 'v1'
        ? [makeMaterial(variant, palette.a, palette.b, palette.bg)]
        : Array.from({ length: 27 }, () => makeV2(variant, palette, gap + 0.5, shared)),
    [set, variant, palette, gap, shared],
  )
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])

  // Push each cubie's snapped orientation + slot into its v2 material.
  const syncRest = useMemo(
    () => () => {
      if (set !== 'v2') return
      cubies.current.forEach((c, i) => {
        const u = (mats[i] as V2Material).u
        u.uRot.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(c.mesh.quaternion))
        u.uPos.value.copy(c.pos).multiplyScalar(gap)
      })
    },
    [set, mats, gap],
  )
  useEffect(syncRest, [syncRest])

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
              c.mesh.position.copy(c.pos).multiplyScalar(gap)
              // snap rotation to exact quarter turns so error never accumulates
              const e = c.mesh.rotation
              e.set(snap(e.x), snap(e.y), snap(e.z))
            })
            syncRest()
            busy.current = false
            onTurn()
            res()
          },
        })
      })
    },
    [onTurn, gap, syncRest],
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
    root.current.position.y = float ? Math.sin(s.clock.elapsedTime * 0.7) * 0.06 : 0
    root.current.updateMatrixWorld()
    shared.uTime.value = s.clock.elapsedTime
    shared.uRootInv.value.copy(root.current.matrixWorld).invert()
    const v1 = (mats[0] as THREE.ShaderMaterial).uniforms
    if (v1) v1.uTime.value = s.clock.elapsedTime
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
        <RoundedBox
          key={`${shape}-${i}`}
          args={[1, 1, 1]}
          radius={radius}
          smoothness={4}
          position={p.clone().multiplyScalar(gap)}
          material={mats[i % mats.length]}
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
