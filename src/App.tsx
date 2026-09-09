import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Cube, SETS, SHAPES, type CubeHandle, type Set, type Shape } from './Cube'
import { SCHEMES, type Scheme } from './schemes'
import { VARIANTS, type Variant } from './materials/v1'

// FPS sampler lives inside the canvas; reports out twice a second.
function Fps({ onFps }: { onFps: (n: number) => void }) {
  const acc = useRef({ t: 0, n: 0 })
  useFrame((_, dt) => {
    acc.current.t += dt
    acc.current.n++
    if (acc.current.t >= 0.5) {
      onFps(Math.round(acc.current.n / acc.current.t))
      acc.current = { t: 0, n: 0 }
    }
  })
  return null
}

// First-iteration studio: grey dome, ring, strips, scheme colours on the horizon.
function StudioEnv({ s, dome = '#2b2e35' }: { s: Scheme; dome?: string }) {
  return (
    <Environment resolution={256}>
      <mesh scale={60}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial color={dome} side={THREE.BackSide} />
      </mesh>
      <Lightformer form="ring" intensity={2.5} position={[0, 8, -6]} scale={9} />
      <Lightformer intensity={2} position={[0, 4, 8]} scale={[12, 1.2, 1]} />
      <Lightformer intensity={1.5} position={[-8, 0, 2]} rotation-y={Math.PI / 2} scale={[10, 0.7, 1]} />
      <Lightformer intensity={1.5} position={[8, -1, 0]} rotation-y={-Math.PI / 2} scale={[10, 0.5, 1]} />
      <Lightformer intensity={2} color={s.a} position={[0, -7, 2]} scale={[12, 2, 1]} />
      <Lightformer intensity={1.2} color={s.b} position={[5, 5, -3]} scale={[4, 4, 1]} />
    </Environment>
  )
}

// Paper liquid-metal as an environment. Their stripe function (two thin strips, a wide gradient,
// per-channel dispersion) is baked into an equirect: latitude drives the stripe, a little longitude
// wave bends it. Rotating the environment slides the band across the metal; roughness softens it.
function stripes(c1: number, c2: number, p: number, w: number[], blur: number, bump: number) {
  const sst = (a: number, b: number, x: number) => {
    const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
    return t * t * (3 - 2 * t)
  }
  const mix = (a: number, b: number, t: number) => a + (b - a) * t
  let ch = mix(c2, c1, sst(0, 2 * blur, p))
  let border = w[0]
  ch = mix(ch, c2, sst(border, border + 2 * blur, p))
  border = w[0] + 0.4 * (1 - bump) * w[1]
  ch = mix(ch, c1, sst(border, border + 2 * blur, p))
  border = w[0] + 0.5 * (1 - bump) * w[1]
  ch = mix(ch, c2, sst(border, border + 2 * blur, p))
  border = w[0] + w[1]
  ch = mix(ch, c1, sst(border, border + 2 * blur, p))
  const g = mix(c1, c2, sst(0, 1, (p - w[0] - w[1]) / w[2]))
  return mix(ch, g, sst(border, border + 0.5 * blur, p))
}

