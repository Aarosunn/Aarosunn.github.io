/**
 * The x-ray floral as a mesh: the procedural flower with a fresnel x-ray shader on additive blending (faces
 * see-through, silhouettes and edge-on geometry bright, an optional thin-film sheen) plus a wire pass, in a
 * transparent R3F canvas. The bloom is the subject: stem, leaves and bud render on a second canvas underneath that
 * is blurred and dimmed with CSS. The technical layer (when a version asks for it) is an SVG over both, laid out
 * from the flower's anchors projected through the camera.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mulberry32 } from './Floral'
import type { Pt } from './Floral'
import type { FloralVersion } from './floralVersions'
import { TechLayer, XF_H, XF_W, layoutTech, readSwatches, type Tech } from './xrayTech'
import { SCHEMES } from './schemes'
import { FLOWER_OF, buildFlower, type Flower } from './xrayMesh'

const VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main() {
    vec4 p = vec4(position, 1.0); vec3 n = normal;
    #ifdef USE_INSTANCING
      p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
    #endif
    vec4 mv = modelViewMatrix * p; vN = normalize(normalMatrix * n); vV = normalize(-mv.xyz); vP = p.xyz; gl_Position = projectionMatrix * mv;
  }
`
// fresnel: faces dark (see-through under additive blending), grazing angles bright; body colour to rim colour
// along the fresnel; a thin-film sheen rolls the hue with the view angle
const FRAG = /* glsl */ `
  uniform vec3 uColor; uniform vec3 uRim; uniform float uPower; uniform float uGain; uniform float uBase; uniform float uIrid;
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main() {
    float d = abs(dot(normalize(vN), normalize(vV)));
    float f = pow(1.0 - d, uPower);
    vec3 col = mix(uColor, uRim, f);
    vec3 sheen = 0.5 + 0.5 * cos(6.2831 * (d * 1.4 + vec3(0.0, 0.33, 0.67)) + vP.x * 2.5 + vP.y * 1.5);
    col = mix(col, col * (0.55 + 1.1 * sheen), uIrid);
    gl_FragColor = vec4(col * (uBase + uGain * f), 1.0);
  }
`
type Fresnel = { power: number; gain: number; base: number }
const xray = (color: THREE.Color, rim: THREE.Color, fr: Fresnel, irid: number, wireframe = false) =>
  new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uRim: { value: rim }, uPower: { value: fr.power }, uGain: { value: fr.gain }, uBase: { value: fr.base }, uIrid: { value: irid } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    wireframe,
  })

type Colors = { petal: THREE.Color; rim: THREE.Color; centre: THREE.Color; green: THREE.Color; bright: THREE.Color }
type Projected = { anchors: { name: string; p: Pt }[]; tips: Pt[]; leaves: Pt[][]; bud: Pt[]; centre: Pt; R: number }

