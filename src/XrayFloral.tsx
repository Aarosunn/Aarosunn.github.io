/**
 * X-ray technical floral for the site's base: a bloom of translucent petals that brighten where they overlap
 * (screen blend), veins, a glowing stem, leaves and a bud, under a technical layer of callouts, frames,
 * coordinates, arcs, rulers and swatches. Geometry from a seed; the look from a FloralVersion. Colours come from
 * the scheme's CSS variables so it follows the site.
 */
import { useEffect, useMemo, useState } from 'react'
import { bezierAt, leaf, mulberry32, type LeafArt, type Pt } from './Floral'
import type { FloralVersion } from './floralVersions'
import { TechLayer, XF_H, XF_W, layoutTech, r1, readSwatches, type Anchor } from './xrayTech'
export { XF_H, XF_W } from './xrayTech'
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
  const tech = layoutTech(v, rng, {
    anchors, cx, cy, R, tilt,
    bloomPts: petals.map((p) => p.tip),
    parts: [[[bud[0] - 7, bud[1] - 5], [bud[0] + 7, bud[1] + 5]], ...leaves.map((l) => pathPts(l.outline))],
  })
  return { cx, cy, R, tilt, petals, stamens, stemD, leaves, bud, branchD, tech }
}
/** sample points of a path's numbers (enough for a bounding box) */
function pathPts(d: string): Pt[] {
  const n = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  const out: Pt[] = []
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]])
  return out
}

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const swatches = useMemo(() => readSwatches(v), [v.swatches, scheme])
  const silhouette = v.silhouette
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
      <TechLayer v={v} g={g.tech} tick={tick} swatches={swatches} />
    </svg>
  )
}
