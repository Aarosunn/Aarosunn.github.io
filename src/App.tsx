import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Cube, type CubeHandle } from './Cube'
import { SCHEMES } from './schemes'
import { VARIANTS, type Variant } from './materials'

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

export default function App() {
  const [si, setSi] = useState(0)
  const [variant, setVariant] = useState<Variant>('chrome')
  const [auto, setAuto] = useState(false)
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
      setAuto,
      turn: (...args: Parameters<CubeHandle['turn']>) => cube.current?.turn(...args) ?? Promise.resolve(),
      positions: () => cube.current?.positions() ?? [],
      busy: () => cube.current?.busy() ?? false,
    }
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const bloom = { heat: [1.2, 0.7], chrome: [0.25, 0.95], smoke: [0.3, 0.9] }[variant]

  return (
    <>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 13], fov: 32 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={[s.bg]} />
        <Cube variant={variant} palette={s} auto={auto} onTurn={onTurn} handle={cube} />
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
          <div className="row">
            <span className="k">scheme</span>
            {SCHEMES.map((x, i) => (
              <button key={x.name} className={i === si ? 'on' : ''} onClick={() => setSi(i)}>
                {x.name}
              </button>
            ))}
          </div>
          <div className="row">
            <span className="k">material</span>
            {VARIANTS.map((v) => (
              <button key={v} className={v === variant ? 'on' : ''} onClick={() => setVariant(v)}>
                {v}
              </button>
            ))}
          </div>
          <div className="row">
            <span className="k">turns</span>
            <button onClick={() => cube.current?.turn()}>turn once</button>
            <button className={auto ? 'on' : ''} onClick={() => setAuto((v) => !v)}>
              {auto ? 'stop' : 'keep turning'}
            </button>
          </div>
        </div>

        <div className="readout">
          <span>scheme {s.name}</span>
          <span>material {variant}</span>
          <span>turns {turns}</span>
          <span>fps {fps}</span>
          <span>keys c m t space</span>
        </div>
      </div>
    </>
  )
}

declare global {
  interface Window {
    __aar: {
      setScheme: (n: string) => void
      setVariant: (v: Variant) => void
      setAuto: (b: boolean) => void
      turn: CubeHandle['turn']
      positions: () => number[][]
      busy: () => boolean
    }
  }
}