function Bloom({ f, v, colors, onProject, gainMul = 1, wireMul = 1 }: { f: Flower; v: FloralVersion; colors: Colors; onProject?: (p: Projected) => void; gainMul?: number; wireMul?: number }) {
  const { camera, size } = useThree()
  const fr0 = v.fresnel ?? { power: 3, gain: 0.85, base: 0.012 }
  const fr = { power: fr0.power, gain: fr0.gain * gainMul, base: fr0.base * gainMul }
  const wire = (v.wire ?? 0.14) * wireMul
  const irid = v.irid ?? 0
  const mats = useMemo(
    () => ({
      // inner layers dimmer: many petals stack under additive blending, or the core goes white
      petal: [0, 1, 2, 3].map((l) => xray(colors.petal, colors.rim, { power: fr.power, gain: fr.gain * (1 - 0.28 * l), base: fr.base / (1 + 2 * l) }, irid)),
      petalWire: [0, 1, 2, 3].map((l) => xray(colors.petal, colors.rim, { power: fr.power, gain: (wire * 0.6) / (1 + 0.6 * l), base: (wire * 0.5) / (1 + 0.6 * l) }, irid * 0.5, true)),
      // stamens in the same x-ray as the petals: small translucent rings, not solid discs
      dot: xray(colors.centre, colors.rim, { power: 1.6, gain: 0.9 * (v.centreGlow ?? 1) * gainMul, base: 0.04 * (v.centreGlow ?? 1) * gainMul }, irid * 0.5),
      stemTop: xray(colors.green, colors.green.clone().lerp(colors.bright, 0.5), { power: fr.power * 0.9, gain: fr.gain * 0.9, base: fr.base * 1.5 }, 0),
      filament: new THREE.LineBasicMaterial({ color: colors.centre, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }),
    }),
    [colors, fr.power, fr.gain, fr.base, wire, irid, v.centreGlow, gainMul],
  )
  useEffect(() => () => Object.values(mats).flat().forEach((m) => m.dispose()), [mats])
  const dots = useRef<THREE.InstancedMesh>(null!)
  useEffect(() => {
    const m = new THREE.Matrix4()
    f.dots.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); dots.current?.setMatrixAt(i, m) })
    if (dots.current) dots.current.instanceMatrix.needsUpdate = true
  }, [f])
  const filaments = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(f.filaments.flatMap((p) => [p.x, p.y, p.z]), 3))
    return g
  }, [f])
  const done = useRef(false)
  useEffect(() => { done.current = false }, [size.width, size.height, f, onProject])
  useFrame(() => {
    if (done.current || !onProject) return
    done.current = true
    const proj = (p: THREE.Vector3): Pt => { const q = p.clone().project(camera); return [((q.x + 1) / 2) * XF_W, ((1 - q.y) / 2) * XF_H] }
    const tips = f.bloom.slice(0, 12).map((b) => proj(b.tip))
    const centre = proj(f.bloomCentre)
    const R = Math.max(...tips.map((t) => Math.hypot(t[0] - centre[0], t[1] - centre[1])))
    const anchors = [
      { name: 'object.flower', p: centre },
      ...f.leaves.map((l, i) => ({ name: `leaf.0${i + 1}`, p: proj(l.tip) })),
      ...(f.bud ? [{ name: 'bud.png', p: proj(f.bud.tip) }] : []),
      ...tips.filter((_, i) => i % 2 === 0).slice(0, 4).map((p, i) => ({ name: `petal.0${i + 1}`, p })),
    ]
    onProject({
      anchors, tips, centre, R,
      leaves: f.leaves.map((l) => [proj(new THREE.Vector3().applyMatrix4(l.matrix)), proj(l.tip), proj(new THREE.Vector3(0.5, 0.22, 0).applyMatrix4(l.matrix)), proj(new THREE.Vector3(0.5, -0.22, 0).applyMatrix4(l.matrix))]),
      bud: f.bud ? [proj(new THREE.Vector3().applyMatrix4(f.bud.matrix)), proj(f.bud.tip), proj(new THREE.Vector3(0.17, 0.25, 0).applyMatrix4(f.bud.matrix)), proj(new THREE.Vector3(-0.17, 0.25, 0).applyMatrix4(f.bud.matrix))] : [centre],
    })
  })
  return (
    <group>
      {f.bloom.map((p, i) => (
        <group key={i} matrixAutoUpdate={false} matrix={p.matrix}>
          <mesh geometry={p.geometry} material={mats.petal[p.layer ?? 0]} />
          {wire > 0 && <mesh geometry={p.geometry} material={mats.petalWire[p.layer ?? 0]} />}
        </group>
      ))}
      {f.dots.length > 0 && (
        <instancedMesh ref={dots} args={[undefined, undefined, f.dots.length]} material={mats.dot}>
          <sphereGeometry args={[f.dotR * 1.3, 10, 8]} />
        </instancedMesh>
      )}
      {f.filaments.length > 0 && <lineSegments geometry={filaments} material={mats.filament} />}
      {v.foliage !== false && <mesh geometry={f.stemTop} material={mats.stemTop} />}
    </group>
  )
}

