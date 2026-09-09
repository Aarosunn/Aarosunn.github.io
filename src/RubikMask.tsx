/**
 * A Rubik's cube for the mask scene of PaperCube: 27 cubies sharing one mask material, quarter-turn
 * layer animation (pivot-attach quarter turns), integrity-checkable positions.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { RoundedBox } from '@react-three/drei'

export type Axis = 'x' | 'y' | 'z'
export type RubikHandle = {
  turn: (axis?: Axis, layer?: -1 | 0 | 1, dir?: 1 | -1) => Promise<void>
  positions: () => number[][]
  /** largest deviation of any cubie's rotation matrix element from {-1, 0, 1} (0 = every cubie sits on an exact quarter turn) */
  orientationError: () => number
  /** largest distance between a cubie mesh and its grid slot (parent must be the root, not the pivot) */
  placementError: () => number
  /** debug: per-cubie logical slot, mesh position, parent ok */
  dump: () => { pos: number[]; mesh: number[]; parentOk: boolean }[]
  busy: () => boolean
}
type Cubie = { mesh: THREE.Mesh; pos: THREE.Vector3 }
const AXES: Axis[] = ['x', 'y', 'z']
// snap a cubie onto the nearest exact quarter-turn orientation by rounding its rotation matrix, so
// error never accumulates (rounding Euler angles is not safe near gimbal lock)
const snapMesh = (m: THREE.Mesh) => {
  const r = new THREE.Matrix4().makeRotationFromQuaternion(m.quaternion)
  const e = r.elements
  for (let i = 0; i < 16; i++) e[i] = Math.round(e[i])
  m.quaternion.setFromRotationMatrix(r)
}
const orientationError = (m: THREE.Mesh) => {
  const e = new THREE.Matrix4().makeRotationFromQuaternion(m.quaternion).elements
  let worst = 0
  for (let i = 0; i < 12; i++) worst = Math.max(worst, Math.abs(e[i] - Math.round(e[i])))
  return worst
}

export const RubikMask = forwardRef<RubikHandle, { gap: number; material: THREE.Material; auto: boolean; autoInterval?: number; rounded?: number; onTurn?: () => void }>(
  function RubikMask({ gap, material, auto, autoInterval = 900, rounded = 0, onTurn }, ref) {
    const root = useRef<THREE.Group>(null!)
    const pivot = useRef<THREE.Group>(null!)
    const cubies = useRef<Cubie[]>([])
    const busy = useRef(false)
    const alive = useRef(true)
    const pending = useRef<(() => void) | null>(null)
    // a tween still in flight when we unmount must not touch dead refs, and its promise must still settle
    useEffect(() => {
      alive.current = true
      const pv = pivot.current
      return () => {
        alive.current = false
        gsap.killTweensOf(pv.rotation)
        pending.current?.()
        pending.current = null
      }
    }, [])
    // the mask material is shared; each cubie writes its own id (1..27 over 28) so the field solver never bridges two cubies
    const tagId = (i: number) => (_r: THREE.WebGLRenderer, _s: THREE.Scene, _c: THREE.Camera, _g: THREE.BufferGeometry, mat: THREE.Material) => {
      const u = (mat as THREE.ShaderMaterial).uniforms
      if (u?.uId) {
        u.uId.value = (i + 1) / 28
        ;(mat as THREE.ShaderMaterial).uniformsNeedUpdate = true
      }
    }
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
        // attach() reparents through cached matrices: recompose ours first, or a turn started before the
        // next render (the previous turn's snap has not been rendered yet) reparents a stale transform
        pv.updateMatrix()
        pv.updateMatrixWorld(true)
        slice.forEach((c) => {
          c.mesh.updateMatrix()
          pv.attach(c.mesh)
        })
        return new Promise<void>((res) => {
          pending.current = res
          gsap.to(pv.rotation, {
            [ax]: (d * Math.PI) / 2,
            duration: 0.55,
            ease: 'power3.inOut',
            onComplete: () => {
              if (!alive.current) return
              const rot = new THREE.Vector3(ax === 'x' ? 1 : 0, ax === 'y' ? 1 : 0, ax === 'z' ? 1 : 0)
              pv.updateMatrixWorld(true)
              slice.forEach((c) => {
                root.current.attach(c.mesh)
                c.pos.applyAxisAngle(rot, (d * Math.PI) / 2).round()
                c.mesh.position.copy(c.pos).multiplyScalar(gap)
                snapMesh(c.mesh)
                c.mesh.updateMatrix()
                c.mesh.updateMatrixWorld(true)
              })
              busy.current = false
              pending.current = null
              onTurn?.()
              res()
            },
          })
        })
      },
      [gap, onTurn],
    )

    useImperativeHandle(
      ref,
      () => ({
        turn,
        positions: () => cubies.current.map((c) => c.pos.toArray()),
        orientationError: () => Math.max(0, ...cubies.current.map((c) => orientationError(c.mesh))),
        dump: () => cubies.current.map((c) => ({ pos: c.pos.toArray(), mesh: c.mesh.position.toArray().map((n) => +n.toFixed(3)), parentOk: c.mesh.parent === root.current })),
        placementError: () =>
          Math.max(0, ...cubies.current.map((c) => (c.mesh.parent === root.current ? c.mesh.position.distanceTo(c.pos.clone().multiplyScalar(gap)) : 9))),
        busy: () => busy.current,
      }),
      [turn],
    )

    useEffect(() => {
      if (!auto) return
      let live = true
      const loop = async () => {
        while (live) {
          await turn()
          await new Promise((r) => setTimeout(r, autoInterval))
        }
      }
      loop()
      return () => {
        live = false
      }
    }, [auto, autoInterval, turn])

    return (
      <group ref={root}>
        <group ref={pivot} />
        {cells.map((p, i) =>
          rounded > 0 ? (
            <RoundedBox
              key={i}
              args={[1, 1, 1]}
              radius={rounded}
              smoothness={3}
              position={[p.x * gap, p.y * gap, p.z * gap]}
              material={material}
              ref={(m: THREE.Mesh | null) => {
                if (m) {
                  cubies.current[i] = { mesh: m, pos: p.clone() }
                  m.onBeforeRender = tagId(i)
                }
              }}
            />
          ) : (
            <mesh
              key={i}
              position={[p.x * gap, p.y * gap, p.z * gap]}
              material={material}
              ref={(m) => {
                if (m) {
                  cubies.current[i] = { mesh: m, pos: p.clone() }
                  m.onBeforeRender = tagId(i)
                }
              }}
            >
              <boxGeometry args={[1, 1, 1]} />
            </mesh>
          ),
        )}
      </group>
    )
  },
)
