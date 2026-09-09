import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Cube, SETS, SHAPES, VARIANTS_OF, type AnyVariant, type CubeHandle, type Set, type Shape } from './Cube'
import { SCHEMES, type Scheme } from './schemes'
import { Paper } from './Paper'
import { HeatCube, type HeatDebug, type HeatVersion } from './HeatCube'
import { PaperCube } from './PaperCube'
import { Site } from './Site'
import type { RubikHandle } from './RubikMask'
import { PAPER_VERSIONS, VERSION_OF, type PaperShader, type PaperShape } from './paperVersions'
import { gemSmokePresets, heatmapPresets, liquidMetalPresets } from '@paper-design/shaders-react'

import { PAPER_PRESETS } from './paperPresets'
// paper's site presets first, then aarcube's own
const PRESETS_OF: Record<PaperShader, { name: string; params: object }[]> = {
  heat: [...heatmapPresets, ...PAPER_PRESETS.heat],
  liquid: [...liquidMetalPresets, ...PAPER_PRESETS.liquid],
  smoke: [...gemSmokePresets, ...PAPER_PRESETS.smoke],
}
const PAPER_SHAPES: PaperShape[] = ['box', 'rounded', 'octa', 'cage', 'rubik']

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
function stripes(c1: number, c2: number, p: number, w: number[], blur: number, bump: number, hold = 0) {
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
  // hold > 0 keeps the wide gradient bright for most of the cycle, then drops to the dark band
  const g = mix(c1, c2, sst(hold, 1, (p - w[0] - w[1]) / w[2]))
  return mix(ch, g, sst(border, border + 0.5 * blur, p))
}

