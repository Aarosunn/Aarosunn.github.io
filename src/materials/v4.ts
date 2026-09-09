/**
 * v4: the three paper.design looks (Apache 2.0, github.com/paper-design/shaders) refined per Aaron's
 * notes, plus two fusions. All on MeshPhysicalMaterial. Animated fields live in current cube space
 * (`vCube`) so a turning slice moves through them with no pop; edge proximity uses the rest slot
 * (`vRest`), which is quarter-turn symmetric and therefore continuous too.
 *
 *  heat        deeper, redder, dimmer heatmap on a dark clearcoat body
 *  chrome      liquid metal via the graded env (App), softer roughness so PMREM banding cannot show
 *  smoke       v2's face-centred swirl, in cube space, at a third of the speed
 *  heatsmoke   dark glass, smoke veins glow through the heat gradient
 *  smokechrome liquid chrome marble: smoke veins darken the metal, rainbow film over everything
 */
import * as THREE from 'three'
import type { Palette, Shared } from './v3'

export type V4Variant = 'heat' | 'chrome' | 'smoke' | 'heatsmoke' | 'smokechrome'
export const V4_VARIANTS: V4Variant[] = ['heat', 'chrome', 'smoke', 'heatsmoke', 'smokechrome']

const PARS = /* glsl */ `
  uniform float uTime; uniform float uHalf; uniform vec3 uA; uniform vec3 uB; uniform vec3 uBg; uniform vec3 uBright;
  varying vec3 vRest; varying vec3 vCube; varying vec3 vCubeN;
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
  float edgeProx() {
    vec3 a = abs(vRest);
    float hi = max(a.x, max(a.y, a.z));
    float mid = a.x + a.y + a.z - hi - min(a.x, min(a.y, a.z));
    return sst(uHalf - 0.22, uHalf, mid);
  }
  vec2 faceUV() {
    vec3 n = abs(vCubeN);
    if (n.x > n.y && n.x > n.z) return vCube.zy;
    if (n.y > n.z) return vCube.xz;
    return vCube.xy;
  }
  float fres(vec3 n, float p) { return pow(1.0 - max(dot(normalize(n), normalize(vViewPosition)), 0.0), p); }
  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  vec3 lightest() { return lum(uBright) > lum(uBg) ? uBright : uBg; }

  // Paper gem-smoke swirl, face-centred (v2 look), evaluated in cube space at a third of v2's speed.
  // Returns 0 glass, ~1 dark ring, ~2 light core.
  float smokeMixer() {
    const float innerDistortion = 0.8, size = 0.8;
    float t = uTime * 0.33;
    float roundness = 1.0 - edgeProx();
    vec2 uv = faceUV() / (2.0 * uHalf) * mix(4.0, 1.0, size);
    uv.y += innerDistortion * (1.0 - sst(0.0, 1.0, length(0.4 * uv)));
    uv.y -= 0.4 * innerDistortion;
    float swirl = innerDistortion * roundness;
    for (int i = 1; i < 5; i++) {
      float fi = float(i);
      float stretch = max(length(dFdx(uv)), length(dFdy(uv)));
      float sw = swirl / (1.0 + stretch * 8.0);
      uv.x += sw / fi * cos(t + fi * 2.9 * uv.y);
      uv.y += sw / fi * cos(t + fi * 1.5 * uv.x);
    }
    return exp(-1.5 * dot(uv, uv)) * 2.0;
  }
`

// Deeper heat ramp: black navy -> blue -> teal -> green-yellow -> orange -> red -> deep red.
const HEAT_RAMP = /* glsl */ `
  vec3 heatRamp(float h) {
    vec3 c[10];
    c[0] = vec3(0.010, 0.012, 0.045); c[1] = vec3(0.045, 0.090, 0.340); c[2] = vec3(0.095, 0.190, 0.580);
    c[3] = vec3(0.130, 0.360, 0.860); c[4] = vec3(0.220, 0.740, 0.800); c[5] = vec3(0.520, 0.840, 0.440);
    c[6] = vec3(0.980, 0.860, 0.400); c[7] = vec3(0.980, 0.500, 0.080); c[8] = vec3(0.900, 0.160, 0.030);
    c[9] = vec3(0.560, 0.040, 0.020);
    float m = clamp(h, 0.0, 0.9999) * 9.0;
    int i = int(floor(m));
    return mix(c[i], c[i + 1], fract(m));
  }
`

const HEAT = /* glsl */ `
  ${HEAT_RAMP}
  vec3 heatColor(vec3 n) {
    float t = 0.08 * uTime;
    float edge = edgeProx();
    float f = fres(n, 2.5);
    float heat = 0.12 + 0.78 * edge + 0.16 * f;
    for (int k = 0; k < 3; k++) {
      float tk = fract(t + float(k) / 3.0);
      float cy = mix(-3.4, 3.8, tk);
      vec3 d = (vCube - vec3(0.0, cy, 0.0)) * vec3(0.55, 1.0, 0.55);
      float s = 1.0 - sst(0.7, 2.1, length(d));
      heat = mix(heat, 0.03, s * (1.0 - 0.75 * edge));
    }
    float y = fract((vCube.y + uHalf) / (2.0 * uHalf) - fract(t * 3.0 - 0.1));
    float band = sst(0.25, 0.6, y) * (1.0 - sst(0.6, 1.0, y));
    heat += 0.5 * band * (1.0 - 0.5 * edge);
    heat += 0.3 * (fbm(vCube * 1.1 + vec3(0.0, -uTime * 0.14, 0.0)) - 0.5) * (1.0 - edge);
    heat = clamp(heat, 0.0, 1.0);
    // dimmer overall; the rim sits in the red stops, only a touch over 1.0 for a soft halo
    return heatRamp(heat) * (0.28 + 0.55 * sst(0.62, 1.0, heat));
  }
`

