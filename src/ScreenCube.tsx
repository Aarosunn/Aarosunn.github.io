/**
 * The section page as a real Rubik's cube. Twenty-seven cubies stretched to the viewport's thirds, each carrying its
 * stickers; the front face is the page. A sticker shows its cell of the shader cube's captured image (the tiles are
 * the cube's own material) under the page's text. "Next project" is a legal sequence of layer turns (U E D R E D) that
 * brings the next page round to the front one row of stickers at a time, exactly as the physical puzzle does: every
 * sticker that will end on the front is printed with the next page at the first moment it is hidden, oriented to
 * arrive upright, so any number of projects fits on six faces. Drawn by hand inside the site's canvas after the
 * paper pass, with its own scene and camera (z = 0 is the viewport in CSS px).
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import type { Project } from './content'
import { FEEL } from './RubikMask'
import { pageTexture } from './page'
import { THEME } from './theme'

export type ScreenHandle = {
  next: () => Promise<void>
  busy: () => boolean
  /** the root's scale (the landed face is square, the page the viewport's thirds) */
  setScale: (sx: number, sy: number) => void
  /** the face's rect in the captured image (uv: x y w h, y up) the tiles sample their liquid from */
  setFace: (x: number, y: number, w: number, h: number) => void
  /** the text's opacity */
  setFade: (k: number) => void
  /** drawn or not (imperative, so it can flip in the same tick as the paper pass's capture) */
  setLive: (on: boolean) => void
  /** the liquid's opacity: 1 = the cube's material, 0 = the page's bare ground (the text stays) */
  setAlpha: (a: number) => void
}

const FOV = 30
/** the turns that bring the next page to the front, and the pause between them */
const ALG = 'U E D R E D'
const STAGGER = 0.03
/** the tiles: each samples its cell of the capture PLATES of a cell inside its edges (past the paper's own seam and the
 *  plate's blurred rim), and the shader draws the gap itself, PLATE_GAP of a tile, black and crisp. Every plate is a rounded
 *  rectangle: a corner at one of the face's four outer corners has radius ROUND, every other corner ROUND_INNER. The whole
 *  page is scaled up by EDGE so the outer half-gaps fall off the viewport and the plates run to its edges. */
const PLATES = 0.1
const PLATE_GAP = 0.08
const ROUND = 0.08
const ROUND_INNER = 0.022
const EDGE = 1 / (1 - PLATE_GAP / 3)

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const FRAG = /* glsl */ `
  uniform sampler2D uLiquid; uniform sampler2D uPage; uniform float uFade; uniform vec4 uFace; uniform float uAlpha;
  uniform float uInset; uniform float uRound; uniform float uRound2; uniform float uPlate;
  varying vec2 vUv;
  void main() {
    vec2 cell = floor(vUv * 3.0 - 0.001);
    vec2 local = vUv * 3.0 - cell;
    vec2 cu = (cell + uInset + local * (1.0 - 2.0 * uInset)) / 3.0;
    vec3 liq = texture2D(uLiquid, uFace.xy + cu * uFace.zw).rgb;
    // the rounded plate: outside it the pixel goes to the gap's black
    vec2 outer = step(0.5, abs(cell - 1.0) * step(0.5, abs(local - 0.5) * 2.0) * step(0.0, (cell - 1.0) * (local - 0.5)));
    float r = mix(uRound2, uRound, outer.x * outer.y);
    vec2 q = abs(local - 0.5) - (0.5 - uPlate - r);
    float sd = length(max(q, 0.0)) - r;
    liq *= mix(1.0, 0.05, smoothstep(-0.0015, 0.0015, sd));
    vec4 pg = texture2D(uPage, vUv);
    float t = pg.a * uFade;
    gl_FragColor = vec4(mix(liq, pg.rgb, t), mix(uAlpha, 1.0, t));
  }
`

