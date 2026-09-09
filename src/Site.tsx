/**
 * Mock of the portfolio page: the shader cube in the middle (heatmap on the Rubik's cube, v10),
 * four sections around it stepped like a deck (arrow keys / click / 1-4), the x-ray floral at the base.
 * Copy is placeholder. Every deck step turns one layer of the cube.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { gemSmokePresets, heatmapPresets, liquidMetalPresets } from '@paper-design/shaders-react'
import { PAPER_PRESETS } from './paperPresets'
import { PaperCube } from './PaperCube'
import { VERSION_OF, type PaperShader } from './paperVersions'
import type { RubikHandle } from './RubikMask'
import { Floral } from './Floral'

const PRESETS_OF: Record<PaperShader, { name: string; params: object }[]> = {
  heat: [...heatmapPresets, ...PAPER_PRESETS.heat],
  liquid: [...liquidMetalPresets, ...PAPER_PRESETS.liquid],
  smoke: [...gemSmokePresets, ...PAPER_PRESETS.smoke],
}

type Section = { id: string; title: string; blurb: string; items: string[] }
const SECTIONS: Section[] = [
  {
    id: 'about',
    title: 'About',
    blurb: 'Computer engineering at Michigan. Silicon to screens, one build at a time.',
    items: ['currently: this site, a cube that is also a menu', 'reading: signals, shaders, synth design'],
  },
  {
    id: 'code',
    title: 'Code',
    blurb: 'Tools, systems and experiments that ship.',
    items: ['aarcube: paper shaders on a Rubik’s cube', 'placeholder: a CLI people actually use', 'placeholder: a small language runtime'],
  },
  {
    id: 'hardware',
    title: 'Hardware',
    blurb: 'Boards, firmware and the signals between them.',
    items: ['placeholder: a synth voice on an FPGA', 'placeholder: a hand-tracking camera rig', 'placeholder: PCB for a split keyboard'],
  },
  {
    id: 'creatives',
    title: 'Creatives',
    blurb: 'Edits, motion and sound. The page will one day cut to music.',
    items: ['placeholder: a title sequence in TouchDesigner', 'placeholder: an ASCII portrait that watches back'],
  },
]

/** cube versions worth comparing in place; key `v` cycles */
const SITE_VERSIONS = ['v10', 'v16', 'v19', 'v13', 'v18', 'v17']

export function Site({ version: initial = 'v10' }: { version?: string }) {
  const [active, setActive] = useState(0)
  const [version, setVersion] = useState(initial)
  const rubik = useRef<RubikHandle | null>(null)
  // the lab's v10 at its own camera (blur radii are frame-relative, so the cube stays crisp);
  // paper's `scale` shrinks the whole image on screen so the sections breathe
  const narrow = typeof window !== 'undefined' && window.innerWidth < 900
  const PV = VERSION_OF(version)!
  const params = useMemo(() => {
    const presets = PRESETS_OF[PV.shader]
    const base = (presets.find((p) => p.name.toLowerCase() === PV.preset) ?? presets[0]).params as Record<string, unknown>
    return { ...base, ...(PV.shader === 'heat' ? { outerGlow: 0.42 } : {}), scale: (narrow ? 0.7 : 0.85) * (base.scale as number) }
  }, [PV, narrow])

  // deck stepping: arrows / digits; every step turns one layer
  const step = (i: number) => {
    setActive(((i % SECTIONS.length) + SECTIONS.length) % SECTIONS.length)
    rubik.current?.turn()
  }
  // one stable window listener: App's own keydown listener re-renders on the same event, and a listener
  // swapped during dispatch never sees it, so the live handler lives in a ref
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {})
  onKey.current = (e) => {
    if (e.key === 'ArrowRight') step(active + 1)
    if (e.key === 'ArrowLeft') step(active - 1)
    if (e.key === 'v') setVersion((v) => SITE_VERSIONS[(SITE_VERSIONS.indexOf(v) + 1) % SITE_VERSIONS.length])
    const n = Number(e.key)
    if (n >= 1 && n <= SECTIONS.length) step(n - 1)
  }
  useEffect(() => {
    const f = (e: KeyboardEvent) => onKey.current(e)
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  return (
    <>
      <Canvas key={version} dpr={[1, 1.5]} camera={{ position: [0, 0, PV.camZ], fov: 30 }} gl={{ antialias: true }}>
        <PaperCube version={PV} params={params} spin rubik={rubik} />
      </Canvas>
      <div className="ui site">
        <header className="site-head">
          <div className="wordmark">aarcube</div>
          <p className="site-intro">Aaron. Engineer of small machines and large gradients.</p>
        </header>
        {SECTIONS.map((s, i) => (
          <section key={s.id} className={`sec sec-${s.id} ${i === active ? 'on' : ''}`} onClick={() => step(i)}>
            <h2>{s.title}</h2>
            <p>{s.blurb}</p>
            <ul>
              {s.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </section>
        ))}
        <div className="site-base">
          <Floral className="floral" seed={11} />
          <nav className="deck" aria-label="sections">
            {SECTIONS.map((s, i) => (
              <button key={s.id} className={i === active ? 'on' : ''} onClick={() => step(i)} aria-label={s.title}>
                <i />
                <span>{s.title.toLowerCase()}</span>
              </button>
            ))}
          </nav>
          <span className="site-ver">cube {version} · v to cycle</span>
        </div>
      </div>
    </>
  )
}
