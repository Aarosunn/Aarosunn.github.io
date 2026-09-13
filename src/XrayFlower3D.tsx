/**
 * The florals as x-ray meshes: each bloom with a fresnel shader on additive blending (faces see-through, silhouettes
 * and edge-on geometry bright, a thin-film sheen) plus a wire pass, in one transparent canvas. Nothing moves, so the
 * canvas renders on demand: a few frames after mounting, then only on resize.
 */
import { useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { FLORAL, type Placed } from './florals'
import { FLORAL_COLORS } from './theme'
import { FLOWERS, buildFlower, type Flower } from './xrayMesh'

const VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv;
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

const COLORS = (() => {
  const bright = new THREE.Color(FLORAL_COLORS.bright)
  return { petal: new THREE.Color(FLORAL_COLORS.petal).lerp(bright, FLORAL.petalWhite), rim: new THREE.Color(FLORAL_COLORS.petal).lerp(bright, FLORAL.rimWhite) }
})()

function Bloom({ f, gainMul, wireMul }: { f: Flower; gainMul: number; wireMul: number }) {
  const fr = { power: FLORAL.fresnel.power, gain: FLORAL.fresnel.gain * gainMul, base: FLORAL.fresnel.base * gainMul }
  const wire = FLORAL.wire * wireMul
  const mats = useMemo(
    () => ({
      // inner layers dimmer: many petals stack under additive blending, or the core goes white
      petal: [0, 1, 2, 3].map((l) => xray(COLORS.petal, COLORS.rim, { power: fr.power, gain: fr.gain * (1 - 0.28 * l), base: fr.base / (1 + 2 * l) }, FLORAL.irid)),
      wire: [0, 1, 2, 3].map((l) => xray(COLORS.petal, COLORS.rim, { power: fr.power, gain: (wire * 0.6) / (1 + 0.6 * l), base: (wire * 0.5) / (1 + 0.6 * l) }, FLORAL.irid * 0.5, true)),
    }),
    [fr.power, fr.gain, fr.base, wire],
  )
  useEffect(() => () => Object.values(mats).flat().forEach((m) => m.dispose()), [mats])
  return (
    <group>
      {f.bloom.map((p, i) => (
        <group key={i} matrixAutoUpdate={false} matrix={p.matrix}>
          <mesh geometry={p.geometry} material={mats.petal[p.layer]} />
          <mesh geometry={p.geometry} material={mats.wire[p.layer]} />
        </group>
      ))}
    </group>
  )
}

/** a still scene: look at the group, then draw a handful of frames (fonts and layout settle over the first second) */
function Still({ at }: { at: [number, number, number] }) {
  const { camera, invalidate, size } = useThree()
  useEffect(() => {
    camera.lookAt(...at)
    const ts = [0, 50, 200, 600, 1500].map((ms) => setTimeout(invalidate, ms))
    return () => ts.forEach(clearTimeout)
  }, [camera, at, invalidate, size.width, size.height])
  return null
}

type Grown = { f: Flower; p: Placed; offset: [number, number, number] }

/** the group in a box sized by CSS (`className`); `camDist` overrides the look's camera distance */
export function XrayFlower3D({ className, camDist = FLORAL.camDist, lookAtY = -0.27 }: { className?: string; camDist?: number; lookAtY?: number }) {
  const grown = useMemo<Grown[]>(() => FLORAL.place.map((p, i) => { const f = buildFlower(i + 1, FLOWERS[p.flower]); return { f, p, offset: [-f.bloomCentre.x, -f.bloomCentre.y, -f.bloomCentre.z] } }), [])
  useEffect(() => () => grown.forEach((g) => g.f.dispose()), [grown])
  const lookAt = useMemo<[number, number, number]>(() => [0, lookAtY, 0], [lookAtY])
  return (
    <div className={`xf3d ${className ?? ''}`} style={{ position: 'relative' }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.1, camDist], fov: 30 }} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} style={{ position: 'absolute', inset: 0 }} frameloop="demand">
        <Still at={lookAt} />
        {grown.map(({ f, p, offset }, i) => (
          <group key={i} position={p.at} scale={p.scale} rotation={p.rot}>
            <group position={offset}>
              <Bloom f={f} gainMul={p.gain ?? 1} wireMul={p.wire ?? 1} />
            </group>
          </group>
        ))}
      </Canvas>
    </div>
  )
}