function Foliage({ f, v, colors, gainMul = 1 }: { f: Flower; v: FloralVersion; colors: Colors; gainMul?: number }) {
  const fr0 = v.fresnel ?? { power: 3, gain: 0.85, base: 0.012 }
  const fr = { power: fr0.power, gain: fr0.gain * gainMul, base: fr0.base * gainMul }
  const wire = v.wire ?? 0.14
  const mats = useMemo(
    () => ({
      green: xray(colors.green, colors.green.clone().lerp(colors.bright, 0.5), { power: fr.power * 0.9, gain: fr.gain * 0.9, base: fr.base * 1.5 }, 0),
      greenWire: xray(colors.green, colors.green, { power: fr.power, gain: wire * 0.8, base: wire * 0.7 }, 0, true),
      bud: xray(colors.petal.clone().lerp(colors.green, 0.35), colors.rim, { power: fr.power * 0.8, gain: fr.gain * 1.3, base: fr.base * 2 }, v.irid ?? 0),
      budWire: xray(colors.green.clone().lerp(colors.bright, 0.3), colors.rim, { power: fr.power, gain: wire * 1.2, base: wire * 0.9 }, 0, true),
    }),
    [colors, fr.power, fr.gain, fr.base, wire, v.irid],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  return (
    <group>
      <mesh geometry={f.stem} material={mats.green} />
      {wire > 0 && <mesh geometry={f.stem} material={mats.greenWire} />}
      {f.branch && <mesh geometry={f.branch} material={mats.green} />}
      {f.leaves.map((l, i) => (
        <group key={i} matrixAutoUpdate={false} matrix={l.matrix}>
          <mesh geometry={l.geometry} material={mats.green} />
          {wire > 0 && <mesh geometry={l.geometry} material={mats.greenWire} />}
        </group>
      ))}
      {f.bud && (
        <group matrixAutoUpdate={false} matrix={f.bud.matrix}>
          <mesh geometry={f.bud.geometry} material={mats.bud} />
          {wire > 0 && <mesh geometry={f.bud.geometry} material={mats.budWire} />}
        </group>
      )}
    </group>
  )
}

const hasTech = (v: FloralVersion) => v.labels || v.coords !== 'off' || v.frame !== 'off' || v.arcs || v.ruler || v.measures || v.swatches || v.specks > 0

type V3 = [number, number, number]
type Planted = { f: Flower; position: V3; scale: number; gain: number; wire?: number; rotation?: V3; offset?: V3 }
const GROUND = -1.35
/** the scene: the version's flowers spread along x with a little depth, front ones larger, each rooted on the ground */
function plant(v: FloralVersion, seed: number, spread = 8.6): Planted[] {
  // an exact arrangement: each bloom centred on its point, rotated about that centre
  if (v.scene?.place) return v.scene.place.map((p, i) => {
    const f = buildFlower(p.seed ?? i + 1, FLOWER_OF(p.flower), true, v.buds !== false, 1, v.pollen !== false)
    return { f, position: p.at, scale: p.scale, gain: p.gain ?? 1, wire: p.wire, rotation: p.rot, offset: [-f.bloomCentre.x, -f.bloomCentre.y, -f.bloomCentre.z] }
  })
  const names = v.scene?.flowers ?? []
  const layers = v.scene?.layers ?? 1
  const rng = mulberry32(seed * 7907 + 11)
  // enough plants per layer to fill the width, the list repeating; a scene with its own spread plants its list once
  const n = v.scene?.spread ? names.length : Math.max(names.length, Math.round((spread / 1.25) * (v.scene?.density ?? 1)))
  const hm = v.scene?.height ?? 1
  const out: Planted[] = []
  // back layers first (small, far), each layer its own seed and a shuffled order, so kinds overlap across depth
  for (let l = 0; l < layers; l++) {
    const shuffled = [...names].sort(() => rng() - 0.5)
    const order = Array.from({ length: n }, (_, i) => shuffled[i % shuffled.length])
    const zc = layers === 1 ? 0 : -1.4 + (l / (layers - 1)) * 2.2
    const depth = layers === 1 ? 1 : l / (layers - 1) // 0 back .. 1 front
    order.forEach((name, i) => {
      const f = buildFlower(seed + i * 17 + l * 101, FLOWER_OF(name), true, v.buds !== false, 0.65 + rng() * 0.7, v.pollen !== false)
      f.stem.computeBoundingBox()
      const baseY = f.stem.boundingBox!.min.y
      const z = zc + (rng() - 0.5) * 0.5
      const scale = (0.36 + 0.4 * depth) * (0.85 + rng() * 0.3) * hm
      const x = -spread / 2 + (i + 0.5 + (l % 2) * 0.5) * (spread / n) + (rng() - 0.5) * 0.8
      out.push({ f, position: [x, GROUND - baseY * scale, z], scale, gain: 0.55 + 0.45 * depth })
    })
  }
  return out
}
function Ground({ color }: { color: THREE.Color }) {
  const geo = useMemo(() => {
    const pts: number[] = []
    for (let i = -30; i <= 30; i++) pts.push(i * 0.5, GROUND, -3, i * 0.5, GROUND, 2)
    for (let j = 0; j <= 10; j++) pts.push(-15, GROUND, -3 + j * 0.5, 15, GROUND, -3 + j * 0.5)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }), [color])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  return <lineSegments geometry={geo} material={mat} />
}
function Look({ at }: { at: [number, number, number] }) {
  const { camera } = useThree()
  useEffect(() => { camera.lookAt(...at) }, [camera, at])
  return null
}

