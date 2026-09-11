/**
 * Mock of the portfolio page: the shader cube in the middle (v14, icemint grain: liquid metal on the rounded Rubik's),
 * four sections around it stepped like a deck (arrow keys / click / 1-4), the x-ray floral at the base.
 * Copy is placeholder. Every deck step turns one layer of the cube.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { PaperCube, type FlyHandle } from './PaperCube'
import { CubeScreen } from './CubeScreen'
import { CUBE_OF, TRANSITION_OF } from './transitionVersions'
import { PROJECTS, type ScreenHandle } from './ScreenSolve'
import { VERSION_OF } from './paperVersions'
import { presetNamed } from './paperPresets'
import { SCHEMES } from './schemes'
import { ALGS, type RubikHandle } from './RubikMask'
import { Floral } from './Floral'
import { XrayFloral } from './XrayFloral'
import { XrayFlower3D } from './XrayFlower3D'
import { FLORAL_OF } from './floralVersions'
import { AsciiPortrait } from './Ascii'

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

/** the section transition: the site cube spins and flies into the camera (the transition tab's v1 flight), the
 *  section page fades in over the landing; the page is the screen-as-cube with Aaron's picks (w4 branching eased weld,
 *  no recoil); home reverses the same flight */
const FLIGHT = TRANSITION_OF('v1')!
const PAGE = CUBE_OF('w4 branching eased')!
const FOV = 30 // the mask camera's vertical fov (Canvas below)
/** a section's projects: those tagged with its id in PROJECTS; a section with none shows them all */
const projectsOf = (id: string) => { const own = PROJECTS.filter((p) => p.meta.startsWith(id)); return own.length ? own : PROJECTS }

/** the cube emits the scheme's hue: scheme name -> heat preset */
const HEAT_OF_SCHEME: Record<string, string> = { icemint: 'icemint', ice: 'icemint', mint: 'icemint', ember: 'ember', graphite: 'graphite', aura: 'default', paper: 'sepia' }

/** cube versions worth comparing in place; key `v` cycles. Versions whose own preset is light get a dark one here. */
const SITE_VERSIONS = ['v17', 'v16', 'v15', 'v14', 'v1', 'v9', 'v4', 'v7', 'v2', 'v6']
const SITE_PRESET: Record<string, string> = { v6: 'ice' }
/** j k l run the famous algorithms at speedcubing pace */
export const ALG_KEYS: Record<string, string> = { j: 'T perm', k: 'U perm', l: 'Sune' }
/** the site cube's themes (v14 / v15), key g cycles; the on-screen toggle is gone since Aaron settled on mint grain */
const SITE_THEMES: [string, string][] = [['ice grain', 'ice'], ['mint grain', 'mint'], ['icemint grain soft', 'icemint']]

