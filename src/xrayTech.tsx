/**
 * The technical layer of the x-ray floral: callouts on leaders, x / y readouts, frames with corner marks, dashed
 * arcs, base ruler, measure lines, swatches, specks. Laid out from anchor points in the 640x140 viewBox, so the
 * SVG plant and the mesh plant share it.
 */
import type { Pt } from './Floral'
import type { FloralVersion } from './floralVersions'

export const XF_W = 640
export const XF_H = 140
export const r1 = (n: number) => Math.round(n * 10) / 10
const NAMES = ['.stem', 'petal.03', 'xray.effect', 'not.found', 'sepal', 'bud.png', 'leaf.02', 'flowers.jpeg', '.xray', 'node.07', 'stamen', 'sample.01']

export type Anchor = { name: string; p: Pt }
export type Box = { x: number; y: number; w: number; h: number }
export type TechInput = {
  anchors: Anchor[]
  /** bloom centre and radius (viewBox units) for the callout columns */
  cx: number
  cy: number
  R: number
  tilt: number
  /** points that bound the bloom, and each other part (bud, leaves) */
  bloomPts: Pt[]
  parts: Pt[][]
}
export const box = (pts: Pt[], pad: number): Box => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 }
}

export function layoutTech(v: FloralVersion, rng: () => number, t: TechInput) {
  const { anchors, cx, cy, R, tilt } = t
  // callouts: two columns either side of the plant, boxes in fixed slots (the nearest free one to the anchor),
  // short leaders with one elbow; the top slot is left free when the swatch row is on
  const picks = anchors.filter((_, i) => i !== 0).sort(() => rng() - 0.5).slice(0, 5)
  const slotY = Array.from({ length: 6 }, (_, i) => 10 + i * 21).filter((y) => !v.swatches || y > 18)
  const used: Record<string, Set<number>> = { l: new Set(), r: new Set() }
  const bh = 11
  const labels = picks.map((a, i) => {
    const left = a.p[0] < cx + 20 ? i % 3 !== 2 : i % 3 === 2
    const col = left ? 'l' : 'r'
    const free = slotY.filter((y) => !used[col].has(y))
    const y = (free.length ? free : slotY).reduce((best, y) => (Math.abs(y - a.p[1]) < Math.abs(best - a.p[1]) ? y : best), free[0] ?? slotY[0])
    used[col].add(y)
    const text = i < 2 ? a.name : NAMES[Math.floor(rng() * NAMES.length)]
    const bw = text.length * 3.9 + 9
    const x = left ? cx - R - 118 - (i % 2) * 14 : cx + R + 96 + (i % 2) * 14
    const ex = left ? x + bw : x
    const elbow: Pt = [a.p[0] + (left ? -14 : 14), y + bh / 2]
    return { text, x, y, bw, bh, leader: `M ${r1(ex)} ${r1(y + bh / 2)} L ${r1(elbow[0])} ${r1(elbow[1])} L ${r1(a.p[0])} ${r1(a.p[1])}`, anchor: a.p, blink: rng() < 0.4 }
  })
  const coords = anchors.filter((_, i) => i % 2 === 1).slice(0, 4)
  const bloomBox = box(t.bloomPts, 5)
  const partBoxes = [bloomBox, ...t.parts.map((p) => box(p, 3))]
  const arcs = [0, 1, 2].map((i) => {
    const a = anchors[(i * 3) % anchors.length].p, b = anchors[(i * 3 + 4) % anchors.length].p
    const m: Pt = [(a[0] + b[0]) / 2 + (rng() - 0.5) * 60, (a[1] + b[1]) / 2 - 20 - rng() * 20]
    return `M ${r1(a[0])} ${r1(a[1])} Q ${r1(m[0])} ${r1(m[1])} ${r1(b[0])} ${r1(b[1])}`
  })
  const specks: { c: Pt; r: number; o: number }[] = []
  for (let i = 0; i < v.specks; i++) specks.push({ c: [rng() * XF_W, rng() * XF_H], r: 0.25 + rng() * 0.7, o: 0.15 + rng() * 0.55 })
  return { cx, cy, R, tilt, labels, coords, bloomBox, partBoxes, arcs, specks, measureX: cx + R + 28, swatchX: cx - R - 118 }
}
export type Tech = ReturnType<typeof layoutTech>

export const cssVar = (name: string) => (typeof window === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim())

const cornerMarks = (b: Box, s = 4) =>
  [
    `M ${r1(b.x)} ${r1(b.y + s)} V ${r1(b.y)} H ${r1(b.x + s)}`,
    `M ${r1(b.x + b.w - s)} ${r1(b.y)} H ${r1(b.x + b.w)} V ${r1(b.y + s)}`,
    `M ${r1(b.x + b.w)} ${r1(b.y + b.h - s)} V ${r1(b.y + b.h)} H ${r1(b.x + b.w - s)}`,
    `M ${r1(b.x + s)} ${r1(b.y + b.h)} H ${r1(b.x)} V ${r1(b.y + b.h - s)}`,
  ].join(' ')

