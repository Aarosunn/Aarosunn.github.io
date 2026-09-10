/**
 * The screen as a cube: nine tiles fill the viewport carrying one project between them, welded into one surface.
 * `next()` cuts the seams open, flips the tiles one or two at a time in the version's order (each a quarter turn
 * about its own row or column axis, the next project's fragment riding in on the incoming face), then runs a weld
 * bead along the seams and cools the scars away.
 */
import { useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import type { SolveVersion } from './transitionVersions'
import { FEEL } from './RubikMask'
import { SCHEMES } from './schemes'

export type ScreenHandle = { next: () => Promise<void>; busy: () => boolean }
const FOV = 30

/** placeholder projects, one page each */
export const PROJECTS = [
  { title: 'aarcube', meta: 'code · 2026', blurb: 'paper shaders on a Rubik\'s cube. the cube is the menu, the menu is the cube.' },
  { title: 'synth voice', meta: 'hardware · 2025', blurb: 'a wavetable voice on an FPGA, four oscillators, one very hot chip.' },
  { title: 'title sequence', meta: 'creatives · 2025', blurb: 'a TouchDesigner title sequence cut to a track nobody has heard yet.' },
  { title: 'small runtime', meta: 'code · 2025', blurb: 'a language runtime small enough to read in an afternoon.' },
  { title: 'camera rig', meta: 'hardware · 2026', blurb: 'a hand-tracking camera rig that knows which finger is which.' },
  { title: 'ascii portrait', meta: 'creatives · 2026', blurb: 'a portrait in text that watches back.' },
]
/** one project drawn as a page at the viewport's size */
export function pageTexture(p: (typeof PROJECTS)[number], w: number, h: number, colors: { bg: string; text: string; bright: string; mute: string; a: string }) {
  const c = document.createElement('canvas')
  const s = 2
  c.width = w * s; c.height = h * s
  const g = c.getContext('2d')!
  g.scale(s, s)
  g.fillStyle = colors.bg; g.fillRect(0, 0, w, h)
  // a hero block on the right with a faint grid, like a placeholder still
  const portrait = h > w
  const hero = portrait ? { x: w * 0.08, y: h * 0.42, w: w * 0.84, h: h * 0.4 } : { x: w * 0.52, y: h * 0.16, w: w * 0.4, h: h * 0.62 }
  g.fillStyle = '#0e1219'; g.fillRect(hero.x, hero.y, hero.w, hero.h)
  g.strokeStyle = colors.a + '55'; g.lineWidth = 1
  for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(hero.x + (hero.w * i) / 8, hero.y); g.lineTo(hero.x + (hero.w * i) / 8, hero.y + hero.h); g.stroke() }
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(hero.x, hero.y + (hero.h * i) / 6); g.lineTo(hero.x + hero.w, hero.y + (hero.h * i) / 6); g.stroke() }
  g.fillStyle = colors.a; g.beginPath(); g.arc(hero.x + hero.w * 0.5, hero.y + hero.h * 0.5, Math.min(hero.w, hero.h) * 0.18, 0, Math.PI * 2); g.fill()
  const left = w * 0.08
  const top = portrait ? h * 0.14 : h * 0.3
  g.fillStyle = colors.mute; g.font = `400 ${portrait ? 12 : 13}px "Geist Mono", ui-monospace, monospace`
  g.fillText(p.meta, left, top)
  g.fillStyle = colors.bright; g.font = `300 ${portrait ? 40 : 64}px Unbounded, sans-serif`
  g.fillText(p.title, left - 2, top + (portrait ? 54 : 84))
  g.fillStyle = colors.text; g.font = `400 ${portrait ? 13 : 15}px "Geist Mono", ui-monospace, monospace`
  // wrap the blurb
  const words = p.blurb.split(' '); const maxW = portrait ? w * 0.84 : w * 0.36; let line = ''; let y = top + (portrait ? 92 : 130)
  for (const wd of words) { const t = line ? `${line} ${wd}` : wd; if (g.measureText(t).width > maxW) { g.fillText(line, left, y); line = wd; y += 22 } else line = t }
  g.fillText(line, left, y)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  return tex
}

