/**
 * X-ray technical floral for the site's base: a bloom of translucent petals that brighten where they overlap
 * (screen blend), veins, a glowing stem, leaves and a bud, under a technical layer of callouts, frames,
 * coordinates, arcs, rulers and swatches. Geometry from a seed; the look from a FloralVersion. Colours come from
 * the scheme's CSS variables so it follows the site.
 */
import { useEffect, useMemo, useState } from 'react'
import { bezierAt, leaf, mulberry32, type LeafArt, type Pt } from './Floral'
import type { FloralVersion } from './floralVersions'

export const XF_W = 640
export const XF_H = 140

const r1 = (n: number) => Math.round(n * 10) / 10
const NAMES = ['.stem', 'petal.03', 'xray.effect', 'not.found', 'sepal', 'bud.png', 'leaf.02', 'flowers.jpeg', '.xray', 'node.07', 'stamen', 'sample.01']

type Anchor = { name: string; p: Pt }
type Petal = { d: string; veins: string[]; rot: number; tip: Pt; ring: 0 | 1 }

/** a petal along +x: length L, half width W, soft rounded tip */
const petalPath = (L: number, W: number) =>
  `M 0 0 C ${r1(L * 0.2)} ${r1(-W * 0.9)} ${r1(L * 0.72)} ${r1(-W)} ${r1(L)} ${r1(-W * 0.12)} C ${r1(L * 1.03)} 0 ${r1(L * 1.03)} 0 ${r1(L)} ${r1(W * 0.12)} C ${r1(L * 0.72)} ${r1(W)} ${r1(L * 0.2)} ${r1(W * 0.9)} 0 0 Z`
const petalVeins = (L: number, W: number) => [
  `M 1 0 L ${r1(L * 0.9)} 0`,
  `M 1 0 Q ${r1(L * 0.5)} ${r1(-W * 0.5)} ${r1(L * 0.84)} ${r1(-W * 0.3)}`,
  `M 1 0 Q ${r1(L * 0.5)} ${r1(W * 0.5)} ${r1(L * 0.84)} ${r1(W * 0.3)}`,
  `M ${r1(L * 0.3)} 0 Q ${r1(L * 0.6)} ${r1(-W * 0.2)} ${r1(L * 0.8)} ${r1(-W * 0.55)}`,
  `M ${r1(L * 0.3)} 0 Q ${r1(L * 0.6)} ${r1(W * 0.2)} ${r1(L * 0.8)} ${r1(W * 0.55)}`,
]

