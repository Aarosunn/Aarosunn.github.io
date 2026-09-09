import { useMemo } from "react";

interface FloralProps {
  width?: number;
  height?: number;
  color?: string;
  seed?: number;
  className?: string;
}

export type Pt = [number, number];

// mulberry32: tiny deterministic PRNG so a given seed always draws the same plant.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number): number => Math.round(n * 10) / 10;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const pt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const fmt = (p: Pt): string => `${r1(p[0])} ${r1(p[1])}`;

// Cubic bezier point evaluation, used to sample leaf-attach points along a stem.
export function bezierAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  const x = mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0];
  const y = mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1];
  return [x, y];
}

// De Casteljau split of a quadratic bezier at s: lets a vein fade in two opacity steps.
function quadSplit(p0: Pt, c: Pt, p2: Pt, s: number): { nearC: Pt; mid: Pt; farC: Pt } {
  const nearC = pt(p0, c, s);
  const farC = pt(c, p2, s);
  const mid = pt(nearC, farC, s);
  return { nearC, mid, farC };
}

// Build a curving stem from base outward at `leanDeg` from vertical (0 = straight up).
export function stem(rng: () => number, base: Pt, leanDeg: number, len: number): { p0: Pt; p1: Pt; p2: Pt; p3: Pt } {
  const theta = (leanDeg * Math.PI) / 180;
  const dx = Math.sin(theta);
  const dy = -Math.cos(theta);
  const wobble = (rng() - 0.5) * 14;
  const p3: Pt = [base[0] + dx * len, base[1] + dy * len + wobble * 0.2];
  const p1: Pt = [base[0] + dx * len * 0.32, base[1] + dy * len * 0.32 + wobble];
  const p2: Pt = [base[0] + dx * len * 0.7 - dy * 8, base[1] + dy * len * 0.7 + dx * 8];
  return { p0: base, p1, p2, p3 };
}

export interface LeafArt {
  outline: string;
  ghost: string;
  midrib: string;
  veinsNear: string[];
  veinsFar: string[];
  hatch: string[];
  node: Pt;
}

// A fuller lanceolate leaf: two cubic beziers per side (base->widest, widest->tip),
// widest point ~40% along, tip gently pointed, base slightly rounded outward.
export function leaf(
  rng: () => number,
  base: Pt,
  angleDeg: number,
  len: number,
  halfWidth: number,
  withHatch: boolean,
): LeafArt {
  const a = (angleDeg * Math.PI) / 180;
  const u: Pt = [Math.cos(a), Math.sin(a)];
  const v: Pt = [-Math.sin(a), Math.cos(a)];
  const tip: Pt = [base[0] + u[0] * len, base[1] + u[1] * len];
  const along = (f: number): Pt => [base[0] + u[0] * len * f, base[1] + u[1] * len * f];
  const edge = (f: number, w: number, e: 1 | -1): Pt => {
    const p = along(f);
    return [p[0] + v[0] * halfWidth * w * e, p[1] + v[1] * halfWidth * w * e];
  };
  const side = (e: 1 | -1) => ({
    wp: edge(0.4, 1, e),
    c1: edge(0.12, 0.55, e),
    c2: edge(0.3, 1.08, e),
    c3: edge(0.58, 0.88, e),
    c4: edge(0.85, 0.18, e),
  });
  const s1 = side(1);
  const s2 = side(-1);
  const outline = `M ${fmt(base)} C ${fmt(s1.c1)} ${fmt(s1.c2)} ${fmt(s1.wp)} C ${fmt(s1.c3)} ${fmt(s1.c4)} ${fmt(tip)} C ${fmt(s2.c4)} ${fmt(s2.c3)} ${fmt(s2.wp)} C ${fmt(s2.c2)} ${fmt(s2.c1)} ${fmt(base)} Z`;

  const gox = (rng() - 0.5) * 3;
  const goy = (rng() - 0.5) * 3;
  const shift = (p: Pt): Pt => [p[0] + gox, p[1] + goy];
  const ghost = `M ${fmt(shift(base))} C ${fmt(shift(s1.c1))} ${fmt(shift(s1.c2))} ${fmt(shift(s1.wp))} C ${fmt(shift(s1.c3))} ${fmt(shift(s1.c4))} ${fmt(shift(tip))} C ${fmt(shift(s2.c4))} ${fmt(shift(s2.c3))} ${fmt(shift(s2.wp))} C ${fmt(shift(s2.c2))} ${fmt(shift(s2.c1))} ${fmt(shift(base))} Z`;

  const midrib = `M ${fmt(base)} L ${fmt(tip)}`;

  // Lateral veins: quadratic arcs bowed toward the tip, split so the outer half reads fainter.
  const veinCount = 5 + Math.floor(rng() * 3);
  const veinsNear: string[] = [];
  const veinsFar: string[] = [];
  for (let j = 0; j < veinCount; j++) {
    const t = 0.12 + (j / (veinCount - 1)) * 0.72;
    const vs: 1 | -1 = j % 2 === 0 ? 1 : -1;
    const vp = pt(base, tip, t);
    const widthAt = t < 0.4 ? lerp(0.3, 1, t / 0.4) : lerp(1, 0.05, (t - 0.4) / 0.6);
    const vLen = halfWidth * widthAt * 0.85;
    const va = a + vs * ((62 * Math.PI) / 180);
    const ve: Pt = [vp[0] + Math.cos(va) * vLen, vp[1] + Math.sin(va) * vLen];
    const bend = vLen * 0.4;
    const ctrl: Pt = [(vp[0] + ve[0]) / 2 + u[0] * bend, (vp[1] + ve[1]) / 2 + u[1] * bend];
    const split = quadSplit(vp, ctrl, ve, 0.55);
    veinsNear.push(`M ${fmt(vp)} Q ${fmt(split.nearC)} ${fmt(split.mid)}`);
    veinsFar.push(`M ${fmt(split.mid)} Q ${fmt(split.farC)} ${fmt(ve)}`);
  }

  // Optional cut-away detail: three faint parallel hatch lines across one corner.
  const hatch: string[] = [];
  if (withHatch) {
    for (let k = 0; k < 3; k++) {
      const f = 0.6 + k * 0.07;
      hatch.push(`M ${fmt(edge(f, 0.1, 1))} L ${fmt(edge(f, 0.62, 1))}`);
    }
  }

  return { outline, ghost, midrib, veinsNear, veinsFar, hatch, node: base };
}