const BEAD_VERT = /* glsl */ `varying vec2 vUv; varying vec2 vPos; void main() { vUv = uv; vPos = (modelMatrix * vec4(position, 1.0)).xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
// a seam: a faint scar (uHeat) plus a hot bead at uT along the seam with a trailing glow
const BEAD_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uHeat; uniform float uT; uniform float uBead;
  uniform float uLaser; uniform vec2 uP0; uniform vec2 uP1; uniform vec2 uP2; uniform float uR;
  varying vec2 vUv; varying vec2 vPos;
  void main() {
    float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
    float scar; float hot;
    if (uLaser < 0.5) {
      float d = vUv.x - uT;
      float bead = exp(-d * d * 900.0) * 2.2 + exp(-max(-d, 0.0) * 12.0) * step(0.0, -d) * 0.9;
      scar = uHeat * 0.22 * edge; hot = uBead * bead * edge;
    } else {
      // laser: the nearest of three points; inside its ring the seam is gone, at the ring it is white-hot
      float d = min(distance(vPos, uP0), min(distance(vPos, uP1), distance(vPos, uP2)));
      float front = exp(-pow((d - uR) / 22.0, 2.0)) * 1.6 + exp(-max(d - uR, 0.0) / 60.0) * 0.5;
      float un = smoothstep(uR - 4.0, uR + 4.0, d);
      scar = uHeat * 0.22 * edge * un; hot = uBead * front * edge * un * 1.6;
    }
    gl_FragColor = vec4(uColor * (scar + hot) + vec3(hot * hot * 0.5), 1.0);
  }
`

type Tile = { pivot: THREE.Group; front: THREE.Mesh; side: THREE.Mesh; i: number; j: number }
type Seam = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; dir: 'h' | 'v' }