function build(v: FloralVersion, seed: number) {
  const rng = mulberry32(seed * 7919 + 13)
  const W = XF_W, H = XF_H
  const cx = 262 + (rng() - 0.5) * 24, cy = 56 + (rng() - 0.5) * 6
  const R = 50
  const tilt = v.tilt
  const petals: Petal[] = []
  const rings: [number, number, number, 0 | 1][] = [[v.petals, R, R * 0.36, 0]]
  if (v.innerRing) rings.push([Math.max(5, Math.round(v.petals * 0.6)), R * 0.58, R * 0.24, 1])
  for (const [n, L, Wd, ring] of rings) {
    const off = rng() * Math.PI * 2
    for (let i = 0; i < n; i++) {
      const rot = off + (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.18
      const l = L * (0.88 + rng() * 0.2), w = Wd * (0.85 + rng() * 0.3)
      const tip: Pt = [cx + Math.cos(rot) * l, cy + Math.sin(rot) * l * tilt]
      petals.push({ d: petalPath(l, w), veins: petalVeins(l, w), rot: (rot * 180) / Math.PI, tip, ring })
    }
  }
  // stamens
  const stamens: { c: Pt; r: number }[] = []
  for (let i = 0; i < 18; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * R * 0.2
    stamens.push({ c: [cx + Math.cos(a) * d, cy + Math.sin(a) * d * tilt], r: 0.9 + rng() * 1.5 })
  }
  // stem: from under the bloom to the base, leaning right
  const p0: Pt = [cx + 3, cy + R * 0.22 * tilt]
  const p3: Pt = [cx + 70 + rng() * 30, H - 3]
  const p1: Pt = [p0[0] - 6, p0[1] + 34]
  const p2: Pt = [p3[0] - 22, p3[1] - 40]
  const stemD = `M ${r1(p0[0])} ${r1(p0[1])} C ${r1(p1[0])} ${r1(p1[1])} ${r1(p2[0])} ${r1(p2[1])} ${r1(p3[0])} ${r1(p3[1])}`
  const at = (t: number) => bezierAt(p0, p1, p2, p3, t)
  const leaves: LeafArt[] = []
  for (const [t, side] of [[0.5, -1], [0.7, 1], [0.86, -1]] as [number, 1 | -1][]) {
    const p = at(t), q = at(t + 0.02)
    const ang = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI
    leaves.push(leaf(rng, p, ang + side * (58 + rng() * 14) - 180 * (side < 0 ? 0 : 0), 24 + rng() * 14, 5 + rng() * 3, false))
  }
  // bud on a side branch
  const bp = at(0.38)
  const bud: Pt = [bp[0] + 74 + rng() * 20, bp[1] - 30 - rng() * 10]
  const branchD = `M ${r1(bp[0])} ${r1(bp[1])} Q ${r1(bp[0] + 30)} ${r1(bp[1] - 2)} ${r1(bud[0])} ${r1(bud[1])}`
  // anchors for the technical layer
  const anchors: Anchor[] = [
    { name: 'object.flower', p: [cx, cy] },
    { name: '.stem', p: at(0.62) },
    { name: 'bud.png', p: bud },
    ...leaves.map((l, i) => ({ name: `leaf.0${i + 1}`, p: l.node })),
    ...petals.filter((p) => p.ring === 0).filter((_, i) => i % 3 === 0).slice(0, 4).map((p, i) => ({ name: `petal.0${i + 1}`, p: p.tip })),
  ]
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
  const box = (pts: Pt[], pad: number) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
    return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 }
  }
  const bloomBox = box(petals.map((p) => p.tip), 5)
  const partBoxes = [bloomBox, box([bud, [bud[0] - 6, bud[1] - 4], [bud[0] + 6, bud[1] + 4]], 4), ...leaves.map((l) => box(pathPts(l.outline), 2))]
  const arcs = [0, 1, 2].map((i) => {
    const a = anchors[(i * 3) % anchors.length].p, b = anchors[(i * 3 + 4) % anchors.length].p
    const m: Pt = [(a[0] + b[0]) / 2 + (rng() - 0.5) * 60, (a[1] + b[1]) / 2 - 20 - rng() * 20]
    return `M ${r1(a[0])} ${r1(a[1])} Q ${r1(m[0])} ${r1(m[1])} ${r1(b[0])} ${r1(b[1])}`
  })
  const specks: { c: Pt; r: number; o: number }[] = []
  for (let i = 0; i < v.specks; i++) specks.push({ c: [rng() * W, rng() * H], r: 0.25 + rng() * 0.7, o: 0.15 + rng() * 0.55 })
  const measureX = cx + R + 28
  return { cx, cy, R, tilt, petals, stamens, stemD, leaves, bud, branchD, anchors, labels, coords, bloomBox, partBoxes, arcs, specks, measureX, stemBase: p3 }
}
/** sample points of a path's numbers (enough for a bounding box) */
function pathPts(d: string): Pt[] {
  const n = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  const out: Pt[] = []
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]])
  return out
}

const cssVar = (name: string) => (typeof window === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim())

