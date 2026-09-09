/**
 * A Rubik's cube for the mask scene of PaperCube: 27 cubies sharing one mask material, quarter-turn
 * layer animation (same pivot-attach scheme as Cube.tsx), integrity-checkable positions.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'

export type Axis = 'x' | 'y' | 'z'
export type RubikHandle = {
  turn: (axis?: Axis, layer?: -1 | 0 | 1, dir?: 1 | -1) => Promise<void>
  positions: () => number[][]
  busy: () => boolean
}
type Cubie = { mesh: THREE.Mesh; pos: THREE.Vector3 }
const AXES: Axis[] = ['x', 'y', 'z']
const snap = (r: number) => Math.round(r / (Math.PI / 2)) * (Math.PI / 2)

export const RubikMask = forwardRef<RubikHandle, { gap: number; material: THREE.Material; auto: boolean; onTurn?: () => void }>(
  function RubikMask({ gap, material, auto, onTurn }, ref) {
    const root = useRef<THREE.Group>(null!)
    const pivot = useRef<THREE.Group>(null!)
    const cubies = useRef<Cubie[]>([])
    const busy = useRef(false)
    const cells = useMemo(() => {
      const out: THREE.Vector3[] = []
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) out.push(new THREE.Vector3(x, y, z))
      return out
    }, [])

    const turn = useMemo<RubikHandle['turn']>(
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
              const rot = new THREE.Vector3(ax === 'x' ? 1 : 0, ax === 'y' ? 1 : 0, ax === 'z' ? 1 : 0)
              slice.forEach((c) => {
                root.current.attach(c.mesh)
                c.pos.applyAxisAngle(rot, (d * Math.PI) / 2).round()
                c.mesh.position.copy(c.pos).multiplyScalar(gap)
                const e = c.mesh.rotation
                e.set(snap(e.x), snap(e.y), snap(e.z))
              })
              busy.current = false
              onTurn?.()
              res()
            },
          })
        })
      },
      [gap, onTurn],
    )

    useImperativeHandle(ref, () => ({ turn, positions: () => cubies.current.map((c) => c.pos.toArray()), busy: () => busy.current }), [turn])

    useEffect(() => {
      if (!auto) return
      let live = true
      const loop = async () => {
        while (live) {
          await turn()
          await new Promise((r) => setTimeout(r, 900))
        }
      }
      loop()
      return () => {
        live = false
      }
    }, [auto, turn])

    return (
      <group ref={root}>
        <group ref={pivot} />
        {cells.map((p, i) => (
          <mesh
            key={i}
            position={[p.x * gap, p.y * gap, p.z * gap]}
            material={material}
            ref={(m) => {
              if (m) cubies.current[i] = { mesh: m, pos: p.clone() }
            }}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        ))}
      </group>
    )
  },
)