// v2: flat white body, narrow dispersion. v3: graded body (metal reads as metal), wider rainbow fringe.
// v4 (`hires`): only latitude carries the stripe, so bake a tall narrow strip; 2048 wide blocked the main thread for seconds.
function liquidTexture(a: string, b: string, graded: boolean, hires = false) {
  const W = hires ? 128 : 512, H = hires ? 1024 : 512
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
  const rep = 2, softness = hires ? 0.22 : 0.1
  const shiftR = graded ? 0.55 : 0.3, shiftB = shiftR
  const fract = (x: number) => x - Math.floor(x)
  for (let y = 0; y < H; y++) {
    const lat = y / H
    // metal reads as metal when the sky is bright and the ground is dark: a graded body, not flat white
    const body = graded ? (hires ? mix(0.96, 0.55, sst(0.3, 1, lat)) : mix(0.97, 0.42, sst(0.35, 1, lat))) : 0.98
    const c1 = [body, body, body * 1.02].map((v, i) => v * 0.93 + [ca.r, ca.g, ca.b][i] * 0.07)
    const c2 = (graded ? [0.03, 0.03, 0.045] : [0.08, 0.08, 0.1]).map((v, i) => v * 0.9 + [cb.r, cb.g, cb.b][i] * 0.1)
    const bump = 1 - Math.abs(lat - 0.5) * 1.6
    const w = [0.12 * (1 - 0.4 * bump), 0.07 * (1 + 0.4 * bump), 0]
    w[2] = 1 - w[0] - w[1]
    const disp = Math.min(1 - bump, 0.45)
    const dR = disp * (shiftR / 20), dB = disp * 1.3 * (shiftB / 20)
    const blur = softness / 15 + 0.004
    for (let x = 0; x < W; x++) {
      const dir = lat * rep + 0.025 * Math.sin((x / W) * Math.PI * 2) - 0.1
      const hold = hires ? 0.3 : 0
      const r = stripes(c1[0], c2[0], fract(dir + dR), w, blur, bump, hold)
      const g = stripes(c1[1], c2[1], fract(dir), w, blur, bump, hold)
      const bl = stripes(c1[2], c2[2], fract(dir - dB), w, blur, bump, hold)
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

function LiquidEnv({ s, graded, slow = false }: { s: Scheme; graded: boolean; slow?: boolean }) {
  const tex = useMemo(() => liquidTexture(s.a, s.b, graded, slow), [s, graded, slow])
  useEffect(() => () => tex.dispose(), [tex])
  const scene = useThree((st) => st.scene)
  useFrame((st) => {
    const t = st.clock.elapsedTime
    // one smooth band: tilt it, and let it breathe up and down across the faces
    // v4: a quarter of the speed, and a wider sweep so the band crosses the front faces most of the time
    const k = slow ? 0.25 : 1
    const sweep = slow ? 0.5 : 0.28
    scene.environmentRotation.set(-0.35 + Math.sin(t * 0.2 * k) * sweep, t * 0.05 * k, Math.sin(t * 0.13 * k) * 0.2)
  })
  useEffect(
    () => () => {
      scene.environmentRotation.set(0, 0, 0)
    },
    [scene],
  )
  return <Environment map={tex} />
}

type Tab = 'site' | 'cube' | 'heatcube' | 'paper'
const TABS: Tab[] = ['site', 'cube', 'heatcube', 'paper']

export default function App() {
  const [tab, setTab] = useState<Tab>('site')
  const [heatPreset, setHeatPreset] = useState(0)
  const [heatSpin, setHeatSpin] = useState(true)
  const [heatHollow, setHeatHollow] = useState(false)
  const [heatVersion, setHeatVersion] = useState<string>('v3')
  const [heatDebug, setHeatDebug] = useState<HeatDebug>('off')
  const [heatShape, setHeatShape] = useState<PaperShape | null>(null)
  const [heatAuto, setHeatAuto] = useState(false)
  const rubik = useRef<RubikHandle | null>(null)
  const [si, setSi] = useState(0)
  const [shape, setShape] = useState<Shape>('solid')
  const [set, setSet] = useState<Set>('v2')
  const [variant, setVariant] = useState<AnyVariant>('chrome')
  const [auto, setAuto] = useState(false)
  const [float, setFloat] = useState(false)
  const [turns, setTurns] = useState(0)
  const [fps, setFps] = useState(0)
  const cube = useRef<CubeHandle | null>(null)
  const s = SCHEMES[si]

  const onTurn = useCallback(() => setTurns((n) => n + 1), [])
  const setRef = useRef(set)
  setRef.current = set
  const variants = VARIANTS_OF(set)
  // a set without the current variant falls back to its first
  const v = variants.includes(variant) ? variant : variants[0]

  // Push scheme into CSS variables.
  useEffect(() => {
    const r = document.documentElement.style
    for (const [k, v] of Object.entries(s)) if (k !== 'name') r.setProperty(`--${k}`, v)
    document.documentElement.dataset.scheme = s.name
  }, [s])

  // Keyboard + debug hook for Playwright.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p') setTab((t) => TABS[(TABS.indexOf(t) + 1) % TABS.length])
      if (e.key === 'c') setSi((i) => (i + 1) % SCHEMES.length)
      if (e.key === 'm') setVariant((v) => { const vs = VARIANTS_OF(setRef.current); return vs[(vs.indexOf(v) + 1) % vs.length] })
      if (e.key === 's') setShape((v) => (v === 'classic' ? 'solid' : 'classic'))
      if (e.key === 'v') setSet((v) => SETS[(SETS.indexOf(v) + 1) % SETS.length])
      if (e.key === 't') setAuto((v) => !v)
      if (e.key === ' ') {
        e.preventDefault()
        cube.current?.turn()
      }
    }
    window.addEventListener('keydown', onKey)
    window.__aar = {
      setTab,
      setHeatHollow,
      setHeatVersion: (v: string) => { setHeatVersion(v); const pv = VERSION_OF(v); setHeatPreset(pv?.preset ? Math.max(0, PRESETS_OF[pv.shader].findIndex((p) => p.name.toLowerCase() === pv.preset)) : 0) },
      setHeatDebug,
      setHeatPreset,
      setHeatShape,
      setHeatAuto,
      paperTurn: (...args: Parameters<RubikHandle['turn']>) => rubik.current?.turn(...args) ?? Promise.resolve(),
      paperPositions: () => rubik.current?.positions() ?? [],
      paperBusy: () => rubik.current?.busy() ?? false,
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

  const bloom: Record<AnyVariant, number[]> = {
    heat: set === 'v3' ? [1.6, 0.5] : set === 'v4' ? [0.9, 0.55] : [1.2, 0.7],
    chrome: [0.2, 0.95],
    smoke: [0.3, 0.9],
    heatsmoke: [0.9, 0.5],
    smokechrome: [0.2, 0.95],
  }
  const bl = bloom[v]
  const metallic = v === 'chrome' || v === 'smokechrome'

  const tabs = (
    <div className="tabs">
      <button className={tab === 'site' ? 'on' : ''} onClick={() => setTab('site')}>
        site
      </button>
      <button className={tab === 'cube' ? 'on' : ''} onClick={() => setTab('cube')}>
        cube
      </button>
      <button className={tab === 'heatcube' ? 'on' : ''} onClick={() => setTab('heatcube')}>
        heat cube
      </button>
      <button className={tab === 'paper' ? 'on' : ''} onClick={() => setTab('paper')}>
        paper shaders
      </button>
    </div>
  )

  if (tab === 'site')
    return (
      <>
        <Site scheme={s.name} />
        <div className="site-tabs">{tabs}</div>
      </>
    )

  if (tab === 'heatcube') {
    const PV = VERSION_OF(heatVersion)
    const legacy = !PV
    const presets = PV ? PRESETS_OF[PV.shader] : heatmapPresets
    const preset = presets[Math.min(heatPreset, presets.length - 1)]
    return (
      <>
        <Canvas key={heatVersion} dpr={[1, 1.5]} camera={{ position: [0, 0, PV?.camZ ?? 6.5], fov: 30 }} gl={{ antialias: true }}>
          {legacy ? (
            <HeatCube params={preset.params} spin={heatSpin} hollow={heatHollow} version={heatVersion as HeatVersion} debug={heatDebug} />
          ) : (
            <PaperCube version={PV} shape={heatShape ?? undefined} params={preset.params as Record<string, unknown>} spin={heatSpin} auto={heatAuto} debug={heatDebug} rubik={rubik} />
          )}
        </Canvas>
        <div className="ui">
          <div className="wordmark">aarcube</div>
          {tabs}
          <div className="controls">
            <Row label="version" items={['v1', 'v2', ...PAPER_VERSIONS.map((v) => v.name)]} on={heatVersion} pick={(v) => { setHeatVersion(v); const pv = VERSION_OF(v); setHeatPreset(pv?.preset ? Math.max(0, PRESETS_OF[pv.shader].findIndex((p) => p.name.toLowerCase() === pv.preset)) : 0) }} />
            <Row label="preset" items={presets.map((p) => p.name.toLowerCase())} on={preset.name.toLowerCase()} pick={(n) => setHeatPreset(presets.findIndex((p) => p.name.toLowerCase() === n))} />
            {!legacy && <Row label="shape" items={PAPER_SHAPES} on={heatShape ?? PV.shape} pick={setHeatShape} />}
            <div className="row">
              <span className="k">motion</span>
              <button className={heatSpin ? 'on' : ''} onClick={() => setHeatSpin((v) => !v)}>
                {heatSpin ? 'spinning' : 'still'}
              </button>
              {legacy && (
                <button className={heatHollow ? 'on' : ''} onClick={() => setHeatHollow((v) => !v)}>
                  hollow
                </button>
              )}
              {(heatShape ?? PV?.shape) === 'rubik' && (
                <>
                  <button className={heatAuto ? 'on' : ''} onClick={() => setHeatAuto((v) => !v)}>
                    turning
                  </button>
                  <button onClick={() => rubik.current?.turn()}>turn</button>
                </>
              )}
            </div>
          </div>
          <div className="readout">
            <span>{PV ? `${PV.shader === 'heat' ? 'heatmap' : PV.shader === 'liquid' ? 'liquid metal' : 'gem smoke'} on a ${heatShape ?? PV.shape}` : 'paper heatmap on a cube'}</span>
            {PV && <span className="note">{PV.note}</span>}
            <span>drag to orbit</span>
            <span>keys p</span>
          </div>
        </div>
      </>
    )
  }

  if (tab === 'paper')
    return (
      <>
        <div className="ui paper-ui">
          <div className="wordmark">aarcube</div>
          {tabs}
          <Paper />
        </div>
      </>
    )

  return (
    <>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 13], fov: 32 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={[s.bg]} />
        <Cube shape={shape} set={set} variant={v} palette={s} auto={auto} float={float} onTurn={onTurn} handle={cube} />
        {set !== 'v1' && metallic ? (
          <LiquidEnv s={s} graded={set !== 'v2'} slow={set === 'v4'} />
        ) : (
          // v2+ smoke is a diffuse stone with no scene lights, so it needs a brighter dome to read as glass
          <StudioEnv s={s} dome={set !== 'v1' && v === 'smoke' ? '#b4b6bf' : '#2b2e35'} />
        )}
        <EffectComposer>
          <Bloom mipmapBlur intensity={bl[0]} luminanceThreshold={bl[1]} luminanceSmoothing={0.3} />
        </EffectComposer>
        <Fps onFps={setFps} />
      </Canvas>

      <div className="aura" aria-hidden />
      <div className="grain" aria-hidden />

      <div className="ui">
        <div className="wordmark">aarcube</div>
        {tabs}

        <div className="slot slot-about">about</div>
        <div className="slot slot-code">code</div>
        <div className="slot slot-hardware">hardware</div>
        <div className="slot slot-creatives">creatives</div>
        <div className="slot slot-floral">xray floral, lowkey</div>

        <div className="controls">
          <Row label="scheme" items={SCHEMES.map((x) => x.name)} on={s.name} pick={(n) => setSi(SCHEMES.findIndex((x) => x.name === n))} />
          <Row label="shape" items={SHAPES} on={shape} pick={setShape} />
          <Row label="set" items={SETS} on={set} pick={setSet} />
          <Row label="material" items={variants} on={v} pick={setVariant} />
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
          <span>material {v}</span>
          <span>turns {turns}</span>
          <span>fps {fps}</span>
          <span>keys p c s v m t space</span>
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
      setTab: (t: Tab) => void
      setHeatHollow: (b: boolean) => void
      setHeatVersion: (v: string) => void
      setHeatDebug: (v: HeatDebug) => void
      setHeatPreset: (i: number) => void
      setHeatShape: (s: PaperShape | null) => void
      setHeatAuto: (b: boolean) => void
      paperTurn: RubikHandle['turn']
      paperPositions: () => number[][]
      paperBusy: () => boolean
      setScheme: (n: string) => void
      setVariant: (v: AnyVariant) => void
      setShape: (v: Shape) => void
      setSet: (v: Set) => void
      setAuto: (b: boolean) => void
      turn: CubeHandle['turn']
      positions: () => number[][]
      busy: () => boolean
    }
  }
}
