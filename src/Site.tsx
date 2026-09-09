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
import { AsciiPortrait } from './Ascii'

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

/** the cube emits the scheme's hue: scheme name -> heat preset */
const HEAT_OF_SCHEME: Record<string, string> = { icemint: 'icemint', ice: 'icemint', mint: 'icemint', ember: 'ember', graphite: 'graphite', aura: 'default', paper: 'sepia' }

/** cube versions worth comparing in place; key `v` cycles. Versions whose own preset is light get a dark one here. */
const SITE_VERSIONS = ['v10', 'v16', 'v34', 'v19', 'v20', 'v27', 'v13', 'v18', 'v24', 'v17']
const SITE_PRESET: Record<string, string> = { v24: 'ice' }

export function Site({ version: initial = 'v10', scheme = 'icemint', bg = '#07090c' }: { version?: string; scheme?: string; bg?: string }) {
  const [active, setActive] = useState(0)
  const [version, setVersion] = useState(VERSION_OF(initial) ? initial : 'v10')
  const [open, setOpen] = useState<{ section: number; item: number } | null>(null)
  // layout A/B: sections in the corners, or deck only (the deck carries the blurb, panels do the rest)
  const [layout, setLayout] = useState<'corners' | 'deck'>('corners')
  const rubik = useRef<RubikHandle | null>(null)
  // the lab's v10 at its own camera (blur radii are frame-relative, so the cube stays crisp);
  // paper's `scale` shrinks the whole image on screen so the sections breathe
  const narrow = typeof window !== 'undefined' && window.innerWidth < 900
  // narrow screens are usually integrated GPUs: a 768 mask keeps the heat blurs cheap
  const PV = useMemo(() => ({ ...VERSION_OF(version)!, size: narrow ? 768 : 1024, bigDiv: narrow ? (4 as const) : (2 as const) }), [version, narrow])
  const params = useMemo(() => {
    const presets = PRESETS_OF[PV.shader]
    const want = SITE_PRESET[version] ?? (PV.shader === 'heat' && PV.preset === undefined ? HEAT_OF_SCHEME[scheme] : PV.preset)
    const base = (presets.find((p) => p.name.toLowerCase() === want) ?? presets[0]).params as Record<string, unknown>
    // the page is the shader's background, so the scheme's bg is paper's colorBack
    return { ...base, ...(PV.shader === 'heat' ? { outerGlow: 0.42, contour: 0.75 } : {}), colorBack: bg, scale: (narrow ? 0.7 : 0.85) * (base.scale as number) }
  }, [PV, narrow, scheme, version, bg])

  // deck stepping: arrows / digits; every step turns one layer
  const step = (i: number) => {
    setOpen(null)
    setActive(((i % SECTIONS.length) + SECTIONS.length) % SECTIONS.length)
    rubik.current?.turn()
  }
  // one stable window listener: App's own keydown listener re-renders on the same event, and a listener
  // swapped during dispatch never sees it, so the live handler lives in a ref
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {})
  onKey.current = (e) => {
    if (e.key === 'Escape') setOpen(null)
    if (e.key === 'ArrowRight') step(active + 1)
    if (e.key === 'ArrowLeft') step(active - 1)
    if (e.key === 'l') setLayout((l) => (l === 'corners' ? 'deck' : 'corners'))
    if (e.key === 'v') setVersion((v) => SITE_VERSIONS[(SITE_VERSIONS.indexOf(v) + 1) % SITE_VERSIONS.length])
    const n = Number(e.key)
    if (n >= 1 && n <= SECTIONS.length) step(n - 1)
  }
  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(() => {
    const f = (e: KeyboardEvent) => onKey.current(e)
    // no scrolling page: the wheel walks the deck, one step per gesture
    let last = 0
    const w = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 24 || performance.now() - last < 900) return
      last = performance.now()
      stepRef.current(activeRef.current + (e.deltaY > 0 ? 1 : -1))
    }
    // touch: a horizontal swipe steps the deck
    let x0 = 0
    const onCanvas = (e: TouchEvent) => (e.target as Element | null)?.closest?.('canvas') != null
    const ts = (e: TouchEvent) => { x0 = onCanvas(e) ? NaN : e.touches[0].clientX } // orbiting the cube is not a swipe
    const te = (e: TouchEvent) => {
      if (Number.isNaN(x0)) return
      const dx = e.changedTouches[0].clientX - x0
      if (Math.abs(dx) > 48) stepRef.current(activeRef.current + (dx < 0 ? 1 : -1))
    }
    window.addEventListener('keydown', f)
    window.addEventListener('wheel', w, { passive: true })
    window.addEventListener('touchstart', ts, { passive: true })
    window.addEventListener('touchend', te, { passive: true })
    return () => {
      window.removeEventListener('keydown', f)
      window.removeEventListener('wheel', w)
      window.removeEventListener('touchstart', ts)
      window.removeEventListener('touchend', te)
    }
  }, [])
  const activeRef = useRef(active)
  activeRef.current = active
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <>
      <Canvas key={version} dpr={[1, 1.5]} camera={{ position: [0, 0, PV.camZ], fov: 30 }} gl={{ antialias: true }}>
        <PaperCube version={PV} params={params} spin={!reduced} spinSpeed={0.12} auto={!reduced} autoInterval={6500} rubik={rubik} />
      </Canvas>
      <div className="aura" />
      <div className="grain" />
      <div className={`ui site layout-${layout} ${open ? 'has-panel' : ''}`}>
        <header className="site-head">
          <div className="wordmark">aarcube</div>
          <p className="site-intro">Aaron. Engineer of small machines and large gradients.</p>
        </header>
        {SECTIONS.map((s, i) => (
          <section key={s.id} className={`sec sec-${s.id} ${i === active ? 'on' : ''}`} onClick={() => step(i)}>
            <h2>{s.title}</h2>
            {s.id === 'about' && (
              <div className="portrait" title="ascii portrait, later a webcam">
                <AsciiPortrait cols={30} rows={18} cell={4} />
              </div>
            )}
            <p>{s.blurb}</p>
            <ul>
              {s.items.map((it, j) => {
                const openIt = (e: React.SyntheticEvent) => {
                  e.stopPropagation()
                  setActive(i)
                  setOpen({ section: i, item: j })
                  rubik.current?.turn()
                }
                return (
                  <li key={it} role="button" tabIndex={0} onClick={openIt} onKeyDown={(e) => e.key === 'Enter' && openIt(e)}>
                    {it}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        {open && (
          <aside className={`panel ${SECTIONS[open.section].id === 'about' || SECTIONS[open.section].id === 'creatives' ? 'panel-right' : 'panel-left'}`}>
            <span className="panel-k">{SECTIONS[open.section].title}</span>
            <h3>{SECTIONS[open.section].items[open.item].replace(/^placeholder: /, '')}</h3>
            <p>Placeholder detail. A paragraph about what this is, why it exists, and what it taught. One image or a short clip would sit below.</p>
            <div className="panel-media" />
            <p className="panel-meta">2026 · placeholder stack · link</p>
            <button className="panel-close" onClick={() => setOpen(null)}>
              close
            </button>
          </aside>
        )}
        <div className="site-base">
          <Floral className="floral" seed={11 + 7 * Math.max(0, ['icemint', 'ice', 'aura', 'ember', 'graphite', 'mint', 'paper'].indexOf(scheme))} />
          {layout === 'deck' && (
            <div className="deck-blurb">
              <h2>{SECTIONS[active].title}</h2>
              <p>{SECTIONS[active].blurb}</p>
              <ul>
                {SECTIONS[active].items.map((it, j) => (
                  <li key={it} role="button" tabIndex={0} onClick={() => { setOpen({ section: active, item: j }); rubik.current?.turn() }}>
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <nav className="deck" aria-label="sections">
            {SECTIONS.map((s, i) => (
              <button key={s.id} className={i === active ? 'on' : ''} onClick={() => step(i)} aria-label={s.title}>
                <i />
                <span>{s.title.toLowerCase()}</span>
              </button>
            ))}
          </nav>
          <span className="site-ver">cube {version} · ← → deck · v cube · c colour · l layout · click an item</span>
        </div>
      </div>
    </>
  )
}