const cross = (p: Pt): string => `M ${r1(p[0] - 3)} ${r1(p[1])} L ${r1(p[0] + 3)} ${r1(p[1])} M ${r1(p[0])} ${r1(p[1] - 3)} L ${r1(p[0])} ${r1(p[1] + 3)}`;

export function Floral({ width = 640, height = 120, color = "currentColor", seed = 7, className }: FloralProps) {
  const art = useMemo(() => {
    const rng = mulberry32(seed);
    const cx = width / 2;
    const baseY = height - 3;
    const maxRise = Math.min(height - 8, 100);
    const count = rng() < 0.5 ? 2 : 3;
    const spread = count === 3 ? [-72, -4, 70] : [-64, 64];
    const stems: { path: string; leaves: LeafArt[]; tip: Pt; buds: Pt[] }[] = [];
    const nodes: Pt[] = [];

    for (let i = 0; i < count; i++) {
      const lean = spread[i] + (rng() - 0.5) * 12;
      const outer = Math.abs(lean) > 25;
      const len = outer ? width * (0.36 + rng() * 0.14) : maxRise * (0.85 + rng() * 0.15);
      const base: Pt = [cx + (rng() - 0.5) * 10, baseY];
      const s = stem(rng, base, lean, len);
      const path = `M ${fmt(s.p0)} C ${fmt(s.p1)} ${fmt(s.p2)} ${fmt(s.p3)}`;
      const stemAngle = Math.atan2(s.p3[1] - s.p0[1], s.p3[0] - s.p0[0]) * (180 / Math.PI);
      const leafCount = 4 + Math.floor(rng() * 3);
      const leaves: LeafArt[] = [];
      for (let j = 0; j < leafCount; j++) {
        const t = 0.2 + (j / leafCount) * 0.72 + rng() * 0.04;
        const p = bezierAt(s.p0, s.p1, s.p2, s.p3, t);
        const side: 1 | -1 = j % 2 === 0 ? 1 : -1;
        const droop = t * 10;
        const leafAngle = stemAngle + side * (35 + rng() * 25) + droop;
        const lLen = 26 + rng() * 20;
        const halfWidth = (lLen * (0.3 + rng() * 0.15)) / 2;
        leaves.push(leaf(rng, p, leafAngle, lLen, halfWidth, i === 0 && j === 1));
        nodes.push(p);
      }
      const buds: Pt[] = rng() < 0.6 ? [s.p3] : [];
      stems.push({ path, leaves, tip: s.p3, buds });
    }

    // Dimension line spans the widest stem-tip reach; end ticks mark it.
    const xs = stems.map((s) => s.tip[0]);
    const minX = Math.min(...xs, cx - 20);
    const maxX = Math.max(...xs, cx + 20);
    const dimY = height - 6;
    const dimLine = `M ${r1(minX)} ${r1(dimY)} L ${r1(maxX)} ${r1(dimY)}`;
    const ticks = [
      `M ${r1(minX)} ${r1(dimY - 3)} L ${r1(minX)} ${r1(dimY + 3)}`,
      `M ${r1(maxX)} ${r1(dimY - 3)} L ${r1(maxX)} ${r1(dimY + 3)}`,
    ];

    const crossIdx = [0, Math.floor(nodes.length / 2), nodes.length - 1].filter(
      (v, i, a) => v >= 0 && v < nodes.length && a.indexOf(v) === i,
    );
    const crosshairs = crossIdx.slice(0, 3).map((i) => nodes[i]);

    const leaderFrom = nodes[nodes.length - 1] ?? [cx, baseY];
    const leaderTo: Pt = [leaderFrom[0] + 14, leaderFrom[1] - 10];
    const leader = `M ${r1(leaderFrom[0])} ${r1(leaderFrom[1])} L ${r1(leaderTo[0])} ${r1(leaderTo[1])}`;

    return { stems, dimLine, ticks, crosshairs, leader, leaderTo };
  }, [seed, width, height]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMax meet"
      className={className}
      fill="none"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g opacity={0.3} strokeWidth={0.8}>
        {art.stems.flatMap((s, si) => s.leaves.map((l, li) => <path key={`g-${si}-${li}`} d={l.ghost} />))}
      </g>
      <g opacity={0.9} strokeWidth={0.6}>
        {art.stems.map((s, si) => (
          <path key={`s-${si}`} d={s.path} />
        ))}
      </g>
      <g opacity={0.9} strokeWidth={0.8}>
        {art.stems.flatMap((s, si) => s.leaves.map((l, li) => <path key={`o-${si}-${li}`} d={l.outline} />))}
      </g>
      <g opacity={0.55} strokeWidth={0.5}>
        {art.stems.flatMap((s, si) => s.leaves.map((l, li) => <path key={`m-${si}-${li}`} d={l.midrib} />))}
      </g>
      <g opacity={0.5} strokeWidth={0.45}>
        {art.stems.flatMap((s, si) =>
          s.leaves.flatMap((l, li) => l.veinsNear.map((v, vi) => <path key={`vn-${si}-${li}-${vi}`} d={v} />)),
        )}
      </g>
      <g opacity={0.2} strokeWidth={0.4}>
        {art.stems.flatMap((s, si) =>
          s.leaves.flatMap((l, li) => l.veinsFar.map((v, vi) => <path key={`vf-${si}-${li}-${vi}`} d={v} />)),
        )}
      </g>
      <g opacity={0.35} strokeWidth={0.4}>
        {art.stems.flatMap((s, si) =>
          s.leaves.flatMap((l, li) => l.hatch.map((h, hi) => <path key={`h-${si}-${li}-${hi}`} d={h} />)),
        )}
      </g>
      <g opacity={0.9} strokeWidth={0.8}>
        {art.stems.flatMap((s, si) =>
          s.buds.map((b, bi) => (
            <g key={`b-${si}-${bi}`}>
              <ellipse cx={r1(b[0])} cy={r1(b[1])} rx={5} ry={3.2} />
              <ellipse cx={r1(b[0])} cy={r1(b[1])} rx={2.8} ry={1.6} />
            </g>
          )),
        )}
      </g>
      <g opacity={0.5} strokeWidth={0.6}>
        <path d={art.dimLine} />
        {art.ticks.map((t, i) => (
          <path key={`t-${i}`} d={t} />
        ))}
        {art.crosshairs.map((p, i) => (
          <path key={`c-${i}`} d={cross(p)} />
        ))}
        <path d={art.leader} />
        <circle cx={r1(art.leaderTo[0])} cy={r1(art.leaderTo[1])} r={1.5} />
      </g>
    </svg>
  );
}
