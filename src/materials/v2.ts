/**
 * v2 surfaces: the paper.design trio (github.com/paper-design/shaders, Apache 2.0) rebuilt on
 * MeshPhysicalMaterial so every face keeps real lighting, env reflections and specular.
 *
 * Continuity through turns: animated fields (heat flow, smoke veins) are evaluated in the cube's
 * current root space (`vCube`), so a turning slice moves through a fixed field with no pop at the
 * end. The only per-cubie term is edge proximity, evaluated in the cubie's rest slot (`uRot`/`uPos`);
 * it is symmetric under quarter turns, so it is continuous too and stays glued to the slice.
 * One material per cubie so the rest-slot uniforms can differ; programs are shared via cache key.
 */
import * as THREE from 'three'
import type { Variant } from './v1'

export type Palette = { a: string; b: string; bg: string; bright: string; text: string }

const PARS = /* glsl */ `
  uniform float uTime; uniform float uHalf; uniform vec3 uA; uniform vec3 uB; uniform vec3 uBg; uniform vec3 uBright;
  varying vec3 vRest; varying vec3 vCube;
  float sst(float a, float b, float x) { return smoothstep(a, b, x); }
  float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }
  // 0 at face centres, 1 along the big cube's outer edges and corners. Rest slot, quarter-turn symmetric.
  float edgeProx() {
    vec3 a = abs(vRest);
    float hi = max(a.x, max(a.y, a.z));
    float mid = a.x + a.y + a.z - hi - min(a.x, min(a.y, a.z));
    return sst(uHalf - 0.22, uHalf, mid);
  }
  float fres(vec3 n, float p) { return pow(1.0 - max(dot(normalize(n), normalize(vViewPosition)), 0.0), p); }
  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  vec3 lightest() { return lum(uBright) > lum(uBg) ? uBright : uBg; }
`

// Paper heatmap, deepened: near-black navy body, blue, a green-yellow blend, orange, red.
const HEAT = /* glsl */ `
  vec3 grad(float h) {
    vec3 c[9];
    c[0] = vec3(0.012, 0.016, 0.055); c[1] = vec3(0.055, 0.110, 0.380); c[2] = vec3(0.110, 0.220, 0.620);
    c[3] = vec3(0.150, 0.390, 0.900); c[4] = vec3(0.250, 0.800, 0.850); c[5] = vec3(0.560, 0.880, 0.480);
    c[6] = vec3(1.000, 0.900, 0.470); c[7] = vec3(1.000, 0.560, 0.100); c[8] = vec3(0.950, 0.220, 0.020);
    float m = clamp(h, 0.0, 0.9999) * 8.0;
    int i = int(floor(m));
    return mix(c[i], c[i + 1], fract(m));
  }
  vec3 heatColor(vec3 n) {
    float t = 0.1 * uTime;
    float edge = edgeProx();
    float f = fres(n, 2.5);
    // cool body, hot rim
    float heat = 0.12 + 0.72 * edge + 0.18 * f;
    // three cold voids drifting up through the body (paper's shadow shapes)
    for (int k = 0; k < 3; k++) {
      float tk = fract(t + float(k) / 3.0);
      float cy = mix(-3.4, 3.8, tk);
      vec3 d = (vCube - vec3(0.0, cy, 0.0)) * vec3(0.55, 1.0, 0.55);
      float s = 1.0 - sst(0.7, 2.1, length(d));
      heat = mix(heat, 0.03, s * (1.0 - 0.75 * edge));
    }
    // one warm band rising (paper's animated outer mask), carries the green-yellow blend
    float y = fract((vCube.y + uHalf) / (2.0 * uHalf) - fract(t * 3.0 - 0.1));
    float band = sst(0.25, 0.6, y) * (1.0 - sst(0.6, 1.0, y));
    heat += 0.5 * band * (1.0 - 0.5 * edge);
    heat += 0.3 * (fbm(vCube * 1.1 + vec3(0.0, -uTime * 0.18, 0.0)) - 0.5) * (1.0 - edge);
    heat = clamp(heat, 0.0, 1.0);
    // body stays deep; only the hot end pushes past 1.0 for bloom
    return grad(heat) * (0.35 + 0.95 * sst(0.62, 1.0, heat));
  }
`