export function XrayFloral({ v, seed = 3, width = XF_W, height = XF_H, className, scheme }: { v: FloralVersion; seed?: number; width?: number; height?: number; className?: string; scheme?: string }) {
  const g = useMemo(() => build(v, seed), [v, seed])
  const id = useMemo(() => `xf${Math.floor(Math.random() * 1e6)}`, [])
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const live = v.coords === 'live' && !reduced
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => setTick((n) => n + 1), 700)
    return () => clearInterval(t)
  }, [live])
  const swatches = useMemo(() => (v.swatches ? ['--a', '--b', '--bright', '--mute', '--line'].map((n) => cssVar(n) || n) : []), [v.swatches, scheme])
  const jitter = (i: number, k: number) => (live ? Math.round(Math.sin(tick * 1.7 + i * 3.1 + k) * 3) : 0)
  const silhouette = v.silhouette
  const cxLeft = g.cx - g.R - 118
  const mono = 'var(--mono)'
  const cornerMarks = (b: { x: number; y: number; w: number; h: number }, s = 4) =>
    [
      `M ${r1(b.x)} ${r1(b.y + s)} V ${r1(b.y)} H ${r1(b.x + s)}`,
      `M ${r1(b.x + b.w - s)} ${r1(b.y)} H ${r1(b.x + b.w)} V ${r1(b.y + s)}`,
      `M ${r1(b.x + b.w)} ${r1(b.y + b.h - s)} V ${r1(b.y + b.h)} H ${r1(b.x + b.w - s)}`,
      `M ${r1(b.x + s)} ${r1(b.y + b.h)} H ${r1(b.x)} V ${r1(b.y + b.h - s)}`,
    ].join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${XF_W} ${XF_H}`} preserveAspectRatio="xMidYMax meet" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <radialGradient id={`${id}-p`} gradientUnits="userSpaceOnUse" cx={g.cx} cy={g.cy} r={g.R * 1.05}>
          {v.tint === 'spectral' ? (
            <>
              <stop offset="0" style={{ stopColor: 'var(--a)', stopOpacity: 0.2 }} />
              <stop offset="0.5" style={{ stopColor: 'var(--b)', stopOpacity: 0.7 }} />
              <stop offset="0.8" style={{ stopColor: 'var(--a)', stopOpacity: 0.9 }} />
              <stop offset="1" style={{ stopColor: 'var(--bright)', stopOpacity: 0.9 }} />
            </>
          ) : (
            <>
              <stop offset="0" style={{ stopColor: 'var(--a)', stopOpacity: 0.12 }} />
              <stop offset="0.55" style={{ stopColor: 'var(--a)', stopOpacity: 0.5 }} />
              <stop offset="1" style={{ stopColor: 'var(--bright)', stopOpacity: 1 }} />
            </>
          )}
        </radialGradient>
        <filter id={`${id}-glow`} x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
      </defs>
      {/* glow under everything */}
      {v.glow > 0 && (
        <g filter={`url(#${id}-glow)`} opacity={v.glow}>
          <g transform={`translate(${r1(g.cx)} ${r1(g.cy)}) scale(1 ${g.tilt})`}>
            {g.petals.map((p, i) => (
              <path key={i} d={p.d} transform={`rotate(${r1(p.rot)})`} style={{ fill: 'var(--a)' }} fillOpacity={0.35} />
            ))}
          </g>
          <path d={g.stemD} style={{ stroke: 'var(--b)' }} strokeWidth={4} opacity={0.55} />
          <path d={g.branchD} style={{ stroke: 'var(--b)' }} strokeWidth={2.5} opacity={0.4} />
        </g>
      )}
      {/* stem, branch, leaves, bud */}
      <g>
        <path d={g.stemD} style={{ stroke: silhouette ? 'var(--bright)' : 'var(--b)' }} strokeWidth={silhouette ? 2.2 : 1.1} opacity={0.92} />
        {!silhouette && <path d={g.stemD} style={{ stroke: 'var(--bright)' }} strokeWidth={0.35} opacity={0.5} />}
        <path d={g.branchD} style={{ stroke: silhouette ? 'var(--bright)' : 'var(--b)' }} strokeWidth={silhouette ? 1.6 : 0.8} opacity={0.85} />
        {g.leaves.map((l, i) => (
          <g key={i}>
            <path d={l.outline} style={{ fill: silhouette ? 'var(--bright)' : 'var(--b)', stroke: silhouette ? 'none' : 'var(--b)', mixBlendMode: silhouette ? 'normal' : 'screen' }} fillOpacity={silhouette ? 0.92 : 0.14} strokeWidth={0.7} opacity={0.9} />
            {!silhouette && (
              <g style={{ stroke: 'var(--b)' }}>
                <path d={l.midrib} strokeWidth={0.45} opacity={0.6} />
                {l.veinsNear.map((d, j) => <path key={j} d={d} strokeWidth={0.4} opacity={0.5} />)}
                {l.veinsFar.map((d, j) => <path key={j} d={d} strokeWidth={0.35} opacity={0.25} />)}
              </g>
            )}
          </g>
        ))}
        <g transform={`translate(${r1(g.bud[0])} ${r1(g.bud[1])}) rotate(-28)`}>
          <ellipse rx={7} ry={4} style={{ fill: silhouette ? 'var(--bright)' : 'var(--a)', stroke: 'var(--bright)', mixBlendMode: silhouette ? 'normal' : 'screen' }} fillOpacity={silhouette ? 0.92 : 0.2} strokeWidth={0.6} opacity={0.85} />
          {!silhouette && <ellipse rx={3.6} ry={2} style={{ stroke: 'var(--bright)' }} strokeWidth={0.5} opacity={0.6} />}
        </g>
      </g>
      {/* bloom: petals brighten where they overlap */}
      <g transform={`translate(${r1(g.cx)} ${r1(g.cy)}) scale(1 ${g.tilt})`}>
        {g.petals.map((p, i) => (
          <g key={i} transform={`rotate(${r1(p.rot)})`} style={{ mixBlendMode: 'screen' }}>
            {/* spectral: an explicit hue per petal (screen blending would wash a hue-rotated gradient to white) */}
            <path d={p.d} fill={v.tint === 'spectral' ? `hsl(${(200 + i * 29) % 360} 85% 62%)` : `url(#${id}-p)`} fillOpacity={v.body * (p.ring ? 1.4 : 1) * (v.tint === 'spectral' ? 1.5 : 1)} style={{ stroke: 'var(--bright)' }} strokeWidth={0.55} strokeOpacity={v.rim * 0.6} />
            {v.tint === 'spectral' && <path d={p.d} fill={`url(#${id}-p)`} fillOpacity={v.body * 0.5} />}
            {p.veins.map((d, j) => <path key={j} d={d} style={{ stroke: 'var(--bright)' }} strokeWidth={0.3} strokeOpacity={j === 0 ? 0.4 : 0.22} />)}
          </g>
        ))}
        {g.stamens.map((s, i) => (
          <circle key={i} cx={r1((s.c[0] - g.cx))} cy={r1((s.c[1] - g.cy) / g.tilt)} r={s.r} style={{ fill: 'var(--b)', stroke: 'var(--bright)' }} fillOpacity={0.35} strokeWidth={0.35} strokeOpacity={0.7} />
        ))}
        {g.stamens.slice(0, 7).map((s, i) => (
          <circle key={`d${i}`} cx={r1((s.c[0] - g.cx) * 0.6)} cy={r1(((s.c[1] - g.cy) / g.tilt) * 0.6)} r={0.7} style={{ fill: 'var(--bright)' }} />
        ))}
      </g>
      {/* technical layer */}
      <g style={{ fontFamily: mono, stroke: 'var(--mute)' }} strokeWidth={0.5}>
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
              <g key={i} transform={`translate(${cxLeft + i * 64} 6)`}>
                <rect width={6} height={6} style={{ fill: c }} stroke="none" />
                <text x={9} y={5.4} fontSize={5.4} style={{ fill: 'var(--mute)' }} stroke="none">{c}</text>
              </g>
            ))}
          </g>
        )}
      </g>
    </svg>
  )
}
