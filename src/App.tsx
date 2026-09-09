import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { SCHEMES } from './schemes'
import { Paper } from './Paper'
import { PaperCube, type PaperDebug } from './PaperCube'
import { Site } from './Site'
import type { RubikHandle } from './RubikMask'
import { PAPER_VERSIONS, VERSION_OF, withTheme, type PaperVersion } from './paperVersions'
import { PRESETS_OF, presetNamed } from './paperPresets'

type Tab = 'site' | 'shader' | 'paper'
const TABS: Tab[] = ['site', 'shader', 'paper']
const LABEL: Record<Tab, string> = { site: 'site', shader: 'shader cube', paper: 'paper shaders' }
const SHADER_NAME = { heat: 'heatmap', liquid: 'liquid metal', smoke: 'gem smoke' }
const GAINS = [0.7, 0.85, 1, 1.2, 1.4]
const OUTLINES = ['off', 'line', 'glow', 'ascii'] as const
/** ascii outline reach presets: base reach and the extra reach to the left (glyphs trail right) */
const WINDS: Record<string, { reach: number; bias: number; scatter: number }> = { tight: { reach: 0.03, bias: 1, scatter: 0.3 }, breeze: { reach: 0.05, bias: 3, scatter: 0.5 }, gale: { reach: 0.07, bias: 6, scatter: 0.6 }, storm: { reach: 0.09, bias: 10, scatter: 0.7 } }
const ALPHAS = [0.5, 0.7, 0.85, 1]
const CELLS = [7, 9, 12, 16]

