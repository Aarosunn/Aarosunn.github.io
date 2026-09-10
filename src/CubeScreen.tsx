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
import type { CubeVersion } from './transitionVersions'
import { FEEL } from './RubikMask'
import { SCHEMES } from './schemes'
import { pageTexture, PROJECTS, type ScreenHandle } from './ScreenSolve'

const FOV = 30
type Sticker = { tex: number; col: number; row: number; up: THREE.Vector3; right: THREE.Vector3; n: THREE.Vector3 }
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
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const pos = new THREE.Vector3(x, y, z)
    const stickers = FACES.map((f, tex) => ({ f, tex })).filter(({ f }) => pos.dot(v3(f.n)) === 1).map(({ f, tex }) => ({ tex, col: pos.dot(v3(f.right)) + 1, row: 1 - pos.dot(v3(f.up)), up: v3(f.up), right: v3(f.right), n: v3(f.n) }))
    out.push({ pos, stickers })
  }
  return out
}
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

const Cube = forwardRef<ScreenHandle, { v: CubeVersion; scheme: string }>(function Cube({ v, scheme }, ref) {
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
  const state = useRef({ cube: solvedCube(), busy: false, depth: cw })
  const groups = useRef<THREE.Group[]>([])
  const seams = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[]>([])
  const body = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0b0e13' }), [])
  /** the cubies as objects for the current state and depth (depth = the coming turn's axis extent) */
  const build = (depth: number) => {
    const g = root.current
    groups.current.forEach((c) => { c.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); if (o.material !== body) (o.material as THREE.Material).dispose() } }); g.remove(c) })
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
      const axis = v.moves[0].axis
      build(axis === 'y' ? cw : ch)
      const centre = new THREE.Vector3(0, 0, -1.5 * st.depth)
      const tl = gsap.timeline({ onComplete: () => { st.busy = false; resolve() } })
      // 1. the break: the gaps open and the seams light
      const gp = { g: 0 }
      seams.current.forEach((s) => { s.material.uniforms.uHeat.value = 1; s.material.uniforms.uBead.value = 0; s.material.uniforms.uR.value = 0 })
      tl.to(gp, { g: v.gap, duration: v.open, ease: 'power2.out', onUpdate: () => setGap(gp.g) }, 0)
      // 2. the layer turns: each layer's cubies under a pivot at the cube's centre, the pivot rolls a quarter turn
      let landed = v.open
      v.moves.forEach((mv, k) => {
        const at = v.open + k * (v.flip + v.stagger)
        mv.layers.forEach((layer) => {
          const pivot = new THREE.Group()
          pivot.position.copy(centre)
          tl.call(() => { root.current.add(pivot); groups.current.filter((grp) => (grp.userData.cubie as Cubie).pos[mv.axis] === layer).forEach((grp) => pivot.attach(grp)) }, [], at)
          tl.to(pivot.rotation, { [mv.axis]: (mv.dir * Math.PI) / 2, duration: v.flip, ease: (p: number) => FEEL.turn.f(p) }, at)
        })
        landed = at + v.flip
      })
      // 3. landed: the state takes the turns and the cube is rebuilt on the grid
      tl.call(() => { v.moves.forEach((mv) => mv.layers.forEach((layer) => turn(st.cube, mv.axis, layer, mv.dir))); root.current.children.filter((o) => o !== root.current && !groups.current.includes(o as THREE.Group) && !seams.current.includes(o as never)).forEach((p) => root.current.remove(p)); build(st.depth) }, [], landed + 0.02)
      // 4. the laser weld: three random points on the seams, rings growing until the grid is gone
      const pts = [0, 1, 2].map(() => { const onH = Math.random() < 0.5; const n = 1 + Math.floor(Math.random() * 2); const a = Math.random() - 0.5; return onH ? new THREE.Vector2(a * W, H / 2 - (n * H) / 3) : new THREE.Vector2(-W / 2 + (n * W) / 3, a * H) })
      const reach = Math.max(...pts.map((p) => Math.hypot(W / 2 + Math.abs(p.x), H / 2 + Math.abs(p.y)))) * 0.75
      const w0 = landed + 0.1
      tl.call(() => seams.current.forEach((s) => { s.material.uniforms.uP0.value.copy(pts[0]); s.material.uniforms.uP1.value.copy(pts[1]); s.material.uniforms.uP2.value.copy(pts[2]); s.material.uniforms.uBead.value = 1 }), [], w0)
      const r = { v: 0 }
      tl.to(r, { v: reach, duration: v.weld, ease: 'power1.out', onUpdate: () => seams.current.forEach((s) => { s.material.uniforms.uR.value = r.v }) }, w0)
      tl.to(gp, { g: 0, duration: v.weld, ease: 'power2.inOut', onUpdate: () => setGap(gp.g) }, w0)
      tl.call(() => seams.current.forEach((s) => { s.material.uniforms.uHeat.value = 0; s.material.uniforms.uBead.value = 0 }), [], w0 + v.weld)
    }),
  }), [v, textures, W, H])
  return <group ref={root} />
})

export const CubeScreen = forwardRef<ScreenHandle, { v: CubeVersion; scheme: string }>(function CubeScreen({ v, scheme }, ref) {
  return (
    <Canvas className="transition-canvas" dpr={[1, 2]} camera={{ fov: FOV, position: [0, 0, 1000] }} gl={{ antialias: true }}>
      <Cube ref={ref} v={v} scheme={scheme} />
    </Canvas>
  )
})