type Sticker = { id: number; tex: number; col: number; row: number; up: THREE.Vector3; right: THREE.Vector3; n: THREE.Vector3 }
type Cubie = { pos: THREE.Vector3; stickers: Sticker[] }
type Move = { axis: 'x' | 'y'; layer: number; dir: 1 | -1 }
/** the six faces as seen from outside: normal, the page's up and right in cube space */
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
/** cube notation (U D E R L M, ' and 2) to moves; a clockwise face turn is a negative rotation about its +axis */
const NOTE: Record<string, [axis: 'x' | 'y', layer: number, dir: 1 | -1]> = { U: ['y', 1, -1], D: ['y', -1, 1], E: ['y', 0, 1], R: ['x', 1, -1], L: ['x', -1, 1], M: ['x', 0, 1] }
const MOVES: Move[] = ALG.trim().split(/\s+/).flatMap((t) => { const [axis, layer, d] = NOTE[t[0]]; const dir = (t.includes("'") ? -d : d) as 1 | -1; const mv = { axis, layer, dir }; return t.includes('2') ? [mv, { ...mv }] : [mv] })
const round = (v: THREE.Vector3) => v.set(Math.round(v.x), Math.round(v.y), Math.round(v.z))
/** a quarter turn of one layer applied to the state */
function turn(cube: Cubie[], axis: 'x' | 'y', layer: number, dir: 1 | -1) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(+(axis === 'x'), +(axis === 'y'), 0), (dir * Math.PI) / 2)
  cube.filter((c) => c.pos[axis] === layer).forEach((c) => {
    round(c.pos.applyQuaternion(q))
    c.stickers.forEach((s) => { round(s.n.applyQuaternion(q)); round(s.up.applyQuaternion(q)); round(s.right.applyQuaternion(q)) })
  })
}

