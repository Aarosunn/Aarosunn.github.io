/**
 * The screen as a real Rubik's cube. Twenty-seven cubies, each cubie carrying its stickers; the front face fills
 * the viewport and is the page; the six faces hold six projects. "Next project" is a legal sequence of layer turns
 * (U E D one after another, or together) that brings a neighbouring face round to the front, one row of stickers
 * per turn, exactly as the physical puzzle does. Cubies are stretched to the viewport's thirds; their depth follows
 * the axis of the coming turn (a turn about y needs depth = cell width, about x depth = cell height) so the incoming
 * faces are the right size. Gaps are the seams; a laser weld erases them.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import type { CubeMove, CubeVersion } from './transitionVersions'
import { FEEL } from './RubikMask'
import { SCHEMES } from './schemes'
import { pageTexture, PROJECTS, type ScreenHandle } from './ScreenSolve'

const FOV = 30
type Sticker = { id: number; tex: number; col: number; row: number; up: THREE.Vector3; right: THREE.Vector3; n: THREE.Vector3 }
type Cubie = { pos: THREE.Vector3; stickers: Sticker[] }
/** the six faces as seen from outside: normal, the page's up and right in cube space, which project */
const FACES = [
  { n: [0, 0, 1], up: [0, 1, 0], right: [1, 0, 0] },
  { n: [1, 0, 0], up: [0, 1, 0], right: [0, 0, -1] },
  { n: [0, 0, -1], up: [0, 1, 0], right: [-1, 0, 0] },
  { n: [-1, 0, 0], up: [0, 1, 0], right: [0, 0, 1] },
  { n: [0, 1, 0], up: [0, 0, -1], right: [1, 0, 0] },
  { n: [0, -1, 0], up: [0, 0, 1], right: [1, 0, 0] },
]
const v3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2])
function solvedCube(): Cubie[] {
  const out: Cubie[] = []
  let id = 0
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const pos = new THREE.Vector3(x, y, z)
    const stickers = FACES.map((f, tex) => ({ f, tex })).filter(({ f }) => pos.dot(v3(f.n)) === 1).map(({ f, tex }) => ({ id: id++, tex, col: pos.dot(v3(f.right)) + 1, row: 1 - pos.dot(v3(f.up)), up: v3(f.up), right: v3(f.right), n: v3(f.n) }))
    out.push({ pos, stickers })
  }
  return out
}
const cloneCube = (cube: Cubie[]): Cubie[] => cube.map((c) => ({ pos: c.pos.clone(), stickers: c.stickers.map((s) => ({ ...s, up: s.up.clone(), right: s.right.clone(), n: s.n.clone() })) }))
/** cube notation (U D E R L M, ' and 2) to moves; same convention as the site cube: a clockwise face turn is a negative rotation about its +axis */
const NOTE: Record<string, [axis: 'x' | 'y', layer: number, dir: 1 | -1]> = { U: ['y', 1, -1], D: ['y', -1, 1], E: ['y', 0, 1], R: ['x', 1, -1], L: ['x', -1, 1], M: ['x', 0, 1] }
export const parseCubeAlg = (alg: string): CubeMove[] =>
  alg.trim().split(/\s+/).filter((t) => NOTE[t[0]]).flatMap((t) => { const [axis, layer, d] = NOTE[t[0]]; const dir = (t.includes("'") ? -d : d) as 1 | -1; const mv = { axis, layers: [layer], dir }; return t.includes('2') ? [mv, { ...mv }] : [mv] })
const expand = (v: CubeVersion): CubeMove[] => (v.alg ? parseCubeAlg(v.alg) : v.moves ?? [])
const round = (v: THREE.Vector3) => v.set(Math.round(v.x), Math.round(v.y), Math.round(v.z))
/** a quarter turn of one layer applied to the state */
function turn(cube: Cubie[], axis: 'x' | 'y' | 'z', layer: number, dir: 1 | -1) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(+(axis === 'x'), +(axis === 'y'), +(axis === 'z')), (dir * Math.PI) / 2)
  cube.filter((c) => c.pos[axis] === layer).forEach((c) => {
    round(c.pos.applyQuaternion(q))
    c.stickers.forEach((s) => { round(s.n.applyQuaternion(q)); round(s.up.applyQuaternion(q)); round(s.right.applyQuaternion(q)) })
  })
}

