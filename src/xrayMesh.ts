/**
 * Procedural flower meshes for the x-ray floral, one spec per flower type: petal rings (count, length, width,
 * how far the petal rises out of the bloom plane, curl, cup, tip shape, ripple), the centre (stamen cluster,
 * disc, long stamens, none), stem, leaves, bud. Seeded. Units: outer petal length 1.
 */
import * as THREE from 'three'
import { mulberry32 } from './Floral'

export type Ring = { n: number; L: number; W: number; rise: number; curl: number; cup: number; tip: number; ripple: number; spiral?: boolean }
export type FlowerSpec = {
  name: string
  rings: Ring[]
  centre: 'cluster' | 'disc' | 'long' | 'none'
  /** bell: one fused lathe corolla instead of petals, hanging */
  bell?: boolean
  stem: { len: number; lean: number; width: number }
  leaves: { n: number; L: number; W: number; low: boolean }
  bud: boolean
  /** default palette: petal body, rim, centre */
  palette: [string, string, string]
}

export const FLOWERS: FlowerSpec[] = [
  { name: 'poppy', rings: [{ n: 5, L: 1, W: 0.62, rise: 0.35, curl: -0.1, cup: 0.45, tip: 1, ripple: 0.3 }, { n: 4, L: 0.8, W: 0.5, rise: 0.6, curl: 0.1, cup: 0.5, tip: 1, ripple: 0.25 }], centre: 'cluster', stem: { len: 2.3, lean: 0.25, width: 0.035 }, leaves: { n: 2, L: 0.9, W: 0.16, low: true }, bud: true, palette: ['#ff9a7a', '#ffe0d0', '#ff6a3d'] },
  { name: 'tulip', rings: [{ n: 3, L: 1.3, W: 0.62, rise: 1.05, curl: 0.3, cup: 0.6, tip: 0.35, ripple: 0.05 }, { n: 3, L: 1.22, W: 0.58, rise: 1.18, curl: 0.35, cup: 0.6, tip: 0.35, ripple: 0.05 }], centre: 'none', stem: { len: 2.4, lean: 0.08, width: 0.045 }, leaves: { n: 2, L: 1.4, W: 0.22, low: true }, bud: false, palette: ['#8fb8ff', '#f2f5f7', '#ffd08a'] },
  { name: 'lily', rings: [{ n: 3, L: 1.1, W: 0.36, rise: 0.55, curl: -0.6, cup: 0.25, tip: 0.25, ripple: 0.14 }, { n: 3, L: 1.05, W: 0.4, rise: 0.45, curl: -0.65, cup: 0.25, tip: 0.25, ripple: 0.14 }], centre: 'long', stem: { len: 2.4, lean: 0.2, width: 0.04 }, leaves: { n: 3, L: 0.8, W: 0.12, low: false }, bud: true, palette: ['#f2f5f7', '#ffffff', '#ff8a3d'] },
  { name: 'peony', rings: [{ n: 9, L: 1, W: 0.6, rise: 0.3, curl: -0.15, cup: 0.4, tip: 1, ripple: 0.4 }, { n: 8, L: 0.8, W: 0.5, rise: 0.6, curl: 0.1, cup: 0.5, tip: 1, ripple: 0.4 }, { n: 7, L: 0.6, W: 0.4, rise: 0.9, curl: 0.3, cup: 0.6, tip: 1, ripple: 0.45 }, { n: 6, L: 0.42, W: 0.3, rise: 1.15, curl: 0.5, cup: 0.6, tip: 1, ripple: 0.4 }], centre: 'cluster', stem: { len: 2.1, lean: 0.2, width: 0.045 }, leaves: { n: 3, L: 0.9, W: 0.18, low: false }, bud: true, palette: ['#ffb3c7', '#fff0f4', '#ffd08a'] },
  { name: 'daisy', rings: [{ n: 18, L: 1, W: 0.2, rise: 0.12, curl: -0.1, cup: 0.15, tip: 0.6, ripple: 0.04 }], centre: 'disc', stem: { len: 2.3, lean: 0.15, width: 0.03 }, leaves: { n: 3, L: 0.7, W: 0.12, low: false }, bud: true, palette: ['#f2f5f7', '#ffffff', '#ffd23a'] },
  { name: 'iris', rings: [{ n: 3, L: 1.05, W: 0.58, rise: -0.95, curl: -0.35, cup: 0.3, tip: 0.7, ripple: 0.3 }, { n: 3, L: 0.95, W: 0.5, rise: 1.15, curl: 0.3, cup: 0.45, tip: 0.7, ripple: 0.25 }], centre: 'none', stem: { len: 2.4, lean: 0.06, width: 0.04 }, leaves: { n: 2, L: 1.6, W: 0.12, low: true }, bud: true, palette: ['#9d8bff', '#e6e0ff', '#ffd23a'] },
  { name: 'bell', rings: [], bell: true, centre: 'none', stem: { len: 2.2, lean: 0.35, width: 0.028 }, leaves: { n: 3, L: 0.7, W: 0.1, low: false }, bud: true, palette: ['#b8c6ff', '#f2f5f7', '#e0e6ff'] },
  { name: 'lotus', rings: [{ n: 8, L: 1, W: 0.42, rise: 0.45, curl: 0.05, cup: 0.35, tip: 0.3, ripple: 0.05 }, { n: 8, L: 0.85, W: 0.38, rise: 0.8, curl: 0.15, cup: 0.4, tip: 0.3, ripple: 0.05 }, { n: 6, L: 0.65, W: 0.3, rise: 1.1, curl: 0.3, cup: 0.45, tip: 0.3, ripple: 0.05 }], centre: 'disc', stem: { len: 2.2, lean: 0.05, width: 0.05 }, leaves: { n: 1, L: 1.1, W: 0.5, low: true }, bud: false, palette: ['#ffc4d6', '#fff5f8', '#ffd23a'] },
  { name: 'rose', rings: [{ n: 26, L: 1, W: 0.5, rise: 0.9, curl: 0.3, cup: 0.55, tip: 0.9, ripple: 0.12, spiral: true }], centre: 'none', stem: { len: 2.3, lean: 0.18, width: 0.04 }, leaves: { n: 3, L: 0.7, W: 0.2, low: false }, bud: true, palette: ['#ff7f9e', '#ffe4ec', '#ffb3c7'] },
  { name: 'orchid', rings: [{ n: 3, L: 1.05, W: 0.42, rise: 0.15, curl: -0.1, cup: 0.15, tip: 0.5, ripple: 0.1 }, { n: 2, L: 1.0, W: 0.68, rise: 0.05, curl: -0.05, cup: 0.12, tip: 0.95, ripple: 0.2 }, { n: 1, L: 0.62, W: 0.42, rise: -0.5, curl: 0.5, cup: 0.7, tip: 1, ripple: 0.45 }], centre: 'cluster', stem: { len: 2.3, lean: 0.3, width: 0.03 }, leaves: { n: 2, L: 1.0, W: 0.28, low: true }, bud: true, palette: ['#ff9ad5', '#fff0fa', '#ffd23a'] },
]
export const FLOWER_OF = (name: string) => FLOWERS.find((f) => f.name === name) ?? FLOWERS[0]

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
/** a lanceolate leaf along +x, folded down the midrib */
export const leafGeometry = (L: number, W: number, phase: number) => petalGeometry(L, W, 0.15, -0.35, 0.05, 0, phase, 32, 8)