// Paper gem-smoke, as a 3D marble: swirled fbm field in cube space, dark veins with a light core,
// inside a pale glass body.
const SMOKE = /* glsl */ `
  vec3 smokeColor() {
    float t = uTime * 0.12;
    vec3 p = vCube * 0.85;
    float s = 0.42 * (0.4 + 0.6 * (1.0 - edgeProx()));
    for (int i = 1; i < 4; i++) {
      float fi = float(i);
      p.x += s / fi * cos(t + fi * 2.9 * p.y);
      p.y += s / fi * cos(t + fi * 1.5 * p.z);
      p.z += s / fi * cos(t + fi * 2.1 * p.x);
    }
    float d = fbm(p * 1.5 + vec3(0.0, 0.0, t * 0.5));
    float veins = sst(0.40, 0.62, d);
    float core = sst(0.60, 0.82, d);
    vec3 glass = mix(lightest(), uA, 0.10) * 0.94;
    vec3 dark = mix(vec3(0.10, 0.10, 0.12), uB, 0.25);
    vec3 light = mix(lightest(), uA, 0.30);
    vec3 col = mix(glass, dark, veins);
    return mix(col, light, core * 0.9);
  }
`

type Inject = { pars: string; slot: string; body: string }

const INJECT: Partial<Record<Variant, Inject>> = {
  heat: { pars: HEAT, slot: '#include <emissivemap_fragment>', body: 'totalEmissiveRadiance = heatColor(normal);' },
  smoke: { pars: SMOKE, slot: '#include <color_fragment>', body: 'diffuseColor.rgb = smokeColor();' },
}

const BASE: Record<Variant, THREE.MeshPhysicalMaterialParameters> = {
  // dark glossy body; the heat is emissive on top, env gloss gives the depth
  heat: { color: '#020308', roughness: 0.28, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.7 },
  // liquid metal: the stripe lives in the environment (see App); thin-film iridescence gives the rainbow tint
  chrome: {
    color: '#f2f3f8',
    metalness: 1,
    roughness: 0.05,
    iridescence: 1,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [140, 420],
    envMapIntensity: 1.15,
  },
  // polished stone: diffuse smoke inside, clearcoat + env on top
  smoke: { color: '#ffffff', roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9 },
}

export type V2Material = THREE.MeshPhysicalMaterial & { u: Record<string, THREE.IUniform> }

/** Uniforms shared by all 27 cubie materials of one cube. */
export type Shared = { uTime: THREE.IUniform<number>; uRootInv: THREE.IUniform<THREE.Matrix4> }
export const makeShared = (): Shared => ({ uTime: { value: 0 }, uRootInv: { value: new THREE.Matrix4() } })

export function makeV2(variant: Variant, p: Palette, half: number, shared: Shared): V2Material {
  const m = new THREE.MeshPhysicalMaterial(BASE[variant]) as V2Material
  m.u = {
    ...shared,
    uHalf: { value: half },
    uRot: { value: new THREE.Matrix3() },
    uPos: { value: new THREE.Vector3() },
    uA: { value: new THREE.Color(p.a) },
    uB: { value: new THREE.Color(p.b) },
    uBg: { value: new THREE.Color(p.bg) },
    uBright: { value: new THREE.Color(p.bright) },
  }
  const inj = INJECT[variant]
  if (inj) {
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, m.u)
      sh.vertexShader = sh.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform mat3 uRot; uniform vec3 uPos; uniform mat4 uRootInv; varying vec3 vRest; varying vec3 vCube;',
        )
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvRest = uRot * position + uPos;\nvCube = (uRootInv * modelMatrix * vec4(position, 1.0)).xyz;',
        )
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${PARS}\n${inj.pars}`)
        .replace(inj.slot, inj.body)
    }
    m.customProgramCacheKey = () => `v2-${variant}`
  }
  return m
}