export const ScreenCube = forwardRef<ScreenHandle, { projects: Project[]; liquid: THREE.Texture }>(function ScreenCube({ projects, liquid }, ref) {
  const { size, gl } = useThree()
  const W = size.width, H = size.height
  const cw = W / 3, ch = H / 3
  const scene = useRef<THREE.Scene>(null!)
  const camera = useMemo(() => new THREE.PerspectiveCamera(FOV, 1, 1, 10), [])
  useEffect(() => {
    camera.aspect = W / H; camera.fov = FOV; camera.position.set(0, 0, H / 2 / Math.tan((FOV * Math.PI) / 360)); camera.near = 1; camera.far = camera.position.z * 6; camera.updateProjectionMatrix()
  }, [camera, W, H])
  const uni = useRef({ face: new THREE.Vector4(0, 0, 1, 1), fade: 1, alpha: 1 })
  const liveRef = useRef(false)
  const mats = useRef<THREE.ShaderMaterial[]>([])
  const ground = useMemo(() => new THREE.Color(THEME.bg), [])
  // drawn by hand after the paper pass (priority 2): a clear to the page's ground, then the cube
  useFrame(() => {
    if (!liveRef.current || !scene.current) return
    gl.setRenderTarget(null)
    const prev = gl.getClearColor(new THREE.Color()); const prevA = gl.getClearAlpha(); const auto = gl.autoClear
    gl.setClearColor(ground, 1); gl.autoClear = true
    gl.render(scene.current, camera)
    gl.setClearColor(prev, prevA); gl.autoClear = auto
  }, 2)
  const textures = useMemo(() => projects.map((p) => pageTexture(p, W, H)), [W, H, projects])
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures])
  const root = useRef<THREE.Group>(null!)
  const state = useRef({ cube: solvedCube(), busy: false, depth: cw, project: 0 })
  const groups = useRef<THREE.Group[]>([])
  // the cubies' bodies in the page's own ground, so fully faded tiles leave nothing of the cube
  const body = useMemo(() => new THREE.MeshBasicMaterial({ color: THEME.bg }), [])
  /** the cubies as objects for the current state and depth (depth = the coming turn's axis extent) */
  const build = (depth: number) => {
    const g = root.current
    groups.current.forEach((c) => { c.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); if (o.material !== body) (o.material as THREE.Material).dispose() } }); c.parent?.remove(c) })
    mats.current = []
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
        const mat = new THREE.ShaderMaterial({ uniforms: { uLiquid: { value: liquid }, uPage: { value: textures[s.tex % textures.length] }, uFade: { value: uni.current.fade }, uFace: { value: uni.current.face }, uAlpha: { value: uni.current.alpha }, uInset: { value: PLATES }, uRound: { value: ROUND }, uRound2: { value: ROUND_INNER }, uPlate: { value: PLATE_GAP / 2 } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true })
        mats.current.push(mat)
        const m = new THREE.Mesh(geo, mat)
        m.position.copy(s.n).multiplyScalar(ext(s.n) / 2 + 0.5)
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(s.right, s.up, s.n))
        grp.add(m)
      })
      g.add(grp)
      return grp
    })
  }
  useEffect(() => {
    const g = root.current
    build(cw)
    return () => { groups.current.forEach((c) => g.remove(c)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, textures, liquid])
  useImperativeHandle(ref, () => ({
    busy: () => state.current.busy,
    next: () => new Promise<void>((resolve) => {
      const st = state.current
      if (st.busy) return resolve()
      st.busy = true
      const nextIx = (st.project + 1) % textures.length
      // print the next project on the stickers that will end up on the front, each one while it is hidden: simulate the
      // sequence on a copy, note when each sticker first leaves the front, and its in-plane offset at the end
      const sim = cloneCube(st.cube)
      const hiddenAt = new Map<number, number>()
      sim.forEach((cb) => cb.stickers.forEach((s) => { if (s.n.z !== 1) hiddenAt.set(s.id, -1) }))
      MOVES.forEach((mv, i) => { turn(sim, mv.axis, mv.layer, mv.dir); sim.forEach((cb) => cb.stickers.forEach((s) => { if (s.n.z !== 1 && !hiddenAt.has(s.id)) hiddenAt.set(s.id, i) })) })
      const stamp = new Map<number, { col: number; row: number; k: number; at: number }>()
      sim.forEach((cb) => cb.stickers.forEach((s) => {
        if (s.n.z !== 1) return
        const k = Math.round((Math.PI / 2 - Math.atan2(s.up.y, s.up.x)) / (Math.PI / 2))
        stamp.set(s.id, { col: cb.pos.x + 1, row: 1 - cb.pos.y, k, at: hiddenAt.get(s.id) ?? MOVES.length })
      }))
      const restamp = (step: number) => st.cube.forEach((cb) => cb.stickers.forEach((s) => {
        const p = stamp.get(s.id)
        if (!p || p.at !== step) return
        const q = new THREE.Quaternion().setFromAxisAngle(s.n, (p.k * Math.PI) / 2)
        round(s.up.applyQuaternion(q)); round(s.right.applyQuaternion(q))
        s.tex = nextIx; s.col = p.col; s.row = p.row
      }))
      restamp(-1)
      const depthFor = (axis: Move['axis']) => (axis === 'y' ? cw : ch)
      build(depthFor(MOVES[0].axis))
      const tl = gsap.timeline({ onComplete: () => { st.project = nextIx; st.busy = false; resolve() } })
      // the turns, one move after another: the move's layer hangs under a pivot at the cube's centre and rolls a quarter turn
      // (FEEL.screen: a speedcuber's hands); on landing the state takes the turn, hidden stickers get their print, and the cube
      // is rebuilt on the grid with the depth the next move's axis needs
      const feel = FEEL.screen
      const live: { pivot: THREE.Group | null; axis: Move['axis']; dir: number } = { pivot: null, axis: 'y', dir: 1 }
      MOVES.forEach((mv, k) => {
        const at = k * (feel.duration + STAGGER)
        tl.call(() => {
          build(depthFor(mv.axis))
          live.axis = mv.axis; live.dir = mv.dir
          const pivot = new THREE.Group()
          pivot.position.set(0, 0, -1.5 * st.depth)
          root.current.add(pivot)
          groups.current.filter((grp) => (grp.userData.cubie as Cubie).pos[mv.axis] === mv.layer).forEach((grp) => pivot.attach(grp))
          live.pivot = pivot
        }, [], at)
        const t = { p: 0 }
        tl.fromTo(t, { p: 0 }, { p: 1, duration: feel.duration, ease: 'none', onUpdate: () => { if (live.pivot) live.pivot.rotation[live.axis] = ((live.dir * Math.PI) / 2) * feel.f(t.p) } }, at)
        tl.call(() => {
          turn(st.cube, mv.axis, mv.layer, mv.dir)
          restamp(k)
          if (live.pivot) root.current.remove(live.pivot)
          build(depthFor(MOVES[k + 1]?.axis ?? mv.axis))
        }, [], at + feel.duration + 0.001)
      })
    }),
    setScale: (sx, sy) => root.current.scale.set(sx * EDGE, sy * EDGE, 1),
    setFace: (x, y, w, h) => { uni.current.face.set(x, y, w, h) },
    setFade: (k) => { uni.current.fade = k; mats.current.forEach((m) => { m.uniforms.uFade.value = k }) },
    setLive: (on) => { liveRef.current = on },
    setAlpha: (a) => { uni.current.alpha = a; mats.current.forEach((m) => { m.uniforms.uAlpha.value = a }) },
  }), [textures, W, H])
  return (
    <scene ref={scene}>
      <group ref={root} />
    </scene>
  )
})