export function XrayFlower3D({ v, flower = 'poppy', seed = 3, width = XF_W, height = XF_H, className, scheme: pageScheme, upright = false }: { v: FloralVersion; flower?: string; seed?: number; width?: number; height?: number | string; className?: string; scheme?: string; upright?: boolean }) {
  const scheme = v.scheme ?? pageScheme
  const spec = FLOWER_OF(flower)
  const f = useMemo(() => buildFlower(seed, spec, upright, v.buds !== false, 1, v.pollen !== false), [seed, spec, upright, v.buds, v.pollen])
  useEffect(() => () => f.dispose(), [f])
  // the bed fills the box: its width in world units at the ground from the camera distance and the box's aspect
  const strip = v.placement === 'bottom'
  const camDist = strip ? 6.4 : v.scene?.camDist ?? 9.4
  const spread = strip ? 2 * camDist * Math.tan((30 * Math.PI) / 360) * (width / (typeof height === 'number' ? height : XF_H)) * 0.95 : v.scene?.spread ?? 8.6
  const planted = useMemo(() => (v.scene ? plant(v, seed, spread) : []), [v, seed, spread])
  useEffect(() => () => planted.forEach((p) => p.f.dispose()), [planted])
  // colours from the scheme table (on the site this mounts before App has applied the CSS variables);
  // 'spectral' takes the flower's own palette, 'mono' the scheme's ghost blue / white
  const colors = useMemo<Colors>(() => {
    const sc = SCHEMES.find((x) => x.name === scheme) ?? SCHEMES[0]
    const bright = new THREE.Color(sc.bright)
    if (v.tint === 'spectral') return { petal: new THREE.Color(spec.palette[0]), rim: new THREE.Color(spec.palette[1]), centre: new THREE.Color(spec.palette[2]), green: new THREE.Color(sc.b), bright }
    return { petal: new THREE.Color(sc.a).lerp(bright, v.petalWhite ?? 0.45), rim: new THREE.Color(sc.a).lerp(bright, v.rimWhite ?? 1), centre: new THREE.Color(sc.b).lerp(bright, 0.3), green: new THREE.Color(sc.b), bright }
  }, [scheme, v.tint, spec, v.petalWhite, v.rimWhite])
  const [proj, setProj] = useState<Projected | null>(null)
  const tech: Tech | null = useMemo(() => {
    if (!proj || !hasTech(v)) return null
    return layoutTech(v, mulberry32(seed * 31 + 5), { anchors: proj.anchors, cx: proj.centre[0], cy: proj.centre[1], R: proj.R, tilt: 0.8, bloomPts: proj.tips, parts: [proj.bud, ...proj.leaves] })
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
  const scene = !!v.scene
  const cam = { position: (scene ? [0, strip ? 1.0 : 1.1, camDist] : [0, 0, upright ? 4.9 : 6.8]) as [number, number, number], fov: 30 }
  // a hand-placed group sits a little higher in its box (its lowest petals were cut by the site's base row)
  const lookAt: [number, number, number] = [0, strip ? 0.05 : v.scene?.place ? -0.36 : -0.25, 0]
  const blur = v.blur ?? 0
  return (
    <div className={`xf3d ${className ?? ''}`} style={{ position: 'relative', width, height }}>
      <Canvas dpr={[1, 2]} camera={cam} gl={{ antialias: true, alpha: true }} style={{ position: 'absolute', inset: 0, filter: blur > 0 ? `blur(${blur}px)` : undefined, opacity: v.dim ?? 1 }} frameloop="always">
        {scene && <Look at={lookAt} />}
        {v.foliage !== false && (scene ? planted.map((p, i) => <group key={i} position={p.position} scale={p.scale} rotation={p.rotation}><group position={p.offset}><Foliage f={p.f} v={v} colors={colors} gainMul={p.gain} /></group></group>) : <Foliage f={f} v={v} colors={colors} />)}
        {scene && v.scene?.ground === 'grid' && <Ground color={colors.green} />}
      </Canvas>
      <Canvas dpr={[1, 2]} camera={cam} gl={{ antialias: true, alpha: true }} style={{ position: 'absolute', inset: 0 }} frameloop="always">
        {scene && <Look at={lookAt} />}
        {scene ? planted.map((p, i) => <group key={i} position={p.position} scale={p.scale} rotation={p.rotation}><group position={p.offset}><Bloom f={p.f} v={v} colors={colors} gainMul={p.gain} wireMul={p.wire} /></group></group>) : <Bloom f={f} v={v} colors={colors} onProject={hasTech(v) ? setProj : undefined} />}
      </Canvas>
      {tech && (
        <svg viewBox={`0 0 ${XF_W} ${XF_H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <TechLayer v={v} g={tech} tick={tick} swatches={swatches} />
        </svg>
      )}
    </div>
  )
}