export function Site({ version: initial = 'v17', scheme = 'icemint', bg = '#07090c', floral = 'v18', floralSeed = 3, flower }: { version?: string; scheme?: string; bg?: string; floral?: string; floralSeed?: number; flower?: string }) {
  const xray0 = FLORAL_OF(floral)
  // the hand-placed group (v14+) sits in the base row a little closer than the tab shows it, in a taller box
  const xray = useMemo(() => (xray0?.scene?.place ? { ...xray0, scene: { ...xray0.scene, camDist: (xray0.scene.camDist ?? 9.4) / 1.9 } } : xray0), [xray0])
  const [active, setActive] = useState(0)
  const [version, setVersion] = useState(VERSION_OF(initial) ? initial : 'v17')
  // a deep-linked version outside the curated cycle still cycles from itself
  const cycle = useMemo(() => Array.from(new Set([VERSION_OF(initial) ? initial : 'v17', ...SITE_VERSIONS])), [initial])
  const [open, setOpen] = useState<{ section: number; item: number } | null>(null)
  // layout A/B: sections in the corners, or deck only (the deck carries the blurb, panels do the rest)
  const [layout, setLayout] = useState<'corners' | 'deck'>('corners')
  const [siteTheme, setSiteTheme] = useState(SITE_THEMES[1][0])
  const rubik = useRef<RubikHandle | null>(null)
  // review hook: the Playwright sweeps drive the site's own cube (App's __aar only reaches the lab cube)
  useEffect(() => { window.__aarSite = rubik }, [])
  // the section transition: `section` is the page shown (mounted at take-off, faded in over the landing), `flying`
  // while the timeline runs either way; the same timeline reversed is the way home
  const fly = useRef<FlyHandle | null>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)
  const overlay = useRef<HTMLDivElement | null>(null)
  const grid = useRef<ScreenHandle | null>(null)
  const [section, setSection] = useState<number | null>(null)
  const [flying, setFlying] = useState(false)
  const away = flying || section !== null
  const go = (i: number) => {
    const h = fly.current
    if (!h || tl.current) return
    setOpen(null)
    setActive(i)
    setSection(i)
    setFlying(true)
    const { root, camera: cam } = h
    // face-on = the root at the camera's own rotation (its +z then points up the view axis), plus whole spins;
    // the y spins carry on from wherever the idle spin left the cube
    const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'XYZ')
    const ey = e.y + Math.PI * 2 * Math.ceil((root.rotation.y - e.y) / (Math.PI * 2))
    // fly up the view axis to where the face fills paper's square window (overshoot flies closer), while the window
    // itself grows to cover the viewport
    const dist = h.half / Math.tan((FOV * Math.PI) / 360) / FLIGHT.overshoot
    const to = cam.position.clone().addScaledVector(cam.getWorldDirection(new THREE.Vector3()), dist)
    const zoom = { k: 1 }
    const kFill = Math.max(window.innerWidth / window.innerHeight, 1) / h.scale0
    const dur = reduced ? 0.01 : FLIGHT.duration
    const t = gsap.timeline({
      onUpdate: () => { if (overlay.current) overlay.current.style.opacity = String(Math.min(1, Math.max(0, (t.progress() - FLIGHT.fadeAt) / (1 - FLIGHT.fadeAt)))) },
      onComplete: () => setFlying(false),
      onReverseComplete: () => { tl.current = null; h.zoom(1); setSection(null); setFlying(false) },
    })
    t.to(root.rotation, { x: e.x + Math.PI * 2 * FLIGHT.spin[0], y: ey + Math.PI * 2 * FLIGHT.spin[1], z: e.z, duration: dur, ease: FLIGHT.spinEase }, 0)
    t.to(root.position, { x: to.x, y: to.y, z: to.z, duration: dur, ease: FLIGHT.approachEase }, 0)
    t.to(zoom, { k: kFill, duration: dur, ease: FLIGHT.approachEase, onUpdate: () => h.zoom(zoom.k) }, 0)
    tl.current = t
  }
  const home = () => { const t = tl.current; if (!t || t.reversed()) return; setFlying(true); t.reverse() }
  const goRef = useRef({ go, home })
  goRef.current = { go, home }
  useEffect(() => { window.__aarNav = { go: (i) => goRef.current.go(i), home: () => goRef.current.home(), next: () => grid.current?.next() ?? Promise.resolve(), busy: () => (tl.current?.isActive() ?? false) || (grid.current?.busy() ?? false), section: () => section } }, [section])
  // the lab's v1 at its own camera (blur radii are frame-relative, so the cube stays crisp);
  // paper's `scale` shrinks the whole image on screen so the sections breathe
  const narrow = typeof window !== 'undefined' && window.innerWidth < 900
  // narrow screens are usually integrated GPUs: a 768 mask keeps the heat blurs cheap
  const PV = useMemo(() => ({ ...VERSION_OF(version)!, size: narrow ? 768 : 1024, bigDiv: narrow ? (4 as const) : (2 as const) }), [version, narrow])
  const params = useMemo(() => {
    const want = PV.themes ? siteTheme : (SITE_PRESET[version] ?? (PV.shader === 'heat' && PV.preset === undefined ? HEAT_OF_SCHEME[scheme] : PV.preset))
    const base = presetNamed(PV.shader, want).params
    // the page is the shader's background, so the scheme's bg is paper's colorBack
    // heat shows the mask through paper's 57% window, liquid the whole mask, so liquid needs a smaller scale on narrow screens
    const k = PV.shader === 'heat' ? (narrow ? 0.7 : 0.85) : narrow ? 0.45 : 0.85
    return { ...base, ...(PV.shader === 'heat' ? { outerGlow: 0.42, contour: 0.75 } : {}), colorBack: bg, scale: k * (base.scale as number) }
  }, [PV, narrow, scheme, version, bg, siteTheme])

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
    // in a section (or on the way): escape flies home, n / right arrow is the next project; the deck keys are off
    if (away) {
      if (e.key === 'Escape') home()
      if (section !== null && !flying && (e.key === 'n' || e.key === 'ArrowRight')) grid.current?.next()
      return
    }
    if (e.key === 'Escape') setOpen(null)
    if (e.key === 'Enter') go(active)
    if (e.key === 'ArrowRight') step(active + 1)
    if (e.key === 'ArrowLeft') step(active - 1)
    if (e.key === 'x') setLayout((l) => (l === 'corners' ? 'deck' : 'corners'))
    const alg = ALG_KEYS[e.key.toLowerCase()] // caps lock must not matter
    if (alg) rubik.current?.run(ALGS[alg])
    if (e.key === 'g') setSiteTheme((t) => SITE_THEMES[(SITE_THEMES.findIndex(([n]) => n === t) + 1) % SITE_THEMES.length][0])
    if (e.key === 'v') setVersion((v) => cycle[(cycle.indexOf(v) + 1) % cycle.length])
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
      if (!awayRef.current) stepRef.current(activeRef.current + (e.deltaY > 0 ? 1 : -1))
    }
    // touch: a horizontal swipe steps the deck
    let x0 = 0
    const onCanvas = (e: TouchEvent) => (e.target as Element | null)?.closest?.('canvas') != null
    const ts = (e: TouchEvent) => { x0 = onCanvas(e) ? NaN : e.touches[0].clientX } // orbiting the cube is not a swipe
    const te = (e: TouchEvent) => {
      if (Number.isNaN(x0)) return
      const dx = e.changedTouches[0].clientX - x0
      if (Math.abs(dx) > 48 && !awayRef.current) stepRef.current(activeRef.current + (dx < 0 ? 1 : -1))
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
  const awayRef = useRef(away)
  awayRef.current = away
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <>
      <Canvas key={version} dpr={[1, 1.5]} camera={{ position: [0, 0, PV.camZ], fov: 30 }} gl={{ antialias: true }}>
        <PaperCube version={PV} params={params} spin={!reduced && !away} spinSpeed={0.12} auto={!reduced && !away} autoInterval={6500} rubik={rubik} fly={fly} />
      </Canvas>
      {/* the section page: the screen as a cube, faded in over the landing; the wordmark (or escape) flies home */}
      {section !== null && (
        <div className="section-page" ref={overlay}>
          <CubeScreen key={section} ref={grid} v={PAGE} scheme={scheme} recoil={false} projects={projectsOf(SECTIONS[section].id)} />
          <button className="wordmark home" onClick={home} aria-label="home">aarcube</button>
          <div className="page-hint"><span>{SECTIONS[section].title.toLowerCase()}</span><button onClick={() => grid.current?.next()}>next (n)</button><button onClick={home}>home (esc)</button></div>
        </div>
      )}
      {xray?.placement === 'bottom' && <BottomBed v={xray} seed={floralSeed} scheme={scheme} />}
      <div className="aura" />
      <div className="grain" />
      <div className={`ui site layout-${layout} ${open ? 'has-panel' : ''} ${away ? 'away' : ''}`}>
        <header className="site-head">
          <div className="wordmark">aarcube</div>
          <p className="site-intro">Aaron. Engineer of small machines and large gradients.</p>
        </header>
        {SECTIONS.map((s, i) => (
          <section key={s.id} className={`sec sec-${s.id} ${i === active ? 'on' : ''}`} onClick={() => (i === active ? go(i) : step(i))}>
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
          {xray?.placement === 'bottom' ? null : xray ? (xray.kind === 'mesh' ? <XrayFlower3D v={xray} flower={flower} seed={floralSeed} height={xray.scene?.place ? 210 : undefined} className={`floral xray ${xray.scene?.place ? 'group' : ''}`} scheme={scheme} /> : <XrayFloral v={xray} seed={floralSeed} className="floral xray" scheme={scheme} />) : <Floral className="floral" seed={11 + 7 * Math.max(0, SCHEMES.findIndex((x) => x.name === scheme))} />}
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
              <button key={s.id} className={i === active ? 'on' : ''} onClick={() => (i === active ? go(i) : step(i))} aria-label={s.title}>
                <i />
                <span>{s.title.toLowerCase()}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  )
}

declare global {
  interface Window {
    __aarSite: React.RefObject<RubikHandle | null>
    /** the section transition: fly to a section, home, next project, busy while a flight or a turn runs */
    __aarNav: { go: (i: number) => void; home: () => void; next: () => Promise<void>; busy: () => boolean; section: () => number | null }
  }
}

/** the flower bed as a page-wide strip along the bottom, sized to the window */
function BottomBed({ v, seed, scheme }: { v: NonNullable<ReturnType<typeof FLORAL_OF>>; seed: number; scheme: string }) {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440))
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const h = Math.round(Math.min(260, Math.max(160, w * 0.17)))
  return <XrayFlower3D key={`${v.name}-${seed}-${w}`} v={v} seed={seed} width={w} height={h} scheme={scheme} className="floral-bottom" upright />
}
