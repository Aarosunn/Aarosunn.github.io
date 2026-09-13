/**
 * Procedural blooms for the x-ray florals: petal rings (count, length, width, how far a petal rises out of the bloom
 * plane, curl, cup, tip shape, ripple; the rose is one spiral). Seeded. Units: outer petal length 1.
 */
import * as THREE from 'three'

/** mulberry32: a tiny seeded PRNG, so a given seed always grows the same flower */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Ring = { n: number; L: number; W: number; rise: number; curl: number; cup: number; tip: number; ripple: number; spiral?: boolean }
export type FlowerSpec = { name: string; rings: Ring[] }

export const FLOWERS: Record<string, FlowerSpec> = {
  lotus: { name: 'lotus', rings: [{ n: 8, L: 1, W: 0.42, rise: 0.45, curl: 0.05, cup: 0.35, tip: 0.3, ripple: 0.05 }, { n: 8, L: 0.85, W: 0.38, rise: 0.8, curl: 0.15, cup: 0.4, tip: 0.3, ripple: 0.05 }, { n: 6, L: 0.65, W: 0.3, rise: 1.1, curl: 0.3, cup: 0.45, tip: 0.3, ripple: 0.05 }] },
  rose: { name: 'rose', rings: [{ n: 26, L: 1, W: 0.5, rise: 0.9, curl: 0.3, cup: 0.55, tip: 0.9, ripple: 0.12, spiral: true }] },
  orchid: { name: 'orchid', rings: [{ n: 3, L: 1.05, W: 0.42, rise: 0.15, curl: -0.1, cup: 0.15, tip: 0.5, ripple: 0.1 }, { n: 2, L: 1.0, W: 0.68, rise: 0.05, curl: -0.05, cup: 0.12, tip: 0.95, ripple: 0.2 }, { n: 1, L: 0.62, W: 0.42, rise: -0.5, curl: 0.5, cup: 0.7, tip: 1, ripple: 0.45 }] },
}

/** a petal along +x: `tip` 1 = broad fan with a rounded end, 0 = pointed lanceolate; curl / cup / ripple toward +z */
export function petalGeometry(L: number, W: number, curl: number, cup: number, ripple: number, tip: number, phase: number, segU = 30, segV = 14) {
  const pos: number[] = [], idx: number[] = []
  for (let i = 0; i <= segU; i++) {
    const u = i / segU
    let fan = Math.sqrt(Math.sin(Math.min(u * 1.1, 1) * Math.PI * 0.5))
    if (u > 0.82) fan *= Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.82) / 0.18, 2)))
    const lance = Math.sin(Math.pow(u, 0.7) * Math.PI)
    const wp = lance + (fan - lance) * tip
    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * 2 - 1
      pos.push(u * L, v * W * wp, curl * L * u * u + cup * W * v * v * (0.3 + 0.7 * u) + ripple * W * Math.sin(v * Math.PI * 2.5 + phase) * u * u * u)
    }
  }
  for (let i = 0; i < segU; i++)
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j, b = a + segV + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** `layer`: 0 outer .. 3 inner, so dense blooms can fade their inner petals */
export type Petal = { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4; layer: number }
export type Flower = { spec: FlowerSpec; bloom: Petal[]; bloomCentre: THREE.Vector3; dispose: () => void }

/** the bloom alone (no stem, leaves, bud or pollen): its centre at y .45, tilted a little toward the camera */
export function buildFlower(seed: number, spec: FlowerSpec): Flower {
  const rng = mulberry32(seed * 104729 + 7 + spec.name.length * 131)
  const geos: THREE.BufferGeometry[] = []
  const bloomCentre = new THREE.Vector3(0, 0.45, 0)
  const bloomM = new THREE.Matrix4().compose(bloomCentre, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.75, -0.15, 0)), new THREE.Vector3(1, 1, 1))
  const bloom: Petal[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  spec.rings.forEach((r, ring) => {
    const off = rng() * Math.PI * 2
    for (let i = 0; i < r.n; i++) {
      const k = r.spiral ? i / (r.n - 1) : 0 // rose: inner petals first, tighter and more upright
      const a = r.spiral ? off + i * golden : off + (i / r.n) * Math.PI * 2 + (rng() - 0.5) * 0.25
      const L = r.L * (r.spiral ? 0.3 + 0.7 * k : 0.9 + rng() * 0.2)
      const W = r.W * (r.spiral ? 0.4 + 0.6 * k : 0.85 + rng() * 0.3)
      const rise = r.spiral ? 1.35 - 1.0 * k : r.rise + (rng() - 0.5) * 0.15
      const g = petalGeometry(L, W, r.curl + (rng() - 0.5) * 0.12, r.cup, r.ripple, r.tip, rng() * 6.28)
      geos.push(g)
      const m = new THREE.Matrix4().makeRotationZ(a).multiply(new THREE.Matrix4().makeRotationY(-rise)).premultiply(new THREE.Matrix4().makeTranslation(0, 0, ring * 0.05 - (r.spiral ? k * 0.25 : 0)))
      m.premultiply(bloomM)
      bloom.push({ geometry: g, matrix: m, layer: Math.min(3, r.spiral ? Math.floor((1 - k) * 3.99) : ring) })
    }
  })
  return { spec, bloom, bloomCentre, dispose: () => geos.forEach((g) => g.dispose()) }
}