function liquidTexture(a: string, b: string) {
  const W = 512, H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const ca = new THREE.Color(a), cb = new THREE.Color(b)
  const mix = (x: number, y: number, t: number) => x + (y - x) * t
  const sst = (lo: number, hi: number, x: number) => {
    const t = Math.min(Math.max((x - lo) / (hi - lo), 0), 1)
    return t * t * (3 - 2 * t)
  }
  const rep = 2, softness = 0.1, shiftR = 0.55, shiftB = 0.55
  const fract = (x: number) => x - Math.floor(x)
  for (let y = 0; y < H; y++) {
    const lat = y / H
    // metal reads as metal when the sky is bright and the ground is dark: a graded body, not flat white
    const body = mix(0.97, 0.42, sst(0.35, 1, lat))
    const c1 = [body, body, body * 1.02].map((v, i) => v * 0.93 + [ca.r, ca.g, ca.b][i] * 0.07)
    const c2 = [0.03, 0.03, 0.045].map((v, i) => v * 0.9 + [cb.r, cb.g, cb.b][i] * 0.1)
    const bump = 1 - Math.abs(lat - 0.5) * 1.6
    const w = [0.12 * (1 - 0.4 * bump), 0.07 * (1 + 0.4 * bump), 0]
    w[2] = 1 - w[0] - w[1]
    const disp = Math.min(1 - bump, 0.45)
    const dR = disp * (shiftR / 20), dB = disp * 1.3 * (shiftB / 20)
    const blur = softness / 15 + 0.004
    for (let x = 0; x < W; x++) {
      const dir = lat * rep + 0.025 * Math.sin((x / W) * Math.PI * 2) - 0.1
      const r = stripes(c1[0], c2[0], fract(dir + dR), w, blur, bump)
      const g = stripes(c1[1], c2[1], fract(dir), w, blur, bump)
      const bl = stripes(c1[2], c2[2], fract(dir - dB), w, blur, bump)
      const i = (y * W + x) * 4
      img.data[i] = r * 255
      img.data[i + 1] = g * 255
      img.data[i + 2] = bl * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function LiquidEnv({ s }: { s: Scheme }) {
  const tex = useMemo(() => liquidTexture(s.a, s.b), [s])
  useEffect(() => () => tex.dispose(), [tex])
  const scene = useThree((st) => st.scene)
  useFrame((st) => {
    const t = st.clock.elapsedTime
    // one smooth band: tilt it, and let it breathe up and down across the faces
    scene.environmentRotation.set(-0.35 + Math.sin(t * 0.2) * 0.28, t * 0.05, Math.sin(t * 0.13) * 0.2)
  })
  useEffect(
    () => () => {
      scene.environmentRotation.set(0, 0, 0)
    },
    [scene],
  )
  return <Environment map={tex} />
}

export default function App() {
  const [si, setSi] = useState(0)
  const [shape, setShape] = useState<Shape>('solid')
  const [set, setSet] = useState<Set>('v2')
  const [variant, setVariant] = useState<Variant>('chrome')
  const [auto, setAuto] = useState(false)
  const [float, setFloat] = useState(false)
  const [turns, setTurns] = useState(0)
  const [fps, setFps] = useState(0)
  const cube = useRef<CubeHandle | null>(null)
  const s = SCHEMES[si]

  const onTurn = useCallback(() => setTurns((n) => n + 1), [])

  // Push scheme into CSS variables.
  useEffect(() => {
    const r = document.documentElement.style
    for (const [k, v] of Object.entries(s)) if (k !== 'name') r.setProperty(`--${k}`, v)
    document.documentElement.dataset.scheme = s.name
  }, [s])

  // Keyboard + debug hook for Playwright.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'c') setSi((i) => (i + 1) % SCHEMES.length)
      if (e.key === 'm') setVariant((v) => VARIANTS[(VARIANTS.indexOf(v) + 1) % VARIANTS.length])
      if (e.key === 's') setShape((v) => (v === 'classic' ? 'solid' : 'classic'))
      if (e.key === 'v') setSet((v) => (v === 'v1' ? 'v2' : 'v1'))
      if (e.key === 't') setAuto((v) => !v)
      if (e.key === ' ') {
        e.preventDefault()
        cube.current?.turn()
      }
    }
    window.addEventListener('keydown', onKey)
    window.__aar = {
      setScheme: (n: string) => setSi(Math.max(0, SCHEMES.findIndex((x) => x.name === n))),
      setVariant,
      setShape,
      setSet,
      setAuto,
      turn: (...args: Parameters<CubeHandle['turn']>) => cube.current?.turn(...args) ?? Promise.resolve(),
      positions: () => cube.current?.positions() ?? [],
      busy: () => cube.current?.busy() ?? false,
    }
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const bloom = { heat: [1.6, 0.5], chrome: [0.2, 0.95], smoke: [0.3, 0.9] }[variant]

  return (
    <>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 13], fov: 32 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={[s.bg]} />
        <Cube shape={shape} set={set} variant={variant} palette={s} auto={auto} float={float} onTurn={onTurn} handle={cube} />
        {set === 'v2' && variant === 'chrome' ? (
          <LiquidEnv s={s} />
        ) : (
          // v2 smoke is a diffuse stone with no scene lights, so it needs a brighter dome to read as glass
          <StudioEnv s={s} dome={set === 'v2' && variant === 'smoke' ? '#b4b6bf' : '#2b2e35'} />
        )}
        <EffectComposer>
          <Bloom mipmapBlur intensity={bloom[0]} luminanceThreshold={bloom[1]} luminanceSmoothing={0.3} />
        </EffectComposer>
        <Fps onFps={setFps} />
      </Canvas>

      <div className="aura" aria-hidden />
      <div className="grain" aria-hidden />

      <div className="ui">
        <div className="wordmark">aarcube</div>

        <div className="slot slot-about">about</div>
        <div className="slot slot-code">code</div>
        <div className="slot slot-hardware">hardware</div>
        <div className="slot slot-creatives">creatives</div>
        <div className="slot slot-floral">xray floral, lowkey</div>

        <div className="controls">
          <Row label="scheme" items={SCHEMES.map((x) => x.name)} on={s.name} pick={(n) => setSi(SCHEMES.findIndex((x) => x.name === n))} />
          <Row label="shape" items={SHAPES} on={shape} pick={setShape} />
          <Row label="set" items={SETS} on={set} pick={setSet} />
          <Row label="material" items={VARIANTS} on={variant} pick={setVariant} />
          <div className="row">
            <span className="k">motion</span>
            <button onClick={() => cube.current?.turn()}>turn once</button>
            <button className={auto ? 'on' : ''} onClick={() => setAuto((v) => !v)}>
              {auto ? 'stop' : 'keep turning'}
            </button>
            <button className={float ? 'on' : ''} onClick={() => setFloat((v) => !v)}>
              float
            </button>
          </div>
        </div>

        <div className="readout">
          <span>scheme {s.name}</span>
          <span>shape {shape}</span>
          <span>set {set}</span>
          <span>material {variant}</span>
          <span>turns {turns}</span>
          <span>fps {fps}</span>
          <span>keys c s v m t space</span>
        </div>
      </div>
    </>
  )
}

function Row<T extends string>({ label, items, on, pick }: { label: string; items: T[]; on: T; pick: (v: T) => void }) {
  return (
    <div className="row">
      <span className="k">{label}</span>
      {items.map((x) => (
        <button key={x} className={x === on ? 'on' : ''} onClick={() => pick(x)}>
          {x}
        </button>
      ))}
    </div>
  )
}

declare global {
  interface Window {
    __aar: {
      setScheme: (n: string) => void
      setVariant: (v: Variant) => void
      setShape: (v: Shape) => void
      setSet: (v: Set) => void
      setAuto: (b: boolean) => void
      turn: CubeHandle['turn']
      positions: () => number[][]
      busy: () => boolean
    }
  }
}