const BEAD_VERT = /* glsl */ `varying vec2 vUv; varying vec2 vPos; void main() { vUv = uv; vPos = (modelMatrix * vec4(position, 1.0)).xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const LASER_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uHeat; uniform float uBead; uniform vec2 uP0; uniform vec2 uP1; uniform vec2 uP2; uniform float uR;
  varying vec2 vUv; varying vec2 vPos;
  void main() {
    float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
    float d = min(distance(vPos, uP0), min(distance(vPos, uP1), distance(vPos, uP2)));
    float front = exp(-pow((d - uR) / 22.0, 2.0)) * 1.6 + exp(-max(d - uR, 0.0) / 60.0) * 0.5;
    float un = smoothstep(uR - 4.0, uR + 4.0, d);
    float scar = uHeat * 0.22 * edge * un; float hot = uBead * front * edge * un * 1.6;
    gl_FragColor = vec4(uColor * (scar + hot) + vec3(hot * hot * 0.5), 1.0);
  }
`

const Cube = forwardRef<ScreenHandle, { v: CubeVersion; scheme: string; recoil: boolean }>(function Cube({ v, scheme, recoil }, ref) {
  const { size, camera } = useThree()
  const W = size.width, H = size.height
  const cw = W / 3, ch = H / 3
  const colors = useMemo(() => { const sc = SCHEMES.find((x) => x.name === scheme) ?? SCHEMES[0]; return { bg: '#0b0e13', text: '#c9cdd8', bright: '#f2f3f7', mute: '#6b7185', a: sc.a } }, [scheme])
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = FOV; cam.position.set(0, 0, H / 2 / Math.tan((FOV * Math.PI) / 360)); cam.near = 1; cam.far = cam.position.z * 6; cam.updateProjectionMatrix()
  }, [camera, H])
  const textures = useMemo(() => PROJECTS.map((p) => pageTexture(p, W, H, colors)), [W, H, colors])
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures])
  const root = useRef<THREE.Group>(null!)
  const state = useRef({ cube: solvedCube(), busy: false, depth: cw, project: 0 })
  const groups = useRef<THREE.Group[]>([])
  const seams = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[]>([])
  const body = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0b0e13' }), [])
  /** the cubies as objects for the current state and depth (depth = the coming turn's axis extent) */
  const build = (depth: number) => {
    const g = root.current
    groups.current.forEach((c) => { c.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); if (o.material !== body) (o.material as THREE.Material).dispose() } }); c.parent?.remove(c) })
    state.current.depth = depth
    const ext = (a: THREE.Vector3) => (Math.abs(a.x) ? cw : Math.abs(a.y) ? ch : depth)
    groups.current = state.current.cube.map((c) => {
      const grp = new THREE.Group()
      grp.position.set(c.pos.x * cw, c.pos.y * ch, (c.pos.z - 1.5) * depth)
      grp.userData.cubie = c
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(cw, ch, depth), body))
      c.stickers.forEach((s) => {
        const w = ext(s.right), h = ext(s.up)
        const geo = new THREE.PlaneGeometry(w, h)
        const uv = geo.attributes.uv as THREE.BufferAttribute
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (s.col + uv.getX(k)) / 3, (2 - s.row + uv.getY(k)) / 3)
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: textures[s.tex % textures.length] }))
        m.position.copy(s.n).multiplyScalar(ext(s.n) / 2 + 0.5)
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(s.right, s.up, s.n))
        grp.add(m)
      })
      g.add(grp)
      return grp
    })
    setGap(gapNow.current)
  }
  const gapNow = useRef(0)
  /** the seams: cubies shrink toward their centres, the seam quads light the gaps on the front plane */
  const setGap = (gap: number) => {
    gapNow.current = gap
    groups.current.forEach((grp) => grp.scale.set((cw - gap) / cw, (ch - gap) / ch, 1))
    seams.current.forEach((s, k) => {
      const n = (k % 2) + 1
      if (k < 2) { s.position.set(0, H / 2 - n * ch, 1); s.rotation.z = 0; s.scale.set(W, Math.max(gap, 1), 1) } else { s.position.set(-W / 2 + n * cw, 0, 1); s.rotation.z = Math.PI / 2; s.scale.set(H, Math.max(gap, 1), 1) }
      s.visible = gap > 0
    })
  }
  useEffect(() => {
    const g = root.current
    const col = new THREE.Color(colors.a)
    seams.current = [0, 1, 2, 3].map(() => {
      const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: col }, uHeat: { value: 0 }, uBead: { value: 0 }, uP0: { value: new THREE.Vector2() }, uP1: { value: new THREE.Vector2() }, uP2: { value: new THREE.Vector2() }, uR: { value: 0 } }, vertexShader: BEAD_VERT, fragmentShader: LASER_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
      g.add(mesh)
      return mesh
    })
    build(cw)
    return () => { seams.current.forEach((s) => { s.material.dispose(); s.geometry.dispose(); g.remove(s) }); groups.current.forEach((c) => g.remove(c)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, textures, colors.a])
  useImperativeHandle(ref, () => ({
    busy: () => state.current.busy,
    next: () => new Promise<void>((resolve) => {
      const st = state.current
      if (st.busy) return resolve()
      st.busy = true
      const moves = expand(v)
      const nextIx = (st.project + 1) % textures.length
      // print the next project on the stickers that will end up on the front, each one while it is hidden: simulate the
      // sequence on a copy, note when each sticker first leaves the front, and its in-plane offset at the end
      const sim = cloneCube(st.cube)
      const hiddenAt = new Map<number, number>()
      sim.forEach((cb) => cb.stickers.forEach((s) => { if (s.n.z !== 1) hiddenAt.set(s.id, -1) }))
      moves.forEach((mv, i) => { mv.layers.forEach((l) => turn(sim, mv.axis, l, mv.dir)); sim.forEach((cb) => cb.stickers.forEach((s) => { if (s.n.z !== 1 && !hiddenAt.has(s.id)) hiddenAt.set(s.id, i) })) })
      const stamp = new Map<number, { col: number; row: number; k: number; at: number }>()
      sim.forEach((cb) => cb.stickers.forEach((s) => {
        if (s.n.z !== 1) return
        const k = Math.round((Math.PI / 2 - Math.atan2(s.up.y, s.up.x)) / (Math.PI / 2))
        stamp.set(s.id, { col: cb.pos.x + 1, row: 1 - cb.pos.y, k, at: hiddenAt.get(s.id) ?? moves.length })
      }))
      const restamp = (step: number) => st.cube.forEach((cb) => cb.stickers.forEach((s) => {
        const p = stamp.get(s.id)
        if (!p || p.at !== step) return
        const q = new THREE.Quaternion().setFromAxisAngle(s.n, (p.k * Math.PI) / 2)
        round(s.up.applyQuaternion(q)); round(s.right.applyQuaternion(q))
        s.tex = nextIx; s.col = p.col; s.row = p.row
      }))
      restamp(-1)
      const depthFor = (axis: CubeMove['axis']) => (axis === 'y' ? cw : ch)
      build(depthFor(moves[0]?.axis ?? 'y'))
      const tl = gsap.timeline({ onComplete: () => { st.project = nextIx; st.busy = false; resolve() } })
      // 1. the break: the gaps open and the seams light
      const gp = { g: 0 }
      seams.current.forEach((s) => { s.material.uniforms.uHeat.value = 1; s.material.uniforms.uBead.value = 0; s.material.uniforms.uR.value = 0 })
      tl.to(gp, { g: v.gap, duration: v.open, ease: 'power2.out', onUpdate: () => setGap(gp.g) }, 0)
      // 2. the turns, one move after another: the move's layers hang under pivots at the cube's centre and roll a quarter
      //    turn; on landing the state takes the turn, hidden stickers get their print, and the cube is rebuilt on the grid
      //    with the depth the next move's axis needs
      //    the turn is FEEL.screen: the site cube's mechanism (step response + body recoil, the rest of the cube leaning
      //    against the layer while it accelerates) with a speedcuber's numbers, tuned separately from the site cube
      const feel = FEEL.screen
      const live: { pivots: THREE.Group[]; body: THREE.Group | null; axis: CubeMove['axis']; dir: number } = { pivots: [], body: null, axis: 'y', dir: 1 }
      let landed = v.open
      moves.forEach((mv, k) => {
        const at = v.open + k * (feel.duration + v.stagger)
        tl.call(() => {
          build(depthFor(mv.axis))
          const centre = new THREE.Vector3(0, 0, -1.5 * st.depth)
          live.axis = mv.axis; live.dir = mv.dir
          const pivotAt = () => { const p = new THREE.Group(); p.position.copy(centre); root.current.add(p); return p }
          live.pivots = mv.layers.map((layer) => {
            const pivot = pivotAt()
            groups.current.filter((grp) => (grp.userData.cubie as Cubie).pos[mv.axis] === layer).forEach((grp) => pivot.attach(grp))
            return pivot
          })
          live.body = pivotAt()
          groups.current.filter((grp) => !mv.layers.includes((grp.userData.cubie as Cubie).pos[mv.axis])).forEach((grp) => live.body!.attach(grp))
        }, [], at)
        const t = { p: 0 }
        tl.fromTo(t, { p: 0 }, { p: 1, duration: feel.duration, ease: 'none', onUpdate: () => {
          const angle = (live.dir * Math.PI) / 2
          live.pivots.forEach((pv) => { pv.rotation[live.axis] = angle * feel.f(t.p) })
          const speed = (feel.f(Math.min(t.p + 1e-3, 1)) - feel.f(t.p)) * 1e3
          if (live.body) live.body.rotation[live.axis] = recoil ? (-Math.sign(angle) * feel.recoil * Math.max(0, speed)) / feel.peak : 0
        } }, at)
        tl.call(() => {
          mv.layers.forEach((layer) => turn(st.cube, mv.axis, layer, mv.dir))
          restamp(k)
          live.pivots.forEach((pv) => root.current.remove(pv))
          if (live.body) root.current.remove(live.body)
          build(depthFor(moves[k + 1]?.axis ?? mv.axis))
        }, [], at + feel.duration + 0.001)
        landed = at + feel.duration
      })
      // 3. the laser weld: three random points on the seams, rings growing until the grid is gone
      const pts = [0, 1, 2].map(() => { const onH = Math.random() < 0.5; const n = 1 + Math.floor(Math.random() * 2); const a = Math.random() - 0.5; return onH ? new THREE.Vector2(a * W, H / 2 - (n * H) / 3) : new THREE.Vector2(-W / 2 + (n * W) / 3, a * H) })
      const reach = Math.max(...pts.map((p) => Math.hypot(W / 2 + Math.abs(p.x), H / 2 + Math.abs(p.y)))) * 0.75
      const w0 = landed + 0.1
      tl.call(() => seams.current.forEach((s) => { s.material.uniforms.uP0.value.copy(pts[0]); s.material.uniforms.uP1.value.copy(pts[1]); s.material.uniforms.uP2.value.copy(pts[2]); s.material.uniforms.uBead.value = 1 }), [], w0)
      const r = { v: 0 }
      tl.to(r, { v: reach, duration: v.weld, ease: 'power1.out', onUpdate: () => seams.current.forEach((s) => { s.material.uniforms.uR.value = r.v }) }, w0)
      tl.to(gp, { g: 0, duration: v.weld, ease: 'power2.inOut', onUpdate: () => setGap(gp.g) }, w0)
      tl.call(() => seams.current.forEach((s) => { s.material.uniforms.uHeat.value = 0; s.material.uniforms.uBead.value = 0 }), [], w0 + v.weld)
    }),
  }), [v, textures, W, H, recoil])
  return <group ref={root} />
})

export const CubeScreen = forwardRef<ScreenHandle, { v: CubeVersion; scheme: string; recoil?: boolean }>(function CubeScreen({ v, scheme, recoil = true }, ref) {
  return (
    <Canvas className="transition-canvas" dpr={[1, 2]} camera={{ fov: FOV, position: [0, 0, 1000] }} gl={{ antialias: true }}>
      <Cube ref={ref} v={v} scheme={scheme} recoil={recoil} />
    </Canvas>
  )
})