/** the tile grid and seams, built for the viewport size; the handle runs the solve */
const Grid = forwardRef<ScreenHandle, { v: SolveVersion; scheme: string }>(function Grid({ v, scheme }, ref) {
  const { size, camera } = useThree()
  const W = size.width, H = size.height
  const colors = useMemo(() => { const sc = SCHEMES.find((x) => x.name === scheme) ?? SCHEMES[0]; return { bg: '#0b0e13', text: '#c9cdd8', bright: '#f2f3f7', mute: '#6b7185', a: sc.a } }, [scheme])
  // the z=0 plane maps to the viewport exactly: world units are CSS pixels
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = FOV; cam.position.set(0, 0, H / 2 / Math.tan((FOV * Math.PI) / 360)); cam.near = 1; cam.far = cam.position.z * 4; cam.updateProjectionMatrix()
  }, [camera, H])
  const textures = useMemo(() => PROJECTS.map((p) => pageTexture(p, W, H, colors)), [W, H, colors])
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures])
  const state = useRef({ project: 0, busy: false, gap: 0 })
  const tiles = useRef<Tile[]>([])
  const seams = useRef<Seam[]>([])
  const root = useRef<THREE.Group>(null!)
  // geometry: a cell's plane with its UV window into the page
  const cellGeo = (i: number, j: number, w: number, h: number) => {
    const g = new THREE.PlaneGeometry(w, h)
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (i + uv.getX(k)) / 3, (2 - j + uv.getY(k)) / 3)
    return g
  }
  const armed = useRef(new Map<Tile, boolean>())
  /** the incoming face sits a tile away on the axis it rotates in on: below for an upward flip (`up`), right for a sideways one */
  const arm = (t: Tile, up: boolean, cw: number, ch: number) => {
    armed.current.set(t, up)
    t.front.position.set(0, 0, up ? ch / 2 : cw / 2)
    if (up) { t.side.position.set(0, -ch / 2, 0); t.side.rotation.set(Math.PI / 2, 0, 0) } else { t.side.position.set(cw / 2, 0, 0); t.side.rotation.set(0, Math.PI / 2, 0) }
    t.pivot.position.z = -(up ? ch / 2 : cw / 2)
  }
  /** lay the tiles out for a gap (px); the seam quads sit in the gaps */
  const layout = (gap: number) => {
    state.current.gap = gap
    const cw = (W - 2 * gap) / 3, ch = (H - 2 * gap) / 3
    tiles.current.forEach((t) => {
      t.pivot.position.set(-W / 2 + cw / 2 + t.i * (cw + gap), H / 2 - ch / 2 - t.j * (ch + gap), 0)
      t.front.scale.set(cw / (W / 3), ch / (H / 3), 1)
      t.side.scale.copy(t.front.scale)
      arm(t, armed.current.get(t) ?? ((t.i + t.j) % 2 === 0), cw, ch)
    })
    seams.current.forEach((s, k) => {
      const n = (k % 2) + 1
      if (s.dir === 'h') { s.mesh.position.set(0, H / 2 - n * ch - (n - 0.5) * gap, -1); s.mesh.scale.set(W, Math.max(gap, 1), 1) } else { s.mesh.position.set(-W / 2 + n * cw + (n - 0.5) * gap, 0, -1); s.mesh.scale.set(Math.max(gap, 1), H, 1); s.mesh.rotation.z = Math.PI / 2; s.mesh.scale.set(H, Math.max(gap, 1), 1) }
      s.mesh.visible = gap > 0
    })
  }
  // build the tiles and seams once per size
  useEffect(() => {
    const g = root.current
    const made: Tile[] = []
    const cw = W / 3, ch = H / 3
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const pivot = new THREE.Group()
      const front = new THREE.Mesh(cellGeo(i, j, cw, ch), new THREE.MeshBasicMaterial({ map: textures[state.current.project % 3] }))
      const side = new THREE.Mesh(cellGeo(i, j, cw, ch), new THREE.MeshBasicMaterial({ map: textures[(state.current.project + 1) % 3] }))
      pivot.add(front, side)
      g.add(pivot)
      made.push({ pivot, front, side, i, j })
    }
    tiles.current = made
    const col = new THREE.Color(colors.a)
    seams.current = (['h', 'h', 'v', 'v'] as const).map((dir) => {
      const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: col }, uHeat: { value: 0 }, uT: { value: -1 }, uBead: { value: 0 }, uLaser: { value: 0 }, uP0: { value: new THREE.Vector2() }, uP1: { value: new THREE.Vector2() }, uP2: { value: new THREE.Vector2() }, uR: { value: 0 } }, vertexShader: BEAD_VERT, fragmentShader: BEAD_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
      g.add(mesh)
      return { mesh, mat, dir }
    })
    layout(0)
    return () => { made.forEach((t) => { t.front.geometry.dispose(); t.side.geometry.dispose(); (t.front.material as THREE.Material).dispose(); (t.side.material as THREE.Material).dispose(); g.remove(t.pivot) }); seams.current.forEach((s) => { s.mat.dispose(); s.mesh.geometry.dispose(); g.remove(s.mesh) }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, textures, colors.a])
  useImperativeHandle(ref, () => ({
    busy: () => state.current.busy,
    next: () => new Promise<void>((resolve) => {
      if (state.current.busy) return resolve()
      state.current.busy = true
      const st = state.current
      const nextIx = (st.project + 1) % PROJECTS.length
      tiles.current.forEach((t) => { (t.side.material as THREE.MeshBasicMaterial).map = textures[nextIx]; (t.side.material as THREE.Material).needsUpdate = true })
      const cw = (W - 2 * v.gap) / 3, ch = (H - 2 * v.gap) / 3
      const tl = gsap.timeline({ onComplete: () => { st.project = nextIx; st.busy = false; resolve() } })
      const gapProxy = { g: 0 }
      // 1. the break-apart: the seams appear at once, or open over a beat
      seams.current.forEach((s) => { s.mat.uniforms.uHeat.value = 1; s.mat.uniforms.uBead.value = 0; s.mat.uniforms.uT.value = -1; s.mat.uniforms.uLaser.value = v.laser ? 1 : 0; s.mat.uniforms.uR.value = 0 })
      if (v.open) tl.to(gapProxy, { g: v.gap, duration: v.open, ease: 'power2.out', onUpdate: () => layout(gapProxy.g) }, 0)
      else { gapProxy.g = v.gap; layout(v.gap) }
      const open = v.open ?? 0
      const land = (t: Tile) => { t.pivot.rotation.set(0, 0, 0); (t.front.material as THREE.MeshBasicMaterial).map = textures[nextIx]; (t.front.material as THREE.Material).needsUpdate = true }
      const feel = (p: number) => FEEL.turn.f(p)
      let landed = open
      if (v.moves) {
        // 2a. layer moves: every tile of a row rolls up together, of a column sideways, one move after another
        v.moves.forEach((move, k) => {
          const at = open + k * (v.flip + v.stagger)
          move.forEach((layer) => {
            const row = layer[0] === 'r', n = +layer[1]
            tiles.current.filter((t) => (row ? t.j : t.i) === n).forEach((t) => {
              tl.call(() => arm(t, row, cw, ch), [], at)
              tl.to(t.pivot.rotation, { [row ? 'x' : 'y']: -Math.PI / 2, duration: v.flip, ease: feel }, at)
              tl.call(() => land(t), [], at + v.flip)
            })
          })
          landed = at + v.flip
        })
      } else {
        // 2b. single tiles, one or two in motion at a time, in the version's order
        v.order.forEach((cell, k) => {
          const t = tiles.current[cell]
          const up = (t.i + t.j) % 2 === 0
          const at = open + k * v.stagger
          tl.to(t.pivot.rotation, { [up ? 'x' : 'y']: -Math.PI / 2, duration: v.flip, ease: 'power2.inOut' }, at)
          tl.call(() => land(t), [], at + v.flip)
        })
        landed = open + (v.order.length - 1) * v.stagger + v.flip
      }
      if (v.laser) {
        // 3a. laser weld: three random points on the seams, rings growing until the grid is gone; the gap closes with them
        const pts = [0, 1, 2].map(() => { const onH = Math.random() < 0.5; const n = 1 + Math.floor(Math.random() * 2); const a = (Math.random() - 0.5); return onH ? new THREE.Vector2(a * W, H / 2 - (n * H) / 3) : new THREE.Vector2(-W / 2 + (n * W) / 3, a * H) })
        const reach = Math.max(...pts.map((p) => Math.max(Math.hypot(W / 2 + Math.abs(p.x), H / 2 + Math.abs(p.y))))) * 0.75
        const weld = v.weld ?? 0.9
        tl.call(() => seams.current.forEach((s) => { s.mat.uniforms.uP0.value.copy(pts[0]); s.mat.uniforms.uP1.value.copy(pts[1]); s.mat.uniforms.uP2.value.copy(pts[2]); s.mat.uniforms.uBead.value = 1 }), [], landed + 0.05)
        const r = { v: 0 }
        tl.to(r, { v: reach, duration: weld, ease: 'power1.out', onUpdate: () => seams.current.forEach((s) => { s.mat.uniforms.uR.value = r.v }) }, landed + 0.05)
        tl.to(gapProxy, { g: 0, duration: weld, ease: 'power2.inOut', onUpdate: () => layout(gapProxy.g) }, landed + 0.05)
        tl.call(() => seams.current.forEach((s) => { s.mat.uniforms.uHeat.value = 0; s.mat.uniforms.uBead.value = 0 }), [], landed + 0.05 + weld)
      } else {
        // 3b. the weld: a bead runs the horizontal seams, then the vertical ones; the scars cool as the gaps close
        seams.current.forEach((s) => {
          const at = landed + (s.dir === 'h' ? 0 : v.bead)
          tl.set(s.mat.uniforms.uBead, { value: 1 }, at)
          tl.fromTo(s.mat.uniforms.uT, { value: 0 }, { value: 1, duration: v.bead, ease: 'none' }, at)
          tl.to(s.mat.uniforms.uBead, { value: 0, duration: 0.15 }, at + v.bead)
          tl.to(s.mat.uniforms.uHeat, { value: 0, duration: v.cool, ease: 'power2.in' }, at + v.bead)
        })
        tl.to(gapProxy, { g: 0, duration: v.cool * 0.7, ease: 'power2.inOut', onUpdate: () => layout(gapProxy.g) }, landed + v.bead)
      }
    }),
  }), [v, textures, W, H])
  return <group ref={root} />
})

export const ScreenSolve = forwardRef<ScreenHandle, { v: SolveVersion; scheme: string }>(function ScreenSolve({ v, scheme }, ref) {
  return (
    <Canvas className="transition-canvas" dpr={[1, 2]} camera={{ fov: FOV, position: [0, 0, 1000] }} gl={{ antialias: true }}>
      <Grid ref={ref} v={v} scheme={scheme} />
    </Canvas>
  )
})