export default function App() {
  // ?tab=&c=&v= let a specific state be linked for review
  const q = new URLSearchParams(window.location.search)
  const [tab, setTab] = useState<Tab>((TABS as string[]).includes(q.get('tab') ?? '') ? (q.get('tab') as Tab) : 'site')
  const [si, setSi] = useState(Math.max(0, SCHEMES.findIndex((x) => x.name === q.get('c'))))
  const [version, setVersionRaw] = useState('v1')
  const [presetIx, setPresetIx] = useState(0)
  const [spin, setSpin] = useState(true)
  const [auto, setAuto] = useState(false)
  const [debug, setDebug] = useState<PaperDebug>('off')
  const [gain, setGain] = useState(1)
  const [alpha, setAlpha] = useState(1)
  const [outline, setOutline] = useState<(typeof OUTLINES)[number] | undefined>(undefined)
  const [wind, setWind] = useState('version')
  const [cell, setCell] = useState<number | undefined>(undefined)
  // review hook: merge arbitrary params over the theme (scripts iterate looks without editing presets)
  const [override, setOverride] = useState<Record<string, unknown>>({})
  const [vOverride, setVOverride] = useState<Partial<PaperVersion>>({})
  const rubik = useRef<RubikHandle | null>(null)
  const s = SCHEMES[si]
  const base = VERSION_OF(version) ?? PAPER_VERSIONS[0]
  // the preset row is either the version's themes or its shader's presets
  const choices = base.themes ? base.themes.map((t) => t.name) : PRESETS_OF[base.shader].map((p) => p.name.toLowerCase())
  const choice = choices[Math.min(presetIx, choices.length - 1)]
  const theme = base.themes?.find((t) => t.name === choice)
  const PV = { ...withTheme(base, theme), ...vOverride }
  // every lab cube sits on the scheme's background, like the site
  // themed versions share one scale per shader so every theme sits at the same size on screen
  const params = { ...presetNamed(PV.shader, theme ? theme.preset : choice).params, colorBack: s.bg, ...(theme ? { scale: PV.shader === 'heat' ? 0.75 : 0.6 } : {}), ...override }

  // switching version also selects its default preset
  const setVersion = (v: string) => {
    const pv = VERSION_OF(v)
    if (!pv) return
    setVersionRaw(v)
    setOutline(undefined)
    setWind('version')
    setCell(undefined)
    setPresetIx(pv.themes ? Math.max(0, pv.themes.findIndex((t) => t.preset === pv.preset)) : Math.max(0, PRESETS_OF[pv.shader].findIndex((p) => p.name.toLowerCase() === pv.preset)))
  }

  // scheme -> CSS variables
  useEffect(() => {
    const r = document.documentElement.style
    for (const [k, v] of Object.entries(s)) if (k !== 'name') r.setProperty(`--${k}`, v)
    document.documentElement.dataset.scheme = s.name
  }, [s])

  // keys + the hook the Playwright scripts drive
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p') setTab((t) => TABS[(TABS.indexOf(t) + 1) % TABS.length])
      if (e.key === 'c') setSi((i) => (i + 1) % SCHEMES.length)
    }
    window.addEventListener('keydown', onKey)
    window.__aar = {
      setTab,
      setScheme: (n: string) => setSi(Math.max(0, SCHEMES.findIndex((x) => x.name === n))),
      setShaderVersion: setVersion,
      setShaderPreset: setPresetIx,
      setShaderAuto: setAuto,
      setShaderSpin: setSpin,
      setShaderDebug: setDebug,
      setShaderLook: (g: number, a: number) => { setGain(g); setAlpha(a) },
      setShaderOverride: setOverride,
      setShaderOutline: setOutline,
      setShaderWind: setWind,
      setShaderCell: setCell,
      setShaderVersionOverride: setVOverride,
      paperTurn: (...args: Parameters<RubikHandle['turn']>) => rubik.current?.turn(...args) ?? Promise.resolve(),
      paperPositions: () => rubik.current?.positions() ?? [],
      paperOrientationError: () => rubik.current?.orientationError() ?? 0,
      paperPlacementError: () => rubik.current?.placementError() ?? 0,
      paperDump: () => rubik.current?.dump() ?? [],
      paperBusy: () => rubik.current?.busy() ?? false,
    }
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const tabs = (
    <div className="tabs">
      {TABS.map((t) => (
        <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
          {LABEL[t]}
        </button>
      ))}
    </div>
  )

  if (tab === 'site')
    return (
      <>
        <Site scheme={s.name} bg={s.bg} version={q.get('v') ?? undefined} />
        <div className="site-tabs">{tabs}</div>
      </>
    )

  if (tab === 'paper')
    return (
      <div className="ui paper-ui">
        <div className="wordmark">aarcube</div>
        {tabs}
        <Paper />
      </div>
    )

  return (
    <>
      <Canvas key={version + (theme?.name ?? '')} dpr={[1, 1.5]} camera={{ position: [0, 0, PV.camZ], fov: 30 }} gl={{ antialias: true }}>
        <PaperCube version={PV} params={params} spin={spin} auto={auto} debug={debug} gain={gain} alpha={alpha} outline={outline} outlineColor={s.accent} ascii={{ ...WINDS[wind], ...(cell ? { cell } : {}) }} rubik={rubik} />
      </Canvas>
      <div className="ui">
        <div className="wordmark">aarcube</div>
        {tabs}
        <div className="controls">
          <Row label="version" items={PAPER_VERSIONS.map((v) => v.name)} on={version} pick={setVersion} />
          <Row label={base.themes ? 'theme' : 'preset'} items={choices} on={choice} pick={(n) => setPresetIx(choices.indexOf(n))} />
          <Row label="brightness" items={GAINS.map(String)} on={String(gain)} pick={(n) => setGain(Number(n))} />
          <Row label="opacity" items={ALPHAS.map(String)} on={String(alpha)} pick={(n) => setAlpha(Number(n))} />
          <Row label="outline" items={[...OUTLINES]} on={outline ?? PV.outline ?? 'off'} pick={setOutline} />
          {(outline ?? PV.outline) === 'ascii' && <Row label="wind" items={['version', ...Object.keys(WINDS)]} on={wind} pick={setWind} />}
          {(outline ?? PV.outline) === 'ascii' && <Row label="cell" items={CELLS.map(String)} on={String(cell ?? PV.ascii?.cell ?? 9)} pick={(n) => setCell(Number(n))} />}
          <div className="row">
            <span className="k">motion</span>
            <button className={spin ? 'on' : ''} onClick={() => setSpin((v) => !v)}>
              {spin ? 'spinning' : 'still'}
            </button>
            <button className={auto ? 'on' : ''} onClick={() => setAuto((v) => !v)}>
              turning
            </button>
            <button onClick={() => rubik.current?.turn()}>turn</button>
          </div>
        </div>
        <div className="readout">
          <span>{SHADER_NAME[PV.shader]} on the Rubik's cube</span>
          <span className="note">{PV.note}</span>
          <span>drag to orbit</span>
          <span>keys p c</span>
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
      setScheme: (n: string) => void
      setShaderVersion: (v: string) => void
      setShaderPreset: (i: number) => void
      setShaderAuto: (b: boolean) => void
      setShaderSpin: (b: boolean) => void
      setShaderDebug: (v: PaperDebug) => void
      setShaderLook: (gain: number, alpha: number) => void
      setShaderOverride: (o: Record<string, unknown>) => void
      setShaderOutline: (o: 'off' | 'line' | 'glow' | 'ascii') => void
      setShaderWind: (w: string) => void
      setShaderCell: (c: number) => void
      setShaderVersionOverride: (o: Partial<PaperVersion>) => void
      paperTurn: RubikHandle['turn']
      paperPositions: () => number[][]
      paperOrientationError: () => number
      paperPlacementError: () => number
      paperDump: () => { pos: number[]; mesh: number[]; parentOk: boolean }[]
      paperBusy: () => boolean
    }
  }
}
