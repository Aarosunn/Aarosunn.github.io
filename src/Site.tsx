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
import { CubeScreen, LANDED_INSET, LANDED_SEAM, ScreenCube, type CubeHandle } from './CubeScreen'
import { CUBE_OF, TRANSITION_OF } from './transitionVersions'
import { SITE_TRANSITION_OF, SITE_TRANSITIONS, type SiteVersion } from './siteVersions'
import { PROJECTS } from './ScreenSolve'
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

/** the section transition (a site version, `SITE_VERSIONS`: s1 the face overfills and the page fades in, s2 the cube lands
 *  square, dims, stretches and solves the page in); the page is the screen-as-cube with Aaron's picks (w4 branching eased
 *  weld, no recoil); home reverses the same flight */
const PAGE = CUBE_OF('w4 branching eased')!
/** s6: the same turns with no break and no weld (the gaps never open, no seam lines) */
const PAGE_BARE = { ...PAGE, gap: 0, open: 0, hold: 0 }
const FOV = 30 // the mask camera's vertical fov (Canvas below)
/** before take-off the page around the cube fades out (and the ascii outline with it, `UI_EASE` = the CSS --ease); the flight
 *  starts `LEAD` s into that fade so the cube is already moving as the last of the text goes; on the way home they fade back in as the cube lands */
const PRE = 1
const LEAD = 0.5
const UI_EASE = 'expo.out'
/** s2: one motion in and one out. The stretch into the viewport (`STRETCH` s) starts `OVERLAP` s before the flight lands, so the
 *  face is already spreading as it arrives; the page layer takes over the drawing at the landing and the text fades in over the
 *  second half while the liquid settles into the still gradient and the cubies close up. Home: the text fades and the face starts
 *  squaring back, and halfway the shader cube draws itself again and the flight reverses, zooming out while it finishes squaring. */
const STRETCH = 0.9
const OVERLAP = 0.45
/** s3: at the landing the seams stay as gaps and the laser weld closes them over `WELD` s, while the liquid's clock is pushed
 *  `SWEEP` s ahead over `SETTLE` s (one last highlight through) as it settles onto the solid dark mint */
const WELD = 1.3
const SETTLE = 1.6
/** s4: seconds for the liquid to fade to its faint layer and the seams to narrow, from the landing */
const GHOST = 0.9
/** s5: seconds for the liquid to come back before a turn, and to fade again after the weld */
const WAKE = 0.6
const SWEEP = 2.5
/** the hand-placed floral group's canvas is `GROUP_OVER` times taller than its layout footprint (`--fh` in styles.css, 222 px on a
 *  900 px screen, shrinking with a shorter viewport so the base row never runs off the bottom) and the camera that much
 *  farther, so the flowers keep their size with headroom above and below: their petals were being cut by the canvas edge */
const GROUP_OVER = 1.5
/** a section's projects: those tagged with its id in PROJECTS; a section with none shows them all */
const projectsOf = (id: string) => { const own = PROJECTS.filter((p) => p.meta.startsWith(id)); return own.length ? own : PROJECTS }

/** the cube emits the scheme's hue: scheme name -> heat preset */
const HEAT_OF_SCHEME: Record<string, string> = { icemint: 'icemint', ice: 'icemint', mint: 'icemint', ember: 'ember', graphite: 'graphite', aura: 'default', paper: 'sepia' }

/** cube versions worth comparing in place; key `v` cycles. Versions whose own preset is light get a dark one here. */
const SITE_VERSIONS = ['v18', 'v17', 'v16', 'v15', 'v14', 'v1', 'v9', 'v4', 'v7', 'v2', 'v6']
const SITE_PRESET: Record<string, string> = { v6: 'ice' }
/** j k l run the famous algorithms at speedcubing pace */
export const ALG_KEYS: Record<string, string> = { j: 'T perm', k: 'U perm', l: 'Sune' }
/** the site cube's themes (v14 / v15), key g cycles; the on-screen toggle is gone since Aaron settled on mint grain */
const SITE_THEMES: [string, string][] = [['ice grain', 'ice'], ['mint grain', 'mint'], ['icemint grain soft', 'icemint']]

