/**
 * v2 surfaces: the paper.design trio (github.com/paper-design/shaders, Apache 2.0) rebuilt on
 * MeshPhysicalMaterial so every face keeps real lighting, env reflections and specular.
 * Patterns are computed in "rest space" (per-cubie uniforms uRot/uPos = the cubie's snapped
 * orientation and slot), so the skin rides with a turning slice instead of sliding under it.
 * One material per cubie (27) so those uniforms can differ; programs are shared via cache key.
 */
import * as THREE from 'three'
import type { Variant } from './v1'

export type Palette = { a: string; b: string; bg: string; bright: string; text: string }

const PARS = /* glsl */ `
  uniform float uTime; uniform float uHalf; uniform vec3 uA; uniform vec3 uB; uniform vec3 uBg; uniform vec3 uBright;
  varying vec3 vRootP; varying vec3 vRootN;
  float sst(float a, float b, float x) { return smoothstep(a, b, x); }
  float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  // 0 at face centres, 1 along the big cube's outer edges and corners (rest space).
  float edgeProx() {
    vec3 a = abs(vRootP);
    float hi = max(a.x, max(a.y, a.z));
    float mid = a.x + a.y + a.z - hi - min(a.x, min(a.y, a.z));
    return sst(uHalf - 0.24, uHalf, mid);
  }
  vec2 faceUV() {
    vec3 n = abs(vRootN);
    if (n.x > n.y && n.x > n.z) return vRootP.zy;
    if (n.y > n.z) return vRootP.xz;
    return vRootP.xy;
  }
  float fres(vec3 n, float p) { return pow(1.0 - max(dot(normalize(n), normalize(vViewPosition)), 0.0), p); }
  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  vec3 lightest() { return lum(uBright) > lum(uBg) ? uBright : uBg; }
  vec3 darkest() { return lum(uBright) > lum(uBg) ? uBg : uBright; }
`

// Paper heatmap: 7 stops cold->hot. Cool body, hot rim, cold voids drifting up, one warm band rising.
const HEAT = /* glsl */ `
  vec3 grad7(float h) {
    vec3 c[7];
    c[0] = vec3(0.067, 0.125, 0.416); c[1] = vec3(0.122, 0.231, 0.635); c[2] = vec3(0.184, 0.388, 0.906);
    c[3] = vec3(0.420, 0.843, 1.000); c[4] = vec3(1.000, 0.902, 0.475); c[5] = vec3(1.000, 0.600, 0.118);
    c[6] = vec3(1.000, 0.298, 0.000);
    float m = clamp(h, 0.0, 0.9999) * 6.0;
    int i = int(floor(m));
    return mix(c[i], c[i + 1], fract(m));
  }
  vec3 heatColor(vec3 n) {
    float t = 0.1 * uTime;
    float edge = edgeProx();
    float f = fres(n, 2.0);
    float inner = 0.16 + 0.6 * edge + 0.3 * f;
    for (int k = 0; k < 3; k++) {
      float tk = fract(t + float(k) / 3.0);
      float cy = mix(-3.2, 3.6, tk);
      vec3 d = (vRootP - vec3(0.0, cy, 0.0)) * vec3(0.6, 1.0, 0.6);
      float s = 1.0 - sst(0.8, 2.0, length(d));
      inner = mix(inner, 0.06, s * (1.0 - 0.7 * edge));
    }
    float y = fract((vRootP.y + uHalf) / (2.0 * uHalf) - fract(t * 3.0 - 0.1));
    float band = sst(0.3, 0.65, y) * (1.0 - sst(0.65, 1.0, y));
    inner += 0.3 * band;
    inner += 0.35 * (vnoise(vRootP * 1.6 + vec3(0.0, -uTime * 0.2, 0.0)) - 0.5) * (1.0 - edge);
    float heat = clamp(inner, 0.0, 1.0);
    return grad7(heat) * (0.6 + 1.9 * sst(0.6, 1.0, heat));
  }
`

// Paper gem-smoke: swirl field -> gaussian -> two-stop gradient over milky glass.
const SMOKE = /* glsl */ `
  vec3 smokeColor() {
    const float innerDistortion = 0.8, size = 0.95, colorsCount = 2.0;
    float roundness = 1.0 - edgeProx();
    vec2 uv = faceUV() / (2.0 * uHalf) * mix(4.0, 1.0, size);
    uv.y += innerDistortion * (1.0 - sst(0.0, 1.0, length(0.4 * uv)));
    uv.y -= 0.4 * innerDistortion;
    float swirl = innerDistortion * roundness;
    for (int i = 1; i < 5; i++) {
      float fi = float(i);
      float stretch = max(length(dFdx(uv)), length(dFdy(uv)));
      float sw = swirl / (1.0 + stretch * 8.0);
      uv.x += sw / fi * cos(uTime + fi * 2.9 * uv.y);
      uv.y += sw / fi * cos(uTime + fi * 1.5 * uv.x);
    }
    float shape = exp(-1.5 * dot(uv, uv));
    float mixer = shape * colorsCount;
    vec3 smokeDark = mix(vec3(0.24), uB, 0.35);
    vec3 smokeLight = mix(lightest(), uA, 0.12);
    float m1 = sst(0.0, 1.0, clamp(mixer, 0.0, 1.0));
    float m2 = sst(0.0, 1.0, clamp(mixer - 1.0, 0.0, 1.0));
    vec3 glass = mix(lightest(), uA, 0.06);
    return mix(glass, mix(smokeDark, smokeLight, m2), m1);
  }
`

type Inject = { pars: string; slot: string; body: string }

const INJECT: Partial<Record<Variant, Inject>> = {
  heat: { pars: HEAT, slot: '#include <emissivemap_fragment>', body: 'totalEmissiveRadiance = heatColor(normal);' },
  smoke: { pars: SMOKE, slot: '#include <color_fragment>', body: 'diffuseColor.rgb = smokeColor();' },
}

const BASE: Record<Variant, THREE.MeshPhysicalMaterialParameters> = {
  // dark glossy body; the heat is emissive on top, env gloss gives the depth
  heat: { color: '#05060c', roughness: 0.32, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 0.9 },
  // liquid metal: the stripe lives in the environment (see App), iridescence gives the spectral edge
  chrome: { color: '#ffffff', metalness: 1, roughness: 0.14, iridescence: 1, iridescenceIOR: 1.5, iridescenceThicknessRange: [180, 560], envMapIntensity: 1 },
  // polished stone: diffuse smoke inside, clearcoat + env on top
  smoke: { color: '#ffffff', roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.8 },
}

export type V2Material = THREE.MeshPhysicalMaterial & { u: Record<string, THREE.IUniform> }

export function makeV2(variant: Variant, p: Palette, half: number): V2Material {
  const m = new THREE.MeshPhysicalMaterial(BASE[variant]) as V2Material
  m.u = {
    uTime: { value: 0 },
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
        .replace('#include <common>', '#include <common>\nuniform mat3 uRot; uniform vec3 uPos; varying vec3 vRootP; varying vec3 vRootN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRootP = uRot * position + uPos; vRootN = uRot * normal;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${PARS}\n${inj.pars}`)
        .replace(inj.slot, inj.body)
    }
    m.customProgramCacheKey = () => `v2-${variant}`
  }
  return m
}