/** `layer`: 0 outer .. 3 inner, so dense blooms can fade their inner petals */
export type Placed = { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4; tip: THREE.Vector3; layer?: number }
export type Flower = {
  spec: FlowerSpec
  bloom: Placed[]
  bloomM: THREE.Matrix4
  bloomCentre: THREE.Vector3
  stem: THREE.BufferGeometry
  stemTop: THREE.BufferGeometry
  branch?: THREE.BufferGeometry
  leaves: Placed[]
  bud?: Placed
  /** small spheres (anthers / disc florets) and filament segments, world space */
  dots: THREE.Vector3[]
  dotR: number
  filaments: THREE.Vector3[]
  dispose: () => void
}

/** `upright`: bloom at the top, stem down (the tab); otherwise the wide base composition */
export function buildFlower(seed: number, spec: FlowerSpec, upright = true, withBud = true, stemMul = 1, withCentre = true): Flower {
  const rng = mulberry32(seed * 104729 + 7 + spec.name.length * 131)
  const geos: THREE.BufferGeometry[] = []
  const bloomCentre = upright ? new THREE.Vector3(0, spec.bell ? 0.9 : 0.45, 0) : new THREE.Vector3(-1.25, 0.55, 0)
  // the bell is a lathe with its opening at local +y: flipped to hang, tipped toward the camera
  const tilt = spec.bell ? new THREE.Euler(Math.PI - 0.55, 0.25, 0) : new THREE.Euler(upright ? 0.75 : 0.55, upright ? -0.15 : -0.35, 0)
  const bloomM = new THREE.Matrix4().compose(bloomCentre, new THREE.Quaternion().setFromEuler(tilt), new THREE.Vector3(1, 1, 1))
  const bloom: Placed[] = []
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
      bloom.push({ geometry: g, matrix: m, tip: new THREE.Vector3(L, 0, r.curl * L).applyMatrix4(m), layer: Math.min(3, r.spiral ? Math.floor((1 - k) * 3.99) : ring) })
    }
  })
  if (spec.bell) {
    const prof = [new THREE.Vector2(0.02, 0), new THREE.Vector2(0.18, 0.05), new THREE.Vector2(0.3, 0.25), new THREE.Vector2(0.34, 0.5), new THREE.Vector2(0.4, 0.72), new THREE.Vector2(0.56, 0.9), new THREE.Vector2(0.62, 1.0)]
    const g = new THREE.LatheGeometry(prof, 36)
    // flare the rim into five lobes
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      const t = Math.max(0, (y - 0.7) / 0.3)
      const ang = Math.atan2(z, x)
      const lobe = 1 + 0.12 * Math.cos(ang * 5) * t
      p.setXYZ(i, x * lobe, y + 0.06 * Math.cos(ang * 5) * t, z * lobe)
    }
    g.computeVertexNormals()
    geos.push(g)
    const m = bloomM.clone()
    bloom.push({ geometry: g, matrix: m, tip: new THREE.Vector3(0.6, 1, 0).applyMatrix4(m) })
  }
  // centre
  const dots: THREE.Vector3[] = [], filaments: THREE.Vector3[] = []
  let dotR = 0.02
  const c0 = new THREE.Vector3(0, 0, 0.04).applyMatrix4(bloomM)
  const centre = withCentre ? spec.centre : 'none'
  if (centre === 'cluster')
    for (let i = 0; i < 56; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.22
      const p = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.12 + (0.22 - r) * 0.9 + rng() * 0.05).applyMatrix4(bloomM)
      dots.push(p)
      filaments.push(c0, p)
    }
  if (centre === 'disc') {
    dotR = 0.016
    for (let i = 0; i < 140; i++) {
      const a = i * golden, r = Math.sqrt(i / 140) * 0.24
      dots.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.03 + (0.24 - r) * 0.25).applyMatrix4(bloomM))
    }
  }
  if (centre === 'long') {
    dotR = 0.035
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3
      const p = new THREE.Vector3(Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.75 + rng() * 0.1).applyMatrix4(bloomM)
      dots.push(p)
      filaments.push(c0, p)
    }
    const pistil = new THREE.Vector3(0.03, 0, 0.95).applyMatrix4(bloomM)
    dots.push(pistil)
    filaments.push(c0, pistil)
  }
  // stem: from behind the bloom down to the base
  const stemLen = spec.stem.len * stemMul
  const base = upright ? new THREE.Vector3(spec.stem.lean * 1.4 + (rng() - 0.5) * 0.2, bloomCentre.y - stemLen, 0) : new THREE.Vector3(0.95 + rng() * 0.3, -1.95, 0)
  const p0 = new THREE.Vector3(0, 0, spec.bell ? 0 : -0.12).applyMatrix4(bloomM)
  const sway = spec.stem.lean
  const curve = spec.bell
    ? new THREE.CatmullRomCurve3([p0, new THREE.Vector3(p0.x + 0.35, p0.y + 0.1, 0), new THREE.Vector3(p0.x + 0.45, p0.y - 0.6, 0), new THREE.Vector3(base.x + 0.1, base.y + stemLen * 0.35, 0.05), base])
    : new THREE.CatmullRomCurve3([p0, new THREE.Vector3(p0.x - sway * 0.6, p0.y - stemLen * 0.3, -0.05), new THREE.Vector3(base.x - sway * 0.8, base.y + stemLen * 0.35, 0.05), base])
  const stem = new THREE.TubeGeometry(curve, 72, spec.stem.width, 12, false)
  geos.push(stem)
  // the top of the stem again, for the crisp canvas: the bloom visibly sits on its stem through the blur
  const topPts = Array.from({ length: 12 }, (_, i) => curve.getPoint((i / 11) * 0.2))
  const stemTop = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(topPts), 16, spec.stem.width, 10, false)
  geos.push(stemTop)
  const leaves: Placed[] = []
  const ts = spec.leaves.low ? [0.82, 0.92, 0.7] : [0.45, 0.66, 0.84]
  for (let i = 0; i < spec.leaves.n; i++) {
    const t = ts[i], side = i % 2 === 0 ? 1 : -1
    const p = curve.getPoint(t), tan = curve.getTangent(t)
    const g = leafGeometry(spec.leaves.L * (0.85 + rng() * 0.3), spec.leaves.W * (0.9 + rng() * 0.2), rng() * 6.28)
    geos.push(g)
    const up = spec.leaves.low ? 0.75 : 1.05
    const ang = Math.atan2(tan.y, tan.x) + side * (up + rng() * 0.25)
    const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(side * 0.5, 0, ang)), new THREE.Vector3(1, 1, 1))
    leaves.push({ geometry: g, matrix: m, tip: new THREE.Vector3(1, 0, 0.15).applyMatrix4(m) })
  }
  let branch: THREE.BufferGeometry | undefined, bud: Placed | undefined
  if (spec.bud && withBud) {
    const bp = curve.getPoint(0.36)
    const budPos = new THREE.Vector3(bp.x + (upright ? 0.55 : 1.1) + rng() * 0.2, bp.y + 0.55 + rng() * 0.2, 0.1)
    const bc = new THREE.CatmullRomCurve3([bp, new THREE.Vector3((bp.x + budPos.x) / 2 + 0.1, bp.y + 0.1, 0.05), budPos])
    branch = new THREE.TubeGeometry(bc, 24, spec.stem.width * 0.6, 8, false)
    geos.push(branch)
    // a closed bud: smooth teardrop with five sepal ridges, pointed tip
    const prof = [0, 0.05, 0.12, 0.2, 0.28, 0.36, 0.43, 0.48, 0.52].map((y) => new THREE.Vector2(0.005 + 0.17 * Math.sin(Math.pow(y / 0.52, 0.85) * Math.PI) * (1 - 0.15 * y), y))
    const bg = new THREE.LatheGeometry(prof, 48)
    const bp2 = bg.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < bp2.count; i++) {
      const x = bp2.getX(i), y = bp2.getY(i), z = bp2.getZ(i)
      const ridge = 1 + 0.1 * Math.cos(Math.atan2(z, x) * 5) * Math.sin((y / 0.52) * Math.PI)
      bp2.setXYZ(i, x * ridge, y, z * ridge)
    }
    bg.computeVertexNormals()
    geos.push(bg)
    const m = new THREE.Matrix4().compose(budPos, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), bc.getTangent(1).normalize()), new THREE.Vector3(1, 1, 1))
    bud = { geometry: bg, matrix: m, tip: new THREE.Vector3(0, 0.52, 0).applyMatrix4(m) }
  }
  return { spec, bloom, bloomM, bloomCentre, stem, stemTop, branch, leaves, bud, dots, dotR, filaments, dispose: () => geos.forEach((g) => g.dispose()) }
}
