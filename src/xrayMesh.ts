/**
 * Procedural flower mesh for the x-ray floral: parametric petals in rings, a tube stem, leaves, a bud on a side
 * branch, a stamen cluster. Seeded. Units: outer petal length 1.
 */
import * as THREE from 'three'
import { mulberry32 } from './Floral'

/** a petal (or leaf) along +x, width across y, curling / cupping toward +z */
export function petalGeometry(L: number, W: number, curl: number, cup: number, ripple: number, phase: number, segU = 28, segV = 12) {
  const pos: number[] = [], idx: number[] = []
  for (let i = 0; i <= segU; i++) {
    const u = i / segU
    // a broad fan that widens to the tip and rounds off (poppy / peony), not a pointed leaf
    let wp = Math.sqrt(Math.sin(Math.min(u * 1.1, 1) * Math.PI * 0.5))
    if (u > 0.82) wp *= Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.82) / 0.18, 2)))
    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * 2 - 1
      const x = u * L
      const y = v * W * wp
      const z = curl * L * u * u + cup * W * v * v * (0.3 + 0.7 * u) + ripple * W * Math.sin(v * Math.PI * 2.5 + phase) * u * u * u
      pos.push(x, y, z)
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

/** a lanceolate leaf along +x: widest a third of the way, pointed tip, folded down the midrib */
export function leafGeometry(L: number, W: number, phase: number, segU = 32, segV = 8) {
  const pos: number[] = [], idx: number[] = []
  for (let i = 0; i <= segU; i++) {
    const u = i / segU
    const wp = Math.sin(Math.pow(u, 0.7) * Math.PI)
    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * 2 - 1
      pos.push(u * L, v * W * wp, 0.15 * L * u * u - 0.35 * W * Math.abs(v) * (0.3 + 0.7 * u) + 0.05 * W * Math.sin(v * Math.PI * 2.5 + phase) * u * u)
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

export type Placed = { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4; tip: THREE.Vector3; part: 'petal' | 'leaf' | 'bud' | 'stem' }
export type Flower = {
  bloom: Placed[]
  bloomTilt: THREE.Euler
  bloomCentre: THREE.Vector3
  stem: THREE.BufferGeometry
  branch: THREE.BufferGeometry
  leaves: Placed[]
  bud: Placed
  stamens: THREE.Vector3[]
  anchors: { name: string; p: THREE.Vector3; part: string }[]
  dispose: () => void
}

export function buildFlower(seed: number): Flower {
  const rng = mulberry32(seed * 104729 + 7)
  const geos: THREE.BufferGeometry[] = []
  const bloomCentre = new THREE.Vector3(-1.25, 0.55, 0)
  const bloomTilt = new THREE.Euler(0.55, -0.35, 0)
  const bloomM = new THREE.Matrix4().compose(bloomCentre, new THREE.Quaternion().setFromEuler(bloomTilt), new THREE.Vector3(1, 1, 1))
  const bloom: Placed[] = []
  const rings: [number, number, number, number, number][] = [
    [8, 1.0, 0.58, -0.18, 0.3], // outer: broad, open, bending back a little
    [6, 0.62, 0.4, 0.45, 0.55], // inner: cupped, rising
  ]
  const tips: THREE.Vector3[] = []
  rings.forEach(([n, L, W, curl, cup], ring) => {
    const off = rng() * Math.PI * 2
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.2
      const g = petalGeometry(L * (0.9 + rng() * 0.2), W * (0.85 + rng() * 0.3), curl + (rng() - 0.5) * 0.15, cup, 0.22, rng() * 6.28, 32, 14)
      geos.push(g)
      const m = new THREE.Matrix4().makeRotationZ(a).premultiply(new THREE.Matrix4().makeTranslation(0, 0, ring * 0.06))
      m.premultiply(bloomM)
      const tip = new THREE.Vector3(L, 0, curl * L).applyMatrix4(m)
      if (ring === 0) tips.push(tip)
      bloom.push({ geometry: g, matrix: m, tip, part: 'petal' })
    }
  })
  // stamens on a cap above the centre
  const stamens: THREE.Vector3[] = []
  for (let i = 0; i < 56; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.22
    stamens.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.12 + (0.26 - r) * 0.9 + rng() * 0.05).applyMatrix4(bloomM))
  }
  // stem from behind the bloom to the base, right
  const base = new THREE.Vector3(0.95 + rng() * 0.3, -1.95, 0)
  const p0 = new THREE.Vector3(0, 0, -0.15).applyMatrix4(bloomM)
  const curve = new THREE.CatmullRomCurve3([p0, new THREE.Vector3(p0.x - 0.1, p0.y - 0.7, -0.05), new THREE.Vector3(base.x - 0.7, base.y + 0.9, 0.05), base])
  const stem = new THREE.TubeGeometry(curve, 72, 0.045, 12, false)
  geos.push(stem)
  const leaves: Placed[] = []
  for (const [t, side] of [[0.45, 1], [0.66, -1], [0.84, 1]] as [number, number][]) {
    const p = curve.getPoint(t), tan = curve.getTangent(t)
    const g = leafGeometry(0.95 + rng() * 0.3, 0.2 + rng() * 0.06, rng() * 6.28)
    geos.push(g)
    const ang = Math.atan2(tan.y, tan.x) + side * (1.05 + rng() * 0.25)
    const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(side * 0.5, 0, ang)), new THREE.Vector3(1, 1, 1))
    leaves.push({ geometry: g, matrix: m, tip: new THREE.Vector3(1, 0, 0.15).applyMatrix4(m), part: 'leaf' })
  }
  // bud on a side branch
  const bp = curve.getPoint(0.36)
  const budPos = new THREE.Vector3(bp.x + 1.1 + rng() * 0.2, bp.y + 0.55 + rng() * 0.2, 0.1)
  const branchCurve = new THREE.CatmullRomCurve3([bp, new THREE.Vector3(bp.x + 0.6, bp.y + 0.1, 0.05), budPos])
  const branch = new THREE.TubeGeometry(branchCurve, 24, 0.028, 8, false)
  geos.push(branch)
  const budGeo = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.13, 0.1), new THREE.Vector2(0.17, 0.26), new THREE.Vector2(0.1, 0.42), new THREE.Vector2(0.01, 0.5)].map((p) => p), 18)
  geos.push(budGeo)
  const bt = branchCurve.getTangent(1)
  const budM = new THREE.Matrix4().compose(budPos, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), bt.normalize()), new THREE.Vector3(1, 1, 1))
  const bud: Placed = { geometry: budGeo, matrix: budM, tip: new THREE.Vector3(0, 0.5, 0).applyMatrix4(budM), part: 'bud' }
  const anchors = [
    { name: 'object.flower', p: bloomCentre.clone(), part: 'bloom' },
    { name: '.stem', p: curve.getPoint(0.6), part: 'stem' },
    { name: 'bud.png', p: bud.tip, part: 'bud' },
    ...leaves.map((l, i) => ({ name: `leaf.0${i + 1}`, p: l.tip, part: 'leaf' })),
    ...tips.filter((_, i) => i % 3 === 0).slice(0, 4).map((p, i) => ({ name: `petal.0${i + 1}`, p, part: 'petal' })),
  ]
  return { bloom, bloomTilt, bloomCentre, stem, branch, leaves, bud, stamens, anchors, dispose: () => geos.forEach((g) => g.dispose()) }
}