const SMOKE = /* glsl */ `
  vec3 smokeColor() {
    float mixer = smokeMixer();
    float m1 = sst(0.0, 1.0, clamp(mixer, 0.0, 1.0));
    float m2 = sst(0.0, 1.0, clamp(mixer - 1.0, 0.0, 1.0));
    vec3 glass = mix(lightest(), uA, 0.06);
    vec3 dark = mix(vec3(0.24), uB, 0.35);
    vec3 light = mix(lightest(), uA, 0.12);
    return mix(glass, mix(dark, light, m2), m1);
  }
`

// Dark glass; the smoke ring glows through the heat ramp.
const HEATSMOKE = /* glsl */ `
  ${HEAT_RAMP}
  vec3 heatSmoke(vec3 n) {
    float mixer = smokeMixer();
    float ring = sst(0.0, 1.0, clamp(mixer, 0.0, 1.0)) * (1.0 - 0.85 * sst(0.0, 1.0, clamp(mixer - 1.0, 0.0, 1.0)));
    float edge = edgeProx();
    float f = fres(n, 2.5);
    float heat = 0.08 + 0.7 * ring + 0.35 * edge + 0.12 * f;
    heat += 0.18 * (fbm(vCube * 1.3 + vec3(0.0, -uTime * 0.1, 0.0)) - 0.5);
    heat = clamp(heat, 0.0, 1.0);
    return heatRamp(heat) * (0.22 + 0.6 * sst(0.6, 1.0, heat));
  }
`

// Metal whose colour is the smoke: bright silver where the glass would be, dark oil in the veins.
const SMOKECHROME = /* glsl */ `
  vec3 smokeChrome() {
    float mixer = smokeMixer();
    float m1 = sst(0.0, 1.0, clamp(mixer, 0.0, 1.0));
    float m2 = sst(0.0, 1.0, clamp(mixer - 1.0, 0.0, 1.0));
    vec3 silver = mix(vec3(0.98, 0.98, 1.0), uA, 0.04);
    vec3 oil = mix(vec3(0.13, 0.13, 0.16), uB, 0.12);
    vec3 core = mix(vec3(0.86, 0.86, 0.9), uA, 0.1);
    return mix(silver, mix(oil, core, m2), m1);
  }
`

type Inject = { pars: string; slot: string; body: string }

const INJECT: Partial<Record<V4Variant, Inject>> = {
  heat: { pars: HEAT, slot: '#include <emissivemap_fragment>', body: 'totalEmissiveRadiance = heatColor(normal);' },
  smoke: { pars: SMOKE, slot: '#include <color_fragment>', body: 'diffuseColor.rgb = smokeColor();' },
  heatsmoke: { pars: HEATSMOKE, slot: '#include <emissivemap_fragment>', body: 'totalEmissiveRadiance = heatSmoke(normal);' },
  smokechrome: { pars: SMOKECHROME, slot: '#include <color_fragment>', body: 'diffuseColor.rgb = smokeChrome();' },
}

const BASE: Record<V4Variant, THREE.MeshPhysicalMaterialParameters> = {
  heat: { color: '#020308', roughness: 0.3, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.45 },
  chrome: {
    color: '#eef0f5',
    metalness: 1,
    roughness: 0.1,
    iridescence: 1,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [100, 700],
    envMapIntensity: 1.15,
  },
  smoke: { color: '#ffffff', roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.8 },
  heatsmoke: { color: '#03040a', roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.5 },
  smokechrome: {
    color: '#ffffff',
    metalness: 1,
    roughness: 0.14,
    iridescence: 1,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [100, 700],
    envMapIntensity: 1.15,
  },
}

export type V4Material = THREE.MeshPhysicalMaterial & { u: Record<string, THREE.IUniform> }

export function makeV4(variant: V4Variant, p: Palette, half: number, shared: Shared): V4Material {
  const m = new THREE.MeshPhysicalMaterial(BASE[variant]) as V4Material
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
          '#include <common>\nuniform mat3 uRot; uniform vec3 uPos; uniform mat4 uRootInv; varying vec3 vRest; varying vec3 vCube; varying vec3 vCubeN;',
        )
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvRest = uRot * position + uPos;\nvCube = (uRootInv * modelMatrix * vec4(position, 1.0)).xyz;\nvCubeN = normalize(mat3(uRootInv) * mat3(modelMatrix) * normal);',
        )
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${PARS}\n${inj.pars}`)
        .replace(inj.slot, inj.body)
    }
    m.customProgramCacheKey = () => `v4-${variant}`
  }
  return m
}
