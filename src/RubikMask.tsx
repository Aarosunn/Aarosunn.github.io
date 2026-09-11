/**
 * A Rubik's cube for the mask scene of PaperCube: 27 cubies sharing one mask material, quarter-turn
 * layer animation (pivot-attach quarter turns), integrity-checkable positions.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { RoundedBox } from '@react-three/drei'

export type Axis = 'x' | 'y' | 'z'
export type Move = { axis: Axis; layer: -1 | 0 | 1; dir: 1 | -1; quarters: 1 | 2 }
/** face letters in cube space: U +y, D -y, R +x, L -x, F +z, B -z; M E S slices follow L D F. A clockwise face turn
 *  seen from outside is a negative rotation about the +axis, so the +faces carry dir -1. */
const FACE: Record<string, [Axis, -1 | 0 | 1, 1 | -1]> = { U: ['y', 1, -1], D: ['y', -1, 1], R: ['x', 1, -1], L: ['x', -1, 1], F: ['z', 1, -1], B: ['z', -1, 1], M: ['x', 0, 1], E: ['y', 0, 1], S: ['z', 0, -1] }
/** "R U R' U2 F'" -> moves */
export const parseAlg = (alg: string): Move[] =>
  alg
    .trim()
    .split(/\s+/)
    .filter((t) => FACE[t[0]])
    .map((t) => {
      const [axis, layer, d] = FACE[t[0]]
      return { axis, layer, dir: (t.includes("'") ? -d : d) as 1 | -1, quarters: t.includes('2') ? 2 : 1 }
    })
