import { useMemo } from "react";

interface FloralProps {
  width?: number;
  height?: number;
  color?: string;
  seed?: number;
  className?: string;
}

type Pt = [number, number];

// mulberry32: tiny deterministic PRNG so a given seed always draws the same plant.
function mulberry32(seed: number): () => number {
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

// Cubic bezier point evaluation, used to sample leaf-attach points along a stem.
function bezierAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  const x = mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0];
  const y = mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1];
  return [x, y];
}

// Build a curving stem from base outward at `leanDeg` from vertical (0 = straight up).
function stem(rng: () => number, base: Pt, leanDeg: number, len: number): { p0: Pt; p1: Pt; p2: Pt; p3: Pt } {
  const theta = (leanDeg * Math.PI) / 180;
  const dx = Math.sin(theta);
  const dy = -Math.cos(theta);
  const wobble = (rng() - 0.5) * 14;
  const p3: Pt = [base[0] + dx * len, base[1] + dy * len + wobble * 0.2];
  const p1: Pt = [base[0] + dx * len * 0.32, base[1] + dy * len * 0.32 + wobble];
  const p2: Pt = [base[0] + dx * len * 0.7 - dy * 8, base[1] + dy * len * 0.7 + dx * 8];
  return { p0: base, p1, p2, p3 };
}

interface LeafArt {
  outline: string;
  ghost: string;
  midrib: string;
  veins: string[];
  node: Pt;
}

// A leaf as two quadratic beziers meeting at a point tip, plus midrib and lateral veins.
function leaf(rng: () => number, base: Pt, angleDeg: number, len: number, width: number, side: 1 | -1): LeafArt {
  const a = (angleDeg * Math.PI) / 180;
  const tip: Pt = [base[0] + Math.cos(a) * len, base[1] + Math.sin(a) * len];
  const perp: Pt = [-Math.sin(a) * side, Math.cos(a) * side];
  const mid: Pt = pt(base, tip, 0.5);
  const c1: Pt = [mid[0] + perp[0] * width, mid[1] + perp[1] * width];
  const c2: Pt = [mid[0] - perp[0] * width * 0.6, mid[1] - perp[1] * width * 0.6];
  const outline = `M ${r1(base[0])} ${r1(base[1])} Q ${r1(c1[0])} ${r1(c1[1])} ${r1(tip[0])} ${r1(tip[1])} Q ${r1(c2[0])} ${r1(c2[1])} ${r1(base[0])} ${r1(base[1])} Z`;
  const gox = (rng() - 0.5) * 3;
  const goy = (rng() - 0.5) * 3;
  const ghost = `M ${r1(base[0] + gox)} ${r1(base[1] + goy)} Q ${r1(c1[0] + gox)} ${r1(c1[1] + goy)} ${r1(tip[0] + gox)} ${r1(tip[1] + goy)} Q ${r1(c2[0] + gox)} ${r1(c2[1] + goy)} ${r1(base[0] + gox)} ${r1(base[1] + goy)} Z`;
  const midrib = `M ${r1(base[0])} ${r1(base[1])} L ${r1(tip[0])} ${r1(tip[1])}`;
  const veinCount = 3 + Math.floor(rng() * 3);
  const veins: string[] = [];
  for (let j = 0; j < veinCount; j++) {
    const t = (j + 1) / (veinCount + 1);
    const vs = side === 1 ? (j % 2 === 0 ? 1 : -1) : j % 2 === 0 ? -1 : 1;
    const vp = pt(base, tip, t);
    const vLen = len * 0.22 * (1 - t * 0.3);
    const va = a + vs * ((30 + rng() * 10) * Math.PI) / 180;
    const ve: Pt = [vp[0] + Math.cos(va) * vLen, vp[1] + Math.sin(va) * vLen];
    veins.push(`M ${r1(vp[0])} ${r1(vp[1])} L ${r1(ve[0])} ${r1(ve[1])}`);
  }
  return { outline, ghost, midrib, veins, node: base };
}

const cross = (p: Pt): string => `M ${r1(p[0] - 3)} ${r1(p[1])} L ${r1(p[0] + 3)} ${r1(p[1])} M ${r1(p[0])} ${r1(p[1] - 3)} L ${r1(p[0])} ${r1(p[1] + 3)}`;

export function Floral({ width = 640, height = 120, color = "currentColor", seed = 7, className }: FloralProps) {
  const art = useMemo(() => {
    const rng = mulberry32(seed);
    const cx = width / 2;
    const baseY = height - 3;
    const count = rng() < 0.5 ? 2 : 3;
    const spread = count === 3 ? [-58, 4, 62] : [-40, 40];
    const stems: { path: string; leaves: LeafArt[]; tip: Pt; buds: Pt[] }[] = [];
    const nodes: Pt[] = [];

    for (let i = 0; i < count; i++) {
      const lean = spread[i] + (rng() - 0.5) * 12;
      const len = width * (0.2 + rng() * 0.11);
      const base: Pt = [cx + (rng() - 0.5) * 10, baseY];
      const s = stem(rng, base, lean, len);
      const path = `M ${r1(s.p0[0])} ${r1(s.p0[1])} C ${r1(s.p1[0])} ${r1(s.p1[1])} ${r1(s.p2[0])} ${r1(s.p2[1])} ${r1(s.p3[0])} ${r1(s.p3[1])}`;
      const leafCount = 3 + Math.floor(rng() * 3);
      const leaves: LeafArt[] = [];
      for (let j = 0; j < leafCount; j++) {
        const t = 0.22 + (j / leafCount) * 0.7 + rng() * 0.05;
        const p = bezierAt(s.p0, s.p1, s.p2, s.p3, t);
        const side: 1 | -1 = j % 2 === 0 ? 1 : -1;
        const stemAngle = Math.atan2(s.p3[1] - s.p0[1], s.p3[0] - s.p0[0]) * (180 / Math.PI);
        const leafAngle = stemAngle + side * (55 + rng() * 15);
        const lLen = 14 + rng() * 10;
        const lWidth = 3 + rng() * 2;
        leaves.push(leaf(rng, p, leafAngle, lLen, lWidth, side));
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
      <g opacity={0.9} strokeWidth={1}>
        {art.stems.map((s, si) => (
          <path key={`s-${si}`} d={s.path} />
        ))}
      </g>
      <g opacity={0.9} strokeWidth={0.8}>
        {art.stems.flatMap((s, si) => s.leaves.map((l, li) => <path key={`o-${si}-${li}`} d={l.outline} />))}
      </g>
      <g opacity={0.55} strokeWidth={0.5}>
        {art.stems.flatMap((s, si) =>
          s.leaves.flatMap((l, li) => [
            <path key={`m-${si}-${li}`} d={l.midrib} />,
            ...l.veins.map((v, vi) => <path key={`v-${si}-${li}-${vi}`} d={v} />),
          ]),
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
