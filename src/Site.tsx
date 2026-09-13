/**
 * The site. The shader cube in the middle is the menu: four sections around it stepped like a deck (arrows, 1–4,
 * wheel, swipe; every step turns a layer; a double click or tap on the cube runs an algorithm), the three ghost blooms at
 * the base. Enter, or the active section clicked,
 * flies the cube into that section: the page around it fades, the cube spins up to the camera and lands with one
 * face filling the screen, the face stretches into the viewport and fades into the page's own dark ground, leaving
 * the section's first project. `n` turns the cube to the next project (the cube comes back, turns, fades again);
 * Escape or the wordmark flies home along the same path, reversed.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { PaperCube, type FlyHandle } from './PaperCube'
import { ScreenCube, type ScreenHandle } from './ScreenCube'
import { ALGS, type RubikHandle } from './RubikMask'
import { XrayFlower3D } from './XrayFlower3D'
import { AsciiPortrait } from './Ascii'
import { CUBE, LIQUID } from './cube'
import { FLORAL } from './florals'
import { PROJECTS, SECTIONS, SITE, projectsOf, type Project } from './content'

const FOV = 30 // the mask camera's vertical fov
/** the flight: whole turns about x and y (the cube ends face-on either way), its length and eases */
const FLIGHT = { spin: [1, 1.5], duration: 2.2, approachEase: 'power3.in', spinEase: 'power2.inOut' }
/** before take-off the page around the cube fades out over PRE s (and the ascii outline with it, on the CSS ease); the flight
 *  starts LEAD s into that fade so the cube is already moving as the last of the text goes */
const PRE = 1
const LEAD = 0.5
const UI_EASE = 'expo.out'
/** the stretch into the viewport (STRETCH s) starts OVERLAP s before the flight lands, so the face is already spreading as it
 *  arrives; the page layer takes over the drawing at the landing and the text fades in over the second half */
const STRETCH = 0.9
const OVERLAP = 0.45
/** from the landing, the tiles fade into the page's ground over GHOST s; a turn brings them back over WAKE s and fades them again */
const GHOST = 0.9
const WAKE = 0.6
/** the florals' canvas is GROUP_OVER times taller than its layout footprint (`--fh` in styles.css) and the camera that much
 *  farther, so the flowers keep their size with headroom above and below */
const GROUP_OVER = 1.5
/** a double click or double tap on the cube runs the next of the famous algorithms at speedcubing pace */
const ALG_CYCLE = ['T perm', 'U perm', 'Sune']
const DOUBLE_TAP = 350

