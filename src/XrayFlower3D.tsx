/**
 * The x-ray floral as a mesh (path 2): the procedural flower rendered with a fresnel x-ray shader on additive
 * blending (faces see-through, silhouettes and edge-on geometry bright) plus a wire pass, in a transparent R3F
 * canvas; the technical layer is an SVG over it, laid out from the flower's anchors projected through the camera.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mulberry32 } from './Floral'
import type { Pt } from './Floral'
import type { FloralVersion } from './floralVersions'
import { TechLayer, XF_H, XF_W, layoutTech, readSwatches, type Tech } from './xrayTech'
import { SCHEMES } from './schemes'
import { buildFlower, type Flower } from './xrayMesh'

const VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }
`
// fresnel: faces are dark (see-through under additive blending), grazing angles bright
const FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uPower; uniform float uGain; uniform float uBase;
  varying vec3 vN; varying vec3 vV;
  void main() { float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower); gl_FragColor = vec4(uColor * (uBase + uGain * f), 1.0); }
`
const xray = (color: THREE.Color, power: number, gain: number, base: number, wireframe = false) =>
  new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uPower: { value: power }, uGain: { value: gain }, uBase: { value: base } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    wireframe,
  })

type Projected = { anchors: { name: string; p: Pt }[]; tips: Pt[]; leaves: Pt[][]; bud: Pt[]; centre: Pt; R: number }

function Plant({ f, v, colors, onProject }: { f: Flower; v: FloralVersion; colors: { a: THREE.Color; b: THREE.Color; bright: THREE.Color }; onProject: (p: Projected) => void }) {
  const { camera, size } = useThree()
  const fr = v.fresnel ?? { power: 2.2, gain: 1.0, base: 0.03 }
  const wire = v.wire ?? 0.16
  const mats = useMemo(() => {
    const petal = colors.a.clone().lerp(colors.bright, 0.45)
    return {
      petal: xray(petal, fr.power, fr.gain, fr.base),
      petalWire: xray(petal, fr.power, wire * 0.6, wire * 0.5, true),
      green: xray(colors.b, fr.power * 0.9, fr.gain * 0.9, fr.base * 1.5),
      greenWire: xray(colors.b, fr.power, wire * 0.8, wire * 0.7, true),
      stamen: new THREE.MeshBasicMaterial({ color: colors.b.clone().lerp(colors.bright, 0.3), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
      filament: new THREE.LineBasicMaterial({ color: colors.b, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
    }
  }, [colors, fr.power, fr.gain, fr.base, wire])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  const stamenMesh = useRef<THREE.InstancedMesh>(null!)
  useEffect(() => {
    const m = new THREE.Matrix4()
    f.stamens.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); stamenMesh.current.setMatrixAt(i, m) })
    stamenMesh.current.instanceMatrix.needsUpdate = true
  }, [f])
  const filaments = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pts: number[] = []
    const c = new THREE.Vector3(0, 0, 0.05).applyMatrix4(new THREE.Matrix4().compose(f.bloomCentre, new THREE.Quaternion().setFromEuler(f.bloomTilt), new THREE.Vector3(1, 1, 1)))
    f.stamens.forEach((p) => pts.push(c.x, c.y, c.z, p.x, p.y, p.z))
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [f])
  // project the anchors once the camera has its aspect
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    done.current = true
    const proj = (p: THREE.Vector3): Pt => { const q = p.clone().project(camera); return [((q.x + 1) / 2) * XF_W, ((1 - q.y) / 2) * XF_H] }
    const tips = f.bloom.filter((b) => b.part === 'petal').slice(0, 12).map((b) => proj(b.tip))
    const centre = proj(f.bloomCentre)
    const R = Math.max(...tips.map((t) => Math.hypot(t[0] - centre[0], t[1] - centre[1])))
    onProject({
      anchors: f.anchors.map((a) => ({ name: a.name, p: proj(a.p) })),
      tips, centre, R,
      leaves: f.leaves.map((l) => { const o = new THREE.Vector3().applyMatrix4(l.matrix); return [proj(o), proj(l.tip), proj(new THREE.Vector3(0.5, 0.22, 0).applyMatrix4(l.matrix)), proj(new THREE.Vector3(0.5, -0.22, 0).applyMatrix4(l.matrix))] }),
      bud: [proj(new THREE.Vector3().applyMatrix4(f.bud.matrix)), proj(f.bud.tip), proj(new THREE.Vector3(0.17, 0.25, 0).applyMatrix4(f.bud.matrix)), proj(new THREE.Vector3(-0.17, 0.25, 0).applyMatrix4(f.bud.matrix))],
    })
  })
  useEffect(() => { done.current = false }, [size.width, size.height, f])
  return (
    <group>
      {f.bloom.map((p, i) => (
        <group key={i} matrixAutoUpdate={false} matrix={p.matrix}>
          <mesh geometry={p.geometry} material={mats.petal} />
          {wire > 0 && <mesh geometry={p.geometry} material={mats.petalWire} />}
        </group>
      ))}
      <instancedMesh ref={stamenMesh} args={[undefined, undefined, f.stamens.length]} material={mats.stamen}>
        <sphereGeometry args={[0.02, 6, 6]} />
      </instancedMesh>
      <lineSegments geometry={filaments} material={mats.filament} />
      <mesh geometry={f.stem} material={mats.green} />
      {wire > 0 && <mesh geometry={f.stem} material={mats.greenWire} />}
      <mesh geometry={f.branch} material={mats.green} />
      {f.leaves.map((l, i) => (
        <group key={i} matrixAutoUpdate={false} matrix={l.matrix}>
          <mesh geometry={l.geometry} material={mats.green} />
          {wire > 0 && <mesh geometry={l.geometry} material={mats.greenWire} />}
        </group>
      ))}
      <group matrixAutoUpdate={false} matrix={f.bud.matrix}>
        <mesh geometry={f.bud.geometry} material={mats.petal} />
        {wire > 0 && <mesh geometry={f.bud.geometry} material={mats.petalWire} />}
      </group>
    </group>
  )
}

export function XrayFlower3D({ v, seed = 3, width = XF_W, height = XF_H, className, scheme }: { v: FloralVersion; seed?: number; width?: number; height?: number; className?: string; scheme?: string }) {
  const f = useMemo(() => buildFlower(seed), [seed])
  useEffect(() => () => f.dispose(), [f])
  // colours from the scheme table, not the CSS variables: on the site this mounts before App has applied them
  const colors = useMemo(() => { const sc = SCHEMES.find((x) => x.name === scheme) ?? SCHEMES[0]; return { a: new THREE.Color(sc.a), b: new THREE.Color(sc.b), bright: new THREE.Color(sc.bright) } }, [scheme])
  const [proj, setProj] = useState<Projected | null>(null)
  const tech: Tech | null = useMemo(() => {
    if (!proj) return null
    const rng = mulberry32(seed * 31 + 5)
    return layoutTech(v, rng, { anchors: proj.anchors, cx: proj.centre[0], cy: proj.centre[1], R: proj.R, tilt: 0.8, bloomPts: proj.tips, parts: [proj.bud, ...proj.leaves] })
  }, [proj, v, seed])
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const live = v.coords === 'live' && !reduced
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => setTick((n) => n + 1), 700)
    return () => clearInterval(t)
  }, [live])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const swatches = useMemo(() => readSwatches(v), [v.swatches, scheme])
  return (
    <div className={`xf3d ${className ?? ''}`} style={{ position: 'relative', width, height }}>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 6.8], fov: 30 }} gl={{ antialias: true, alpha: true }} style={{ position: 'absolute', inset: 0 }} frameloop="demand">
        <Plant f={f} v={v} colors={colors} onProject={setProj} />
      </Canvas>
      <svg viewBox={`0 0 ${XF_W} ${XF_H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {tech && <TechLayer v={v} g={tech} tick={tick} swatches={swatches} />}
      </svg>
    </div>
  )
}