/** the layer as an SVG group; `tick` drives the live readouts */
export function TechLayer({ v, g, tick, swatches }: { v: FloralVersion; g: Tech; tick: number; swatches: string[] }) {
  const live = v.coords === 'live'
  const jitter = (i: number, k: number) => (live ? Math.round(Math.sin(tick * 1.7 + i * 3.1 + k) * 3) : 0)
  return (
    <g style={{ fontFamily: 'var(--mono)', stroke: 'var(--mute)' }} strokeWidth={0.5}>
      {v.specks > 0 && g.specks.map((s, i) => <circle key={i} cx={r1(s.c[0])} cy={r1(s.c[1])} r={s.r} style={{ fill: 'var(--bright)' }} stroke="none" opacity={s.o} />)}
      {v.ruler && (
        <g opacity={0.7}>
          <path d={`M ${r1(XF_W * 0.18)} ${XF_H - 3} H ${r1(XF_W * 0.82)}`} />
          {Array.from({ length: 21 }, (_, i) => XF_W * 0.18 + (i * (XF_W * 0.64)) / 20).map((x, i) => (
            <g key={i}>
              <path d={`M ${r1(x)} ${XF_H - 3} V ${XF_H - (i % 5 === 0 ? 8 : 5.5)}`} />
              {i % 5 === 0 && <text x={r1(x + 2)} y={XF_H - 9} fontSize={4.8} style={{ fill: 'var(--mute)' }} stroke="none">{Math.round(x * 2.4)}</text>}
            </g>
          ))}
        </g>
      )}
      {v.measures && (
        <g opacity={0.75}>
          <path d={`M ${r1(g.measureX)} ${r1(g.cy - g.R * g.tilt - 4)} V ${XF_H - 10}`} />
          {Array.from({ length: 12 }, (_, i) => g.cy - g.R * g.tilt - 4 + i * 8).map((y, i) => (
            <g key={i}>
              <path d={`M ${r1(g.measureX)} ${r1(y)} H ${r1(g.measureX + (i % 3 === 0 ? 5 : 2.5))}`} />
              {i % 3 === 0 && <text x={r1(g.measureX + 7)} y={r1(y + 1.6)} fontSize={4.2} style={{ fill: 'var(--mute)' }} stroke="none">{(y * 3.7).toFixed(1)}</text>}
            </g>
          ))}
          <path d={`M ${r1(g.cx - g.R - 6)} ${r1(g.cy + g.R * g.tilt + 8)} H ${r1(g.cx + g.R + 6)}`} strokeDasharray="1 2" />
        </g>
      )}
      {v.frame !== 'off' && (v.frame === 'bloom' ? [g.bloomBox] : g.partBoxes).map((b, i) => (
        <g key={i} opacity={0.85}>
          <rect x={r1(b.x)} y={r1(b.y)} width={r1(b.w)} height={r1(b.h)} strokeWidth={0.35} strokeOpacity={0.7} />
          <path d={cornerMarks(b, Math.min(5, b.w / 4))} style={{ stroke: 'var(--bright)' }} strokeWidth={0.8} />
          {i === 0 && <text x={r1(b.x)} y={r1(b.y + b.h + 7)} fontSize={5.4} style={{ fill: 'var(--text)' }} stroke="none">object.flower</text>}
        </g>
      ))}
      {v.arcs && g.arcs.map((d, i) => <path key={i} d={d} className="xf-dash" strokeDasharray="2 3" strokeWidth={0.45} opacity={0.7} />)}
      {v.labels && g.labels.map((l, i) => (
        <g key={i} className={l.blink ? 'xf-blink' : undefined} style={l.blink ? { animationDelay: `${i * 1.3}s` } : undefined}>
          <rect x={r1(l.x)} y={r1(l.y)} width={r1(l.bw)} height={l.bh} strokeWidth={0.45} style={{ fill: 'var(--bg)' }} fillOpacity={0.6} />
          <text x={r1(l.x + 4)} y={r1(l.y + 7.6)} fontSize={6} style={{ fill: 'var(--text)' }} stroke="none">{l.text}</text>
          <path d={l.leader} strokeWidth={0.45} opacity={0.8} />
          <circle cx={r1(l.anchor[0])} cy={r1(l.anchor[1])} r={1.3} style={{ stroke: 'var(--bright)' }} strokeWidth={0.6} />
        </g>
      ))}
      {v.coords !== 'off' && g.coords.map((a, i) => (
        <text key={i} x={r1(a.p[0] + 5)} y={r1(a.p[1] - 3)} fontSize={5.2} style={{ fill: 'var(--text)' }} stroke="none" opacity={0.85}>
          {`x: ${Math.round(a.p[0] * 2.4) + jitter(i, 0)}  y: ${Math.round(a.p[1] * 2.4) + jitter(i, 1)}`}
        </text>
      ))}
      {v.swatches && (
        <g>
          {swatches.map((c, i) => (
            <g key={i} transform={`translate(${g.swatchX + i * 64} 6)`}>
              <rect width={6} height={6} style={{ fill: c }} stroke="none" />
              <text x={9} y={5.4} fontSize={5.4} style={{ fill: 'var(--mute)' }} stroke="none">{c}</text>
            </g>
          ))}
        </g>
      )}
    </g>
  )
}

/** a hook-free helper: the live tick + swatches the layer wants */
export const readSwatches = (v: FloralVersion) => (v.swatches ? ['--a', '--b', '--bright', '--mute', '--line'].map((n) => cssVar(n) || n) : [])