export function Site() {
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState<Project | null>(null)
  const rubik = useRef<RubikHandle | null>(null)
  const fly = useRef<FlyHandle | null>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)
  const grid = useRef<ScreenHandle | null>(null)
  const overlay = useRef<HTMLDivElement | null>(null) // the section page's DOM (wordmark, hint): fades with the spread
  // the whole sequence's phase: 'out' while going or coming (nothing else may start), 'in' on the page, null at home
  const phase = useRef<'out' | 'in' | null>(null)
  const [section, setSection] = useState<number | null>(null)
  // one array per section: a fresh array each render would rebuild the screen cube's textures and reset it mid-trip
  const projects = useMemo(() => (section === null ? PROJECTS : projectsOf(SECTIONS[section].id)), [section])
  const [flying, setFlying] = useState(false)
  const away = flying || section !== null
  const [hidden, setHidden] = useState(false) // the page around the cube, faded out before take-off and back in on landing home
  // the idle spin runs right up to the moment the flight takes the rotation and resumes the moment it hands it back
  const [still, setStill] = useState(false)
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const narrow = typeof window !== 'undefined' && window.innerWidth < 900
  // a short phone: the cube shrinks with the height so it clears the section's title (the lift is a fixed 10vh)
  const short = typeof window !== 'undefined' ? Math.min(1, (window.innerHeight / 820) ** 1.6) : 1

  /** the landed square face ↔ the viewport: the paper window and the page layer's tiles move together; over the second half the
   *  text fades in; `onHalf` fires as k crosses .5 */
  const spread = (to: 0 | 1, duration: number, onHalf?: () => void) => new Promise<void>((res) => {
    const h = fly.current, g = grid.current
    if (!h) return res()
    const aspect = window.innerWidth / window.innerHeight
    const k = { v: 1 - to }
    let halved = false
    const apply = () => {
      if (aspect >= 1) { const sx = 1 + (aspect - 1) * k.v; h.stretch(sx, 1); g?.setScale(sx / aspect, 1); g?.setFace((1 - sx / aspect) / 2, 0, sx / aspect, 1) }
      else { const sy = 1 + (1 / aspect - 1) * k.v; h.stretch(1, sy); g?.setScale(1, sy * aspect); g?.setFace(0, (1 - sy * aspect) / 2, 1, sy * aspect) }
      const f = Math.min(1, Math.max(0, (k.v - 0.5) * 2))
      g?.setFade(f)
      if (overlay.current) overlay.current.style.opacity = String(f)
      if (onHalf && !halved && (to === 1 ? k.v >= 0.5 : k.v <= 0.5)) { halved = true; onHalf() }
    }
    apply()
    gsap.to(k, { v: to, duration, ease: 'power2.inOut', onUpdate: apply, onComplete: res })
  })
  /** the tiles' liquid fades into the page's ground (on) or comes back (off) */
  const ghost = (on: boolean, duration: number) => new Promise<void>((res) => {
    const g = grid.current
    if (!g) return res()
    const a = { v: on ? 1 : 0 }
    gsap.to(a, { v: on ? 0 : 1, duration, ease: 'power2.inOut', onUpdate: () => g.setAlpha(a.v), onComplete: res })
  })

  const go = async (i: number) => {
    const h = fly.current
    if (!h || tl.current || phase.current) return
    phase.current = 'out'
    setOpen(null)
    setActive(i)
    setSection(i)
    setFlying(true)
    setHidden(true)
    const { root, camera: cam } = h
    // face-on = the root at the camera's own rotation (its +z then points up the view axis), plus whole spins;
    // the y spins carry on from wherever the idle spin left the cube
    const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'XYZ')
    const ey = e.y + Math.PI * 2 * Math.ceil((root.rotation.y - e.y) / (Math.PI * 2))
    // fly up the view axis to where the face plane fills paper's square window, while the window grows to the viewport's
    // short side: the landed face is a square filling the height (landscape) or the width
    const dist = h.half + h.half / Math.tan((FOV * Math.PI) / 360)
    const to = cam.position.clone().addScaledVector(cam.getWorldDirection(new THREE.Vector3()), dist)
    const zoom = { k: 1 }
    const aspect = window.innerWidth / window.innerHeight
    const kFill = Math.min(aspect, 1) / h.scale0
    const dur = reduced ? 0.01 : FLIGHT.duration
    const pre = reduced ? 0.01 : PRE
    const lead = reduced ? 0.01 : LEAD
    // the ascii outline fades with the page: its own tweens (not in the timeline, which would reverse the curve on the way home)
    const asc = { k: 1 }
    const fadeAscii = (k: number) => gsap.to(asc, { k, duration: pre, ease: UI_EASE, overwrite: true, onUpdate: () => h.ascii(asc.k) })
    fadeAscii(0)
    let landed!: () => void
    const landing = new Promise<void>((res) => { landed = res })
    const t = gsap.timeline({
      onComplete: () => landed(),
      onReverseComplete: () => { tl.current = null; phase.current = null; h.zoom(1); h.ascii(1); h.stretch(1, 1); h.capture(false); setHidden(false); setStill(false); setSection(null); setFlying(false) },
    })
    // 1. the surroundings fade (CSS, `hidden`) and the outline with them; 2. the flight from `lead`; reversed, the callback at
    //    the take-off point fires as the cube lands home and the page fades back in with the outline
    t.call(() => { const back = t.reversed(); setStill(!back); if (back) { setHidden(false); fadeAscii(1) } }, [], lead)
    t.to(root.rotation, { x: e.x + Math.PI * 2 * FLIGHT.spin[0], y: ey + Math.PI * 2 * FLIGHT.spin[1], z: e.z, duration: dur, ease: FLIGHT.spinEase }, lead)
    t.to(root.position, { x: to.x, y: to.y, z: to.z, duration: dur, ease: FLIGHT.approachEase }, lead)
    t.to(zoom, { k: kFill, duration: dur, ease: FLIGHT.approachEase, onUpdate: () => h.zoom(zoom.k) }, lead)
    // the spread begins before the landing and the page layer takes over at the landing (the reverse crosses this callback too)
    let spreading: Promise<void> | null = null
    t.call(() => { if (!t.reversed()) spreading = spread(1, reduced ? 0.01 : STRETCH) }, [], Math.max(0, lead + dur - (reduced ? 0 : OVERLAP)))
    tl.current = t
    await landing
    h.capture(true)
    grid.current?.setLive(true)
    await Promise.all([spreading, ghost(true, reduced ? 0.01 : GHOST)])
    // at rest the page shows none of the cube: the paper pipeline sleeps
    h.sleep(true)
    phase.current = 'in'
    setFlying(false)
  }
  const waking = useRef(false)
  /** the next project: the liquid comes back, the cube turns, the liquid fades again; the text rides the tiles throughout */
  const nextProject = async () => {
    const g = grid.current, h = fly.current
    if (!g || !h || waking.current || g.busy() || phase.current !== 'in') return
    waking.current = true
    h.sleep(false)
    await ghost(false, reduced ? 0.01 : WAKE)
    await g.next()
    await ghost(true, reduced ? 0.01 : WAKE)
    h.sleep(true)
    waking.current = false
  }
  const home = async () => {
    const t = tl.current, h = fly.current
    if (!t || !h || phase.current !== 'in' || waking.current) return
    phase.current = 'out'
    setFlying(true)
    // the liquid comes back, the face starts squaring; halfway the shader cube draws itself again and the flight reverses,
    // zooming out while the face finishes squaring
    h.sleep(false)
    await ghost(false, reduced ? 0.01 : 0.5)
    await spread(0, reduced ? 0.01 : STRETCH, () => { grid.current?.setLive(false); h.capture(false); t.reverse() })
  }
  const nav = useRef({ go, home, next: nextProject })
  nav.current = { go, home, next: nextProject }
  useEffect(() => { window.__aarNav = { go: (i) => nav.current.go(i), home: () => nav.current.home(), next: () => nav.current.next(), busy: () => phase.current === 'out' || waking.current || (grid.current?.busy() ?? false), section: () => section } }, [section])

  // deck stepping: arrows / digits; every step turns one layer
  const step = (i: number) => {
    setOpen(null)
    setActive(((i % SECTIONS.length) + SECTIONS.length) % SECTIONS.length)
    rubik.current?.turn()
  }
  // one stable window listener; the live handler lives in a ref
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {})
  onKey.current = (e) => {
    // in a section (or on the way): escape flies home, n / right arrow is the next project; the deck keys are off
    if (away) {
      if (e.key === 'Escape') home()
      if (section !== null && !flying && (e.key === 'n' || e.key === 'ArrowRight')) nextProject()
      return
    }
    if (e.key === 'Escape') setOpen(null)
    if (e.key === 'Enter') go(active)
    if (e.key === 'ArrowRight') step(active + 1)
    if (e.key === 'ArrowLeft') step(active - 1)
    const n = Number(e.key)
    if (n >= 1 && n <= SECTIONS.length) step(n - 1)
  }
  const stepRef = useRef(step)
  stepRef.current = step
  const algIx = useRef(0)
  const runAlg = () => { if (awayRef.current) return; rubik.current?.run(ALGS[ALG_CYCLE[algIx.current]]); algIx.current = (algIx.current + 1) % ALG_CYCLE.length }
  const runAlgRef = useRef(runAlg)
  runAlgRef.current = runAlg
  const activeRef = useRef(active)
  activeRef.current = active
  const awayRef = useRef(away)
  awayRef.current = away
  useEffect(() => {
    const f = (e: KeyboardEvent) => onKey.current(e)
    // no scrolling page: the wheel walks the deck, one step per gesture
    let last = 0
    const w = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 24 || performance.now() - last < 900) return
      last = performance.now()
      if (!awayRef.current) stepRef.current(activeRef.current + (e.deltaY > 0 ? 1 : -1))
    }
    // touch: a horizontal swipe steps the deck (orbiting the cube is not a swipe); a double tap on the cube runs an algorithm
    let x0 = 0
    let lastTap = 0
    const onCanvas = (e: Event) => (e.target as Element | null)?.closest?.('canvas') != null
    const ts = (e: TouchEvent) => { x0 = onCanvas(e) ? NaN : e.touches[0].clientX }
    const te = (e: TouchEvent) => {
      if (Number.isNaN(x0)) {
        const now = performance.now()
        if (now - lastTap < DOUBLE_TAP) { lastTap = 0; runAlgRef.current() } else lastTap = now
        return
      }
      const dx = e.changedTouches[0].clientX - x0
      if (Math.abs(dx) > 48 && !awayRef.current) stepRef.current(activeRef.current + (dx < 0 ? 1 : -1))
    }
    const dbl = (e: MouseEvent) => { if (onCanvas(e)) runAlgRef.current() }
    window.addEventListener('keydown', f)
    window.addEventListener('wheel', w, { passive: true })
    window.addEventListener('touchstart', ts, { passive: true })
    window.addEventListener('touchend', te, { passive: true })
    window.addEventListener('dblclick', dbl)
    return () => {
      window.removeEventListener('keydown', f)
      window.removeEventListener('wheel', w)
      window.removeEventListener('touchstart', ts)
      window.removeEventListener('touchend', te)
      window.removeEventListener('dblclick', dbl)
    }
  }, [])

  const openProject = (p: Project) => { setOpen(p); rubik.current?.turn() }
  const panelRight = open && (open.section === 'about' || open.section === 'creatives')

  return (
    <>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, CUBE.camZ], fov: FOV }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <PaperCube size={narrow ? 768 : CUBE.size} scale={narrow ? LIQUID.scale * 0.53 * short : LIQUID.scale} spin={!reduced && !still} spinSpeed={0.12} auto={!reduced && !away} autoInterval={3600} combo={0.35} rubik={rubik} fly={fly} />
        {/* the section page: the screen cube drawn in this same canvas, its tiles sampling the shader cube's captured image */}
        {section !== null && fly.current && <ScreenCube key={section} ref={grid} projects={projects} liquid={fly.current.shot} />}
      </Canvas>
      {section !== null && (
        <div className="section-page" ref={overlay}>
          <button className="wordmark home" onClick={home} aria-label="home">{SITE.name}</button>
          <div className="page-hint"><span>{SECTIONS[section].title.toLowerCase()}</span><button onClick={nextProject}>next (n)</button><button onClick={home}>home (esc)</button></div>
        </div>
      )}
      <div className="aura" />
      <div className="grain" />
      <div className={`ui site ${open ? 'has-panel' : ''} ${hidden ? 'away' : ''}`}>
        <header className="site-head">
          <div className="wordmark">{SITE.name}</div>
          <p className="site-intro">{SITE.intro}</p>
        </header>
        {SECTIONS.map((s, i) => (
          <section key={s.id} className={`sec sec-${s.id} ${i === active ? 'on' : ''}`} onClick={() => (i === active ? go(i) : step(i))}>
            <h2>{s.title}</h2>
            {s.id === 'about' && SITE.portrait && (
              <div className="portrait" title="ascii portrait">
                <AsciiPortrait cols={30} rows={18} cell={4} />
              </div>
            )}
            <p>{s.blurb}</p>
            <ul>
              {s.notes?.map((n) => <li key={n} className="note">{n}</li>)}
              {projectsOf(s.id).map((p) => {
                const openIt = (e: React.SyntheticEvent) => { e.stopPropagation(); setActive(i); openProject(p) }
                return (
                  <li key={p.title} role="button" tabIndex={0} onClick={openIt} onKeyDown={(e) => e.key === 'Enter' && openIt(e)}>
                    {p.title}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        {open && (
          <aside className={`panel ${panelRight ? 'panel-right' : 'panel-left'}`}>
            <span className="panel-k">{open.section} · {open.year}</span>
            <h3>{open.title}</h3>
            <p>{open.detail ?? open.blurb}</p>
            {(open.stack || open.link) && (
              <p className="panel-meta">
                {open.stack}
                {open.stack && open.link && ' · '}
                {open.link && <a href={open.link.href} target="_blank" rel="noreferrer">{open.link.label}</a>}
              </p>
            )}
            <button className="panel-close" onClick={() => setOpen(null)}>close</button>
          </aside>
        )}
        <div className="site-base">
          <XrayFlower3D className="floral" camDist={(FLORAL.camDist / 1.9) * GROUP_OVER} />
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
    /** the verify scripts' hook: fly to a section, home, next project, busy while a flight or a turn runs */
    __aarNav: { go: (i: number) => void; home: () => void; next: () => Promise<void>; busy: () => boolean; section: () => number | null }
  }
}