/** the famous ones, keys j k l on the site and in the lab */
export const ALGS: Record<string, string> = {
  'T perm': "R U R' U' R' F R2 U' R' U' R U R' F'",
  'U perm': "R U' R U R U R U' R' U' R2",
  Sune: "R U R' U R U2 R'",
}
export type RubikHandle = {
  turn: (axis?: Axis, layer?: -1 | 0 | 1, dir?: 1 | -1) => Promise<void>
  /** an algorithm in standard notation (or moves) at speedcubing pace, the cube locked for its whole run */
  run: (alg: string | Move[], duration?: number) => Promise<void>
  /** logical state (slot + orientation per cubie) as a string, for identity checks */
  state: () => string
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
/** turn feel: a layer under a finger flick is the step response of an underdamped second-order system: no velocity
 *  at the start (inertia), fastest about a sixth of the way in, a few degrees past the detent, then it settles. The
 *  body recoils a touch against the layer while the layer accelerates. */
export type Feel = { duration: number; f: (p: number) => number; peak: number; recoil: number }
const response = (zeta: number, w: number, duration: number, recoil: number): Feel => {
  const wd = w * Math.sqrt(1 - zeta * zeta)
  const raw = (p: number) => 1 - Math.exp(-zeta * w * p) * (Math.cos(wd * p) + ((zeta * w) / wd) * Math.sin(wd * p))
  const f1 = raw(1)
  const f = (p: number) => raw(p) / f1
  let peak = 0
  for (let i = 0; i < 200; i++) peak = Math.max(peak, (f((i + 1) / 200) - f(i / 200)) * 200)
  return { duration, f, peak, recoil }
}
/** deck / idle turns: 0.5 s, 1.2° overshoot; algorithms: 0.18 s (~5 turns a second), 0.4°;
 *  screen: the section transitions' cube (CubeScreen), a speedcuber's hands: 0.15 s a turn, a smaller recoil */
export const FEEL = { turn: response(0.78, 7, 0.5, 0.018), fast: response(0.85, 8, 0.18, 0.008), screen: response(0.86, 9, 0.15, 0.004) }
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

/** combo: the chance an idle turn is instead a burst of two or three quick turns (a speedcuber's fingers) */
export const RubikMask = forwardRef<RubikHandle, { gap: number; material: THREE.Material; auto: boolean; autoInterval?: number; combo?: number; rounded?: number; onTurn?: () => void }>(
  function RubikMask({ gap, material, auto, autoInterval = 900, combo = 0, rounded = 0, onTurn }, ref) {
    const root = useRef<THREE.Group>(null!)
    const pivot = useRef<THREE.Group>(null!)
    const cubies = useRef<Cubie[]>([])
    const busy = useRef(false)
    const alive = useRef(true)
    const pending = useRef<(() => void) | null>(null)
    const tween = useRef<gsap.core.Tween | null>(null)
    // a tween still in flight when we unmount must not touch dead refs, and its promise must still settle
    useEffect(() => {
      alive.current = true
      return () => {
        alive.current = false
        tween.current?.kill()
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
    // inline ref callbacks run again on every re-render (the site re-renders on each deck step): only a new mesh
    // gets a fresh record, or the logical slot would reset to the starting cell and later turns would pick the
    // wrong nine cubies and snap them to the wrong slots
    const track = (i: number, m: THREE.Mesh | null) => {
      if (!m) return
      if (cubies.current[i]?.mesh !== m) cubies.current[i] = { mesh: m, pos: cells[i].clone() }
      m.onBeforeRender = tagId(i)
    }

    // one layer move; callers hold `busy`
    const turnOne = useMemo(
      () => (ax: Axis, ly: -1 | 0 | 1, d: 1 | -1, quarters: 1 | 2, feel: Feel) => {
        const angle = (d * quarters * Math.PI) / 2
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
          const proxy = { t: 0 }
          const body = root.current
          tween.current = gsap.to(proxy, {
            t: 1,
            duration: feel.duration * (quarters === 2 ? 1.4 : 1),
            ease: 'none',
            onUpdate: () => {
              const t = proxy.t
              pv.rotation[ax] = angle * feel.f(t)
              const speed = (feel.f(Math.min(t + 1e-3, 1)) - feel.f(t)) * 1e3
              body.rotation[ax] = (-Math.sign(angle) * feel.recoil * Math.max(0, speed)) / feel.peak
            },
            onComplete: () => {
              if (!alive.current) return
              body.rotation[ax] = 0
              pv.rotation[ax] = angle
              const rot = new THREE.Vector3(ax === 'x' ? 1 : 0, ax === 'y' ? 1 : 0, ax === 'z' ? 1 : 0)
              pv.updateMatrixWorld(true)
              slice.forEach((c) => {
                root.current.attach(c.mesh)
                c.pos.applyAxisAngle(rot, angle).round()
                c.mesh.position.copy(c.pos).multiplyScalar(gap)
                snapMesh(c.mesh)
                c.mesh.updateMatrix()
                c.mesh.updateMatrixWorld(true)
              })
              pending.current = null
              onTurn?.()
              res()
            },
          })
        })
      },
      [gap, onTurn],
    )
    const turn = useMemo<RubikHandle['turn']>(
      () => (axis, layer, dir) => {
        if (busy.current) return Promise.resolve()
        busy.current = true
        const ax = axis ?? AXES[Math.floor(Math.random() * 3)]
        const ly = layer ?? (([-1, 0, 1] as const)[Math.floor(Math.random() * 3)])
        const d = dir ?? (Math.random() < 0.5 ? 1 : -1)
        return turnOne(ax, ly, d, 1, FEEL.turn).finally(() => { busy.current = false })
      },
      [turnOne],
    )
    // brisk pace: ~5 turns a second, a half turn a touch longer
    const run = useMemo<RubikHandle['run']>(
      () => async (alg, duration = FEEL.fast.duration) => {
        if (busy.current) return
        busy.current = true
        const feel = { ...FEEL.fast, duration }
        try {
          for (const m of typeof alg === 'string' ? parseAlg(alg) : alg) {
            if (!alive.current) break
            await turnOne(m.axis, m.layer, m.dir, m.quarters, feel)
          }
        } finally {
          busy.current = false
        }
      },
      [turnOne],
    )

    useImperativeHandle(
      ref,
      () => ({
        turn,
        run,
        state: () => JSON.stringify(cubies.current.map((c) => [...c.pos.toArray(), ...new THREE.Matrix4().makeRotationFromQuaternion(c.mesh.quaternion).elements.slice(0, 11).map(Math.round)])),
        positions: () => cubies.current.map((c) => c.pos.toArray()),
        orientationError: () => Math.max(0, ...cubies.current.map((c) => orientationError(c.mesh))),
        dump: () => cubies.current.map((c) => ({ pos: c.pos.toArray(), mesh: c.mesh.position.toArray().map((n) => +n.toFixed(3)), parentOk: c.mesh.parent === root.current })),
        placementError: () =>
          Math.max(0, ...cubies.current.map((c) => (c.mesh.parent === root.current ? c.mesh.position.distanceTo(c.pos.clone().multiplyScalar(gap)) : 9))),
        busy: () => busy.current,
      }),
      [turn, run],
    )

    useEffect(() => {
      if (!auto) return
      let live = true
      const loop = async () => {
        while (live) {
          if (Math.random() < combo) {
            // a burst: two or three turns on different axes, brisk but not algorithm-fast
            const moves: Move[] = []
            let ax: Axis = AXES[Math.floor(Math.random() * 3)]
            for (let i = 0; i < 2 + (Math.random() < 0.5 ? 1 : 0); i++) {
              moves.push({ axis: ax, layer: ([-1, 0, 1] as const)[Math.floor(Math.random() * 3)], dir: Math.random() < 0.5 ? 1 : -1, quarters: 1 })
              ax = AXES[(AXES.indexOf(ax) + 1 + Math.floor(Math.random() * 2)) % 3]
            }
            await run(moves, 0.3)
          } else await turn()
          // the pause varies around the interval so the idle never ticks like a clock
          await new Promise((r) => setTimeout(r, autoInterval * (0.6 + 0.8 * Math.random())))
        }
      }
      loop()
      return () => {
        live = false
      }
    }, [auto, autoInterval, combo, turn, run])

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
              ref={(m: THREE.Mesh | null) => track(i, m)}
            />
          ) : (
            <mesh
              key={i}
              position={[p.x * gap, p.y * gap, p.z * gap]}
              material={material}
              ref={(m) => track(i, m)}
            >
              <boxGeometry args={[1, 1, 1]} />
            </mesh>
          ),
        )}
      </group>
    )
  },
)