export function Site({ version: initial = 'v18', scheme = 'icemint', bg = '#07090c', floral = 'v18', floralSeed = 3, flower, site: siteInitial = 's1' }: { version?: string; scheme?: string; bg?: string; floral?: string; floralSeed?: number; flower?: string; site?: string }) {
  // the section transition's version (key t cycles); FLIGHT is its flight
  const [sv, setSv] = useState<SiteVersion>(SITE_TRANSITION_OF(siteInitial) ?? SITE_TRANSITIONS[0])
  const FLIGHT = TRANSITION_OF(sv.flight)!
  const xray0 = FLORAL_OF(floral)
  // the hand-placed group (v14+) sits in the base row a little closer than the tab shows it, in a taller box
  const xray = useMemo(() => (xray0?.scene?.place ? { ...xray0, scene: { ...xray0.scene, camDist: ((xray0.scene.camDist ?? 9.4) / 1.9) * GROUP_OVER } } : xray0), [xray0])
  const [active, setActive] = useState(0)
  const [version, setVersion] = useState(VERSION_OF(initial) ? initial : 'v18')
  // a deep-linked version outside the curated cycle still cycles from itself
  const cycle = useMemo(() => Array.from(new Set([VERSION_OF(initial) ? initial : 'v18', ...SITE_VERSIONS])), [initial])
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
  const grid = useRef<CubeHandle | null>(null)
  // the whole sequence's phase: 'out' while going or coming (nothing else may start), 'in' on the page, null at home
  const phase = useRef<'out' | 'in' | null>(null)
  const [section, setSection] = useState<number | null>(null)
  // one array per section: a fresh array each render would rebuild the screen cube's textures and reset it mid-trip
  const projects = useMemo(() => (section === null ? PROJECTS : projectsOf(SECTIONS[section].id)), [section])
  const [flying, setFlying] = useState(false)
  const away = flying || section !== null
  const [hidden, setHidden] = useState(false) // the page around the cube, faded out before take-off and back in on landing home
  // the idle spin runs right up to the moment the flight takes the rotation and resumes the moment it hands it back,
  // so the cube never sits still during the fades
  const [still, setStill] = useState(false)
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
    // fly up the view axis to where the face fills paper's square window (overshoot flies closer), while the window
    // itself grows to the viewport's short side: the landed face is a square filling the height (landscape) or the width
    // the face plane (h.half nearer than the cube's centre) fills the window at h.half / tan(fov/2) from the camera; the centre sits
    // h.half farther. Overshoot flies closer. (Set to the centre alone, perspective made the face 1.33× the window and the seams
    // landed a third of the way inside the page's tiles.)
    const dist = h.half + h.half / Math.tan((FOV * Math.PI) / 360) / FLIGHT.overshoot
    const to = cam.position.clone().addScaledVector(cam.getWorldDirection(new THREE.Vector3()), dist)
    const zoom = { k: 1 }
    // 'stretch' lands the square face on the viewport's short side; 'fade' overfills the viewport (the window grows to its long side)
    const aspect = window.innerWidth / window.innerHeight
    const kFill = (sv.join === 'stretch' ? Math.min(aspect, 1) : Math.max(aspect, 1)) / h.scale0
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
      // 'fade': the page fades in over the flight's last stretch (and out again on the way home)
      onUpdate: () => { if (sv.join === 'fade' && overlay.current) overlay.current.style.opacity = String(Math.min(1, Math.max(0, (t.time() - lead - FLIGHT.fadeAt * dur) / ((1 - FLIGHT.fadeAt) * dur)))) },
      onReverseComplete: () => { tl.current = null; phase.current = null; h.zoom(1); h.ascii(1); h.stretch(1, 1); h.settle(0); h.sweep(0); h.freeze(false); h.capture(false); setHidden(false); setStill(false); setSection(null); setFlying(false) },
    })
    // 1. the surroundings fade (CSS, `hidden`) and the ascii outline with them; 2. the flight from `lead`; reversed, the
    //    callback at the take-off point fires as the cube lands home and the page fades back in with the outline
    t.call(() => { const back = t.reversed(); setStill(!back); if (back) { setHidden(false); fadeAscii(1) } }, [], lead)
    t.to(root.rotation, { x: e.x + Math.PI * 2 * FLIGHT.spin[0], y: ey + Math.PI * 2 * FLIGHT.spin[1], z: e.z, duration: dur, ease: FLIGHT.spinEase }, lead)
    t.to(root.position, { x: to.x, y: to.y, z: to.z, duration: dur, ease: FLIGHT.approachEase }, lead)
    t.to(zoom, { k: kFill, duration: dur, ease: FLIGHT.approachEase, onUpdate: () => h.zoom(zoom.k) }, lead)
    // 'stretch': the spread begins before the landing (the flight's last OVERLAP s) and the page layer takes over at the landing
    let spreading: Promise<void> | null = null
    if (sv.join === 'stretch') t.call(() => { if (!t.reversed()) spreading = spread(1, reduced ? 0.01 : STRETCH) }, [], Math.max(0, lead + dur - (reduced ? 0 : OVERLAP))) // (the reverse crosses this callback too)
    tl.current = t
    await landing
    if (sv.join === 'stretch') {
      h.capture(true)
      grid.current?.setLive(true)
      // s3: the seams weld shut and the liquid settles solid, both from the landing, alongside the rest of the spread
      const extras: Promise<unknown>[] = []
      if (sv.weldIn) extras.push(grid.current?.weldIn(reduced ? 0.01 : WELD) ?? Promise.resolve())
      if (sv.settle === 'solid') extras.push(settleSolid(1, reduced ? 0.01 : SETTLE))
      if (sv.settle === 'frozen') { h.freeze(true); extras.push(settleFrozen(1, reduced ? 0.01 : 0.8)) }
      if (sv.ghost) extras.push(ghost(true, reduced ? 0.01 : GHOST))
      await Promise.all([spreading, ...extras])
    }
    phase.current = 'in'
    setFlying(false)
  }
  /** s4: the tiles' liquid fades to `ghost.alpha` over the page's dark ground while the seams narrow from the landed cube's to `ghost.gap` (back: the reverse) */
  const ghost = (on: boolean, duration: number, from: number | null = on ? LANDED_SEAM : gh0()) => {
    const g = grid.current, gh = sv.ghost
    if (!g || !gh) return Promise.resolve()
    const a = { v: on ? 0 : 1 }, white = new THREE.Color(1, 1, 1), mint = new THREE.Color(gh.tint), c = new THREE.Color()
    const fade = new Promise<void>((res) => gsap.to(a, { v: on ? 1 : 0, duration, ease: 'power2.inOut', onUpdate: () => g.setAlpha(1 + (gh.alpha - 1) * a.v, c.copy(white).lerp(mint, a.v)), onComplete: res }))
    // s6: the seams live inside the tiles (the paper's own), the tiles always touch
    return gh.plates !== undefined ? fade : g.seams(from, on ? gh.gap : LANDED_SEAM, duration)
  }
  const gh0 = () => sv.ghost?.gap ?? 0
  const waking = useRef(false)
  /** the next project: s5 wakes the liquid first (tiles back, seams reopened), turns and welds, then fades it out again */
  const nextProject = async () => {
    const g = grid.current
    if (!g || waking.current || g.busy()) return
    if (!sv.ghost?.wake) return g.next()
    waking.current = true
    // the light text would sit on the pale liquid: it goes with the ground and comes back with it
    const f = { v: 1 }, d = reduced ? 0.01 : WAKE
    const text = (to: number) => { if (!sv.ghost?.textStays) gsap.to(f, { v: to, duration: d, ease: 'power2.inOut', onUpdate: () => g.setFade(f.v) }) }
    text(0)
    await ghost(false, d)
    await g.next()
    text(1)
    await ghost(true, d, null) // the weld left the seams shut: fade from there, no reopening
    waking.current = false
  }
  /** 'frozen': the liquid is stopped where it is (freeze) and its highlights pressed down to the dark shades */
  const settleFrozen = (to: 0 | 1, duration: number) => new Promise<void>((res) => {
    const h = fly.current
    if (!h) return res()
    const k = { v: 1 - to }
    gsap.to(k, { v: to, duration, ease: 'power1.inOut', onUpdate: () => h.settle(k.v, 'frozen'), onComplete: res })
  })
  /** 'solid': the liquid mixes to the solid dark mint while its clock runs `SWEEP` s ahead (the highlight passes once) */
  const settleSolid = (to: 0 | 1, duration: number) => new Promise<void>((res) => {
    const h = fly.current
    if (!h) return res()
    const k = { v: 1 - to }
    gsap.to(k, { v: to, duration, ease: 'power1.inOut', onUpdate: () => { h.settle(k.v, 'solid'); h.sweep(k.v * SWEEP) }, onComplete: res })
  })
  /** s2: the landed square face ↔ the viewport: the paper window and the page layer's tiles move together; over the second half
   *  (k > .5) the text fades and the liquid settles (cubies closing up, seams fading, the still gradient); `onHalf` fires as k crosses .5 */
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
      if (sv.settle === 'gradient') h.settle(f, 'gradient')
      if (overlay.current) overlay.current.style.opacity = String(f)
      if (onHalf && !halved && (to === 1 ? k.v >= 0.5 : k.v <= 0.5)) { halved = true; onHalf() }
    }
    apply()
    gsap.to(k, { v: to, duration, ease: 'power2.inOut', onUpdate: apply, onComplete: res })
  })
  const home = async () => {
    const t = tl.current
    if (!t || phase.current !== 'in') return
    phase.current = 'out'
    setFlying(true)
    if (sv.join === 'stretch') {
      // s3 first: the seams open again and the liquid wakes; then the text fades and the face starts squaring back; halfway the
      // shader cube draws itself again and the flight reverses, zooming out while the face finishes squaring
      const back: Promise<unknown>[] = []
      if (sv.weldIn) back.push(grid.current?.openGaps(reduced ? 0.01 : 0.4) ?? Promise.resolve())
      if (sv.settle === 'solid') back.push(settleSolid(0, reduced ? 0.01 : 0.6))
      if (sv.settle === 'frozen') back.push(settleFrozen(0, reduced ? 0.01 : 0.5).then(() => fly.current?.freeze(false)))
      if (sv.ghost) back.push(ghost(false, reduced ? 0.01 : 0.5))
      await Promise.all(back)
      await spread(0, reduced ? 0.01 : STRETCH, () => { grid.current?.setLive(false); fly.current?.capture(false); t.reverse() })
      return
    }
    t.reverse()
  }
  const goRef = useRef({ go, home, next: nextProject })
  goRef.current = { go, home, next: nextProject }
  useEffect(() => { window.__aarNav = { go: (i) => goRef.current.go(i), home: () => goRef.current.home(), next: () => goRef.current.next(), busy: () => phase.current === 'out' || waking.current || (grid.current?.busy() ?? false), section: () => section, rotY: () => fly.current?.root.rotation.y ?? 0, dbg: () => grid.current?.dbg(), alpha: (a: number, tint?: string) => grid.current?.setAlpha(a, tint), setVersion: (n: string) => { const v = SITE_TRANSITION_OF(n); if (v) setSv(v) }, version: () => sv.name } }, [section, sv])
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
      if (section !== null && !flying && (e.key === 'n' || e.key === 'ArrowRight')) nextProject()
      return
    }
    if (e.key === 'Escape') setOpen(null)
    if (e.key === 'Enter') go(active)
    if (e.key === 't') setSv((v) => SITE_TRANSITIONS[(SITE_TRANSITIONS.findIndex((x) => x.name === v.name) + 1) % SITE_TRANSITIONS.length])
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
        <PaperCube version={PV} params={params} spin={!reduced && !still} spinSpeed={0.12} auto={!reduced && !away} autoInterval={3600} combo={0.35} rubik={rubik} fly={fly} />
        {/* s2's page: the screen cube drawn in this same canvas, its tiles sampling the shader cube's captured image */}
        {sv.join === 'stretch' && section !== null && fly.current && <ScreenCube key={section} ref={grid} v={sv.ghost?.bare ? PAGE_BARE : PAGE} scheme={scheme} recoil={false} weld={!sv.ghost?.bare} projects={projects} blank={false} look={sv.page} heroDraw={false} liquid={fly.current.shot} live={false} inset={sv.ghost?.plates ?? (sv.weldIn || sv.ghost ? LANDED_INSET : 0)} round={sv.ghost?.round ?? 0} plate={sv.ghost?.plates !== undefined ? (LANDED_SEAM / 2 - sv.ghost.plates) / (1 - 2 * sv.ghost.plates) : 0} edge={sv.ghost?.noEdge ? 1 / (1 - LANDED_SEAM / 3) : 1} />}
      </Canvas>
      {/* the section page: the screen as a cube, faded in over the landing; the wordmark (or escape) flies home */}
      {section !== null && (
        <div className={`section-page ${sv.join === 'stretch' ? 'bare' : ''}`} ref={overlay}>
          {sv.join === 'fade' && <CubeScreen key={section} ref={grid} v={PAGE} scheme={scheme} recoil={false} look={sv.page} heroDraw={sv.page === 'site'} projects={projects} />}
          {sv.grain && <div className="grain" />}
          <button className="wordmark home" onClick={home} aria-label="home">aarcube</button>
          <div className="page-hint"><span>{SECTIONS[section].title.toLowerCase()} · {sv.name}</span><button onClick={nextProject}>next (n)</button><button onClick={home}>home (esc)</button></div>
        </div>
      )}
      {xray?.placement === 'bottom' && <BottomBed v={xray} seed={floralSeed} scheme={scheme} />}
      <div className="aura" />
      <div className="grain" />
      <div className={`ui site layout-${layout} ${open ? 'has-panel' : ''} ${hidden ? 'away' : ''}`}>
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
          {xray?.placement === 'bottom' ? null : xray ? (xray.kind === 'mesh' ? <XrayFlower3D v={xray} flower={flower} seed={floralSeed} height={xray.scene?.place ? 'css' : undefined} className={`floral xray ${xray.scene?.place ? 'group' : ''}`} scheme={scheme} /> : <XrayFloral v={xray} seed={floralSeed} className="floral xray" scheme={scheme} />) : <Floral className="floral" seed={11 + 7 * Math.max(0, SCHEMES.findIndex((x) => x.name === scheme))} />}
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
    __aarNav: { go: (i: number) => void; home: () => void; next: () => Promise<void>; busy: () => boolean; section: () => number | null; rotY: () => number; dbg: () => unknown; alpha: (a: number, tint?: string) => void; setVersion: (n: string) => void; version: () => string }
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
