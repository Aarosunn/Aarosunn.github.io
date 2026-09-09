/**
 * paper.design's heatmap / liquid metal / gem smoke (Apache 2.0) on the Rubik's cube.
 * Each is a 2D effect over a preprocessed mask image; the preprocess runs on the GPU every frame from a
 * render of the cube, and their fragment shader runs verbatim over the screen. Versions in paperVersions.ts.
 *
 * Mask channels written by the cubie faces:
 *   heat:          R = luminance (0 face / 1 seam and outside), G = lambert shade, B = 1 inside
 *   liquid, smoke: R = Poisson-like field (1 boundary -> 0 deep inside), G = 1 inside (0 on seams), B = lambert
 * Their preprocess then: heat = three box blurs (contour / inner / big); liquid + smoke = a plate per face or
 * their real Poisson field solved here. The final pass gets the raw mask too, for silhouette clip and shading.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { gemSmokeFragmentShader, getShaderColorFromString, heatmapFragmentShader, liquidMetalFragmentShader } from '@paper-design/shaders'
import { RubikMask, type RubikHandle } from './RubikMask'
import type { PaperShader, PaperVersion } from './paperVersions'
import { presetNamed } from './paperPresets'

export type PaperDebug = 'off' | 'mask' | 'combined'

const IMG = 1000 / 1750 // heat: image fraction of paper's padded canvas

const QUAD_VERT = /* glsl */ `
  in vec3 position; in vec2 uv; out vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`
// separable box blur of one channel; one pass = one direction
const BLUR = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D t; uniform vec2 dir; uniform int radius; uniform vec4 ch;
  void main() {
    float s = 0.0;
    for (int i = -96; i <= 96; i++) {
      if (i < -radius || i > radius) continue;
      s += dot(texture(t, vUv + dir * float(i)), ch);
    }
    o = vec4(vec3(s / float(2 * radius + 1)), 1.0);
  }
`
// heat: paper's processed image = (contour, big, inner); flipped to their y-down convention
const COMBINE_HEAT = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D contour; uniform sampler2D big; uniform sampler2D inner;
  void main() {
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
    o = vec4(texture(contour, uv).r, texture(big, uv).r, texture(inner, uv).r, 1.0);
  }
`
// liquid / smoke plates: (field, alpha, 1, 1), flipped
const COMBINE_FIELD = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D mask;
  void main() {
    vec4 m = texture(mask, vec2(vUv.x, 1.0 - vUv.y));
    o = vec4(m.r, m.g, 1.0, 1.0);
  }
`
// min-filtered downsample of the alpha (G): a hairline seam stays a hole in the coarse Poisson grid
const DOWNMIN = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D t; uniform float texel; uniform float taps;
  void main() {
    float m = 1.0;
    float n = taps;
    for (float y = 0.0; y < 8.0; y++) {
      if (y >= n) break;
      for (float x = 0.0; x < 8.0; x++) {
        if (x >= n) break;
        vec2 off = (vec2(x, y) - 0.5 * (n - 1.0)) * texel;
        m = min(m, texture(t, vUv + off).g);
      }
    }
    o = vec4(vec3(m), 1.0);
  }
`
// poisson: field = 1 - u / max(u), like their toProcessed*
const COMBINE_POISSON = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D mask; uniform sampler2D u; uniform sampler2D umax;
  void main() {
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
    vec4 m = texture(mask, uv);
    float mx = max(texture(umax, vec2(0.5)).r, 1e-5);
    float f = mix(1.0, 1.0 - clamp(texture(u, uv).r / mx, 0.0, 1.0), m.g);
    o = vec4(f, m.g, 1.0, 1.0);
  }
`
// Jacobi step for  ∇²u = -1  inside the shape (mask G > .5), u = 0 outside. Their preprocess, on the GPU.
const POISSON = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D u; uniform sampler2D mask; uniform float texel;
  void main() {
    float inside = step(0.5, texture(mask, vUv).g);
    float s = texture(u, vUv + vec2(texel, 0.0)).r + texture(u, vUv - vec2(texel, 0.0)).r
            + texture(u, vUv + vec2(0.0, texel)).r + texture(u, vUv - vec2(0.0, texel)).r;
    o = vec4(vec3(inside * 0.25 * (s + 1.0)), 1.0);
  }
`
// running max of u: halve the texture, sampling the 2x2 block centres
const REDUCE_MAX = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D t; uniform float texel;
  void main() {
    float m = texture(t, vUv + vec2(-texel, -texel)).r;
    m = max(m, texture(t, vUv + vec2(texel, -texel)).r);
    m = max(m, texture(t, vUv + vec2(-texel, texel)).r);
    m = max(m, texture(t, vUv + vec2(texel, texel)).r);
    o = vec4(vec3(m), 1.0);
  }
`
// fusion: heat (a) over the fused shader (b) by heat's alpha (halo + seam rim)
const COMPOSITE = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o; uniform sampler2D a; uniform sampler2D b;
  void main() { vec4 h = texture(a, vUv); o = vec4(mix(texture(b, vUv).rgb, h.rgb, h.a), 1.0); }
`
const COPY = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o; uniform sampler2D t;
  void main() { o = vec4(texture(t, vUv).rgb, 1.0); }
`
// cubie faces
const FACE_VERT = /* glsl */ `
  in vec3 position; in vec3 normal; in vec2 uv; out vec3 vN; out vec2 vUv; out vec3 vLocal; out vec3 vLocalN; out vec3 vCube; out vec3 vCubeN; out vec3 vShift; out vec3 vCap;
  uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform mat3 normalMatrix; uniform mat4 modelMatrix; uniform mat4 uRootInv;
  void main() {
    vN = normalMatrix * normal; vUv = uv; vLocal = position; vLocalN = normal;
    mat4 toCube = uRootInv * modelMatrix;
    vCube = (toCube * vec4(position, 1.0)).xyz;
    // the v11 mapping's cube-space constants brought into this cubie's own frame (rotation only, no scale):
    // the +0.07 plate shift along cube +x+y+z, and the cube z axis (the extrusion's cap axis)
    mat3 R = mat3(toCube);
    vShift = transpose(R) * vec3(0.07);
    vCap = transpose(R) * vec3(0.0, 0.0, 1.0);
    vCubeN = mat3(toCube) * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const FACE_FRAG = /* glsl */ `
  precision highp float;
  in vec3 vN; in vec2 vUv; in vec3 vLocal; in vec3 vLocalN; in vec3 vCube; in vec3 vCubeN; in vec3 vShift; in vec3 vCap; out vec4 o;
  uniform float mode;   // 0 heat, 2 plate per cubie face, 3 plate per whole cube face (cube space)
  uniform float k;      // plate sharpness
  uniform float uHalf;  // cube half extent in cube space (mode 3)
  uniform float uSeam;  // hairline along each cubie face border, in cubie units (cubie = 1)
  uniform float uCapCos; // mode 2: a fragment counts as a cap (z face) only if |n.z| exceeds this, like the extrusion's cap / side-wall split
  uniform float uSeamUv; // 0: from local geometry (true edges); 1: from the geometry's uv (v1-v11 look; drifts on rounded cubies after turns);
                         // 2: the v11 mapping (extrude uv = coordinate + 0.43: one-sided seams, plate centre at +0.07) rebuilt in cube-space axes
                         //    around each cubie's centre, so it matches v11 at rest and stays consistent through turns
  float plate(vec2 p) { float b = (1.0 - p.x * p.x) * (1.0 - p.y * p.y); return 1.0 - pow(clamp(b, 0.0, 1.0), k); }
  // the two coordinates across the face this fragment lies on (dominant local normal axis), -.5..+.5
  vec2 across(vec3 pos, vec3 n) { vec3 a = abs(n); return a.x > a.y && a.x > a.z ? pos.yz : a.y > a.z ? pos.xz : pos.xy; }
  // the extrusion's rule in the cubie's own frame: the face is the cap axis (cube z, carried in as vCap) when the
  // normal sits on it beyond capCos, else the dominant of the other two; return the two coordinates across it
  vec2 acrossRigid(vec3 pos, vec3 n, vec3 cap) {
    vec3 a = abs(normalize(n));
    vec3 c = abs(cap);
    float onCap = step(uCapCos, dot(a, c));
    vec3 w = mix(a * (1.0 - c), c, onCap);
    return w.x >= w.y && w.x >= w.z ? pos.yz : w.y >= w.z ? pos.xz : pos.xy;
  }
  void main() {
    float l = 0.35 + 0.65 * max(dot(normalize(vN), normalize(vec3(0.35, 0.8, 0.6))), 0.0);
    // face coordinates -.5..+.5
    vec2 f = uSeamUv > 1.5 ? acrossRigid(vLocal - vShift, vLocalN, vCap) : uSeamUv > 0.5 ? vUv - 0.5 : across(vLocal, vLocalN);
    float e = 0.5 - max(abs(f.x), abs(f.y));
    float seam = uSeam > 0.0 ? 1.0 - smoothstep(uSeam * 0.6, uSeam, e) : 0.0;
    if (mode < 1.0) {
      o = vec4(seam, l, 1.0, 1.0);
    } else if (mode < 2.5) {
      // seams become holes in the alpha, so a Poisson field sees every cubie face as its own shape
      o = vec4(plate(2.0 * f), 1.0 - seam, l, 1.0);
    } else {
      // the whole cube face this fragment lies on, in cube space: coords perpendicular to the dominant normal axis
      vec3 n = abs(normalize(vCubeN));
      vec3 c = vCube / uHalf;
      vec2 p = n.x > n.y && n.x > n.z ? c.yz : n.y > n.z ? c.xz : c.xy;
      o = vec4(plate(clamp(p, -1.0, 1.0)), 1.0, l, 1.0);
    }
  }
`
// paper's vertex semantics for fit = contain, square image, no rotation / offset
const FINAL_VERT = /* glsl */ `
  in vec3 position; in vec2 uv;
  uniform float u_aspect; uniform float u_scale;
  out vec2 v_imageUV; out vec2 v_objectUV; out vec2 v_responsiveUV; out vec2 v_responsiveBoxGivenSize;
  void main() {
    vec2 p = uv - 0.5;
    vec2 q = p * vec2(u_aspect, 1.0) / u_scale;
    v_objectUV = q;
    v_imageUV = vec2(q.x + 0.5, 0.5 - q.y);
    v_responsiveUV = p / u_scale;
    v_responsiveBoxGivenSize = vec2(u_aspect, 1.0) * 1000.0;
    gl_Position = vec4(position, 1.0);
  }
`

const FRAG: Record<PaperShader, string> = { heat: heatmapFragmentShader, liquid: liquidMetalFragmentShader, smoke: gemSmokeFragmentShader }

/** their fragment verbatim, plus: raw mask uniform, silhouette clip, lambert shade multiply, fusion alpha */
function finalFragment(shader: PaperShader) {
  const src = FRAG[shader].replace('#version 300 es', '').replace(/precision mediump float;/, 'precision highp float;')
  const tail = `
  {
    vec2 mUV = v_imageUV;
    ${shader === 'heat' ? 'mUV = (mUV - 0.5) * 0.5714285714285714 + 0.5;' : ''}
    vec4 m = texture(u_mask, vec2(mUV.x, 1.0 - mUV.y));
    float inFrame = step(0.0, mUV.x) * step(mUV.x, 1.0) * step(0.0, mUV.y) * step(mUV.y, 1.0);
    float inside = ${shader === 'heat' ? 'm.b' : 'm.g'} * inFrame;
    float shade = ${shader === 'heat' ? 'm.g' : 'm.b'};
    fragColor = mix(u_colorBack, fragColor, max(inside, u_halo));
    fragColor.rgb *= mix(1.0, shade, u_shade * inside);
    ${shader === 'heat' ? '' : `
    // colour ramp: the effect's luminance through a palette (heatmap / icemint), with optional static grain
    float grainN = u_grain * 0.35 * (fract(sin(dot(v_imageUV * 1000.0, vec2(12.9898, 78.233))) * 43758.5453123) - 0.5);
    if (u_rampCount < 0.5) fragColor.rgb *= mix(1.0, 1.0 + grainN, inside);
    if (u_rampCount > 0.5) {
      float l = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
      l += grainN;
      l = pow(clamp(l, 0.0, 1.0), abs(u_rampGamma));
      if (u_rampGamma < 0.0) l = 1.0 - l;
      l = mix(u_rampFloor, 1.0, l); // floor: the darkest chrome still lands on a visible stop, not the page colour
      float mixer = l * u_rampCount;
      vec4 g = u_ramp[0];
      for (int i = 1; i < 11; i++) {
        if (i > int(u_rampCount)) break;
        g = mix(g, u_ramp[i - 1], clamp(mixer - float(i - 1), 0.0, 1.0));
      }
      fragColor.rgb = mix(fragColor.rgb, g.rgb, inside);
    }`}
    // look controls, cube body only: brightness scales it, opacity fades it toward the page
    fragColor.rgb = mix(fragColor.rgb, fragColor.rgb * u_gain, inside);
    fragColor.rgb = mix(u_colorBack.rgb, fragColor.rgb, mix(1.0, u_alpha, inside));
    // outline behind the silhouette: 1 = a line of constant width, 2 = a soft glow; drawn where the pixel is
    // outside the cube but within reach of it (mask B = lambert > 0 inside, seams included, 0 outside)
    if (u_outline > 0.5) {
      float sil = step(0.01, m.b) * inFrame;
      float near = 0.0;
      for (int i = 0; i < 16; i++) {
        float a = float(i) * 0.392699;
        vec2 dir = vec2(cos(a), sin(a));
        float n1 = step(0.01, texture(u_mask, vec2(mUV.x, 1.0 - mUV.y) + dir * u_outlineW).b);
        float n2 = step(0.01, texture(u_mask, vec2(mUV.x, 1.0 - mUV.y) + dir * u_outlineW * 2.2).b);
        float n3 = step(0.01, texture(u_mask, vec2(mUV.x, 1.0 - mUV.y) + dir * u_outlineW * 3.6).b);
        near = max(near, u_outline > 1.5 ? max(n1, max(n2 * 0.55, n3 * 0.25)) : n1);
      }
      float ring = (1.0 - sil) * near;
      fragColor.rgb = mix(fragColor.rgb, u_outlineColor, ring);
    }
    ${shader === 'heat' ? 'fragColor.a = mix(fragColor.a, max(1.0 - inside, smoothstep(0.0, 0.35, img.r)), u_fuse);' : ''}
  }`
  const marker = 'fragColor = vec4(color, opacity);'
  const i = src.lastIndexOf(marker)
  const body = src.slice(0, i + marker.length) + tail + src.slice(i + marker.length)
  return body.replace('uniform float u_time;', 'uniform float u_time; uniform sampler2D u_mask; uniform float u_halo; uniform float u_shade; uniform float u_fuse; uniform float u_gain; uniform float u_alpha; uniform vec4 u_ramp[10]; uniform float u_rampCount; uniform float u_rampGamma; uniform float u_rampFloor; uniform float u_grain; uniform float u_outline; uniform float u_outlineW; uniform vec3 u_outlineColor;')
}

const rt = (size: number, depth = false, samples = 0) =>
  new THREE.WebGLRenderTarget(size, size, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: depth, samples })
const frt = (size: number) =>
  new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false })
const rt2 = (w: number, h: number) => new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false })

/** the superset of paper uniforms for one final pass (unused ones are harmless) */
const finalUniforms = (): Record<string, THREE.IUniform> => ({
  u_image: { value: null },
  u_mask: { value: null },
  u_time: { value: 0 },
  u_resolution: { value: new THREE.Vector2(1, 1) },
  u_imageAspectRatio: { value: 1 },
  u_isImage: { value: true },
  u_shape: { value: 0 },
  u_halo: { value: 1 },
  u_shade: { value: 0 },
  u_fuse: { value: 0 },
  u_gain: { value: 1 },
  u_alpha: { value: 1 },
  u_ramp: { value: new Float32Array(40) },
  u_rampCount: { value: 0 },
  u_rampGamma: { value: 1 },
  u_rampFloor: { value: 0 },
  u_outline: { value: 0 },
  u_outlineW: { value: 0.008 },
  u_outlineColor: { value: new THREE.Vector3(1, 1, 1) },
  u_grain: { value: 0 },
  u_aspect: { value: 1 },
  u_scale: { value: 1 },
  u_colorBack: { value: [0, 0, 0, 1] },
  u_colorTint: { value: [1, 1, 1, 1] },
  u_colorInner: { value: [1, 1, 1, 1] },
  u_colors: { value: new Float32Array(40) },
  u_colorsCount: { value: 0 },
  u_angle: { value: 0 },
  u_noise: { value: 0 },
  u_innerGlow: { value: 0.5 },
  u_outerGlow: { value: 0.5 },
  u_contour: { value: 0.5 },
  u_softness: { value: 0.1 },
  u_repetition: { value: 2 },
  u_shiftRed: { value: 0.3 },
  u_shiftBlue: { value: 0.3 },
  u_distortion: { value: 0.07 },
  u_innerDistortion: { value: 0.8 },
  u_outerDistortion: { value: 0.6 },
  u_offset: { value: 0 },
  u_size: { value: 0.8 },
})
const NUMERIC = ['angle', 'noise', 'innerGlow', 'outerGlow', 'contour', 'softness', 'repetition', 'shiftRed', 'shiftBlue', 'distortion', 'innerDistortion', 'outerDistortion', 'offset', 'size']
const applyParams = (u: Record<string, THREE.IUniform>, params: Record<string, unknown>) => {
  const color = (v: unknown, fallback: string) => getShaderColorFromString(typeof v === 'string' ? v : fallback)
  if (Array.isArray(params.colors)) {
    const flat = new Float32Array(40)
    const cs = (params.colors as string[]).map(getShaderColorFromString)
    cs.forEach((c, i) => flat.set(c, i * 4))
    u.u_colors.value = flat
    u.u_colorsCount.value = cs.length
  }
  u.u_colorBack.value = color(params.colorBack, '#000000')
  u.u_colorTint.value = color(params.colorTint, '#ffffff')
  u.u_colorInner.value = color(params.colorInner, '#ffffff')
  for (const k of NUMERIC) if (typeof params[k] === 'number') u[`u_${k}`].value = params[k]
  u.u_scale.value = typeof params.scale === 'number' ? params.scale : 1
  // ours: a palette over the effect's luminance
  const ramp = new Float32Array(40)
  const stops = Array.isArray(params.ramp) ? (params.ramp as string[]).map(getShaderColorFromString) : []
  stops.forEach((c, i) => ramp.set(c, i * 4))
  u.u_ramp.value = ramp
  u.u_rampCount.value = stops.length
  u.u_rampGamma.value = typeof params.rampGamma === 'number' ? params.rampGamma : 1
  u.u_rampFloor.value = typeof params.rampFloor === 'number' ? params.rampFloor : 0
  u.u_grain.value = typeof params.grain === 'number' ? params.grain : 0
}

export type PaperCubeProps = {
  version: PaperVersion
  params: Record<string, unknown>
  spin: boolean
  /** idle spin, rad/s */
  spinSpeed?: number
  /** chain random turns, with this pause between them (ms) */
  auto?: boolean
  autoInterval?: number
  debug?: PaperDebug
  /** look controls: brightness multiplier and cube-body opacity */
  gain?: number
  alpha?: number
  /** outline behind the silhouette: 'line' (constant width) or 'glow' (soft), in this colour */
  outline?: 'off' | 'line' | 'glow'
  outlineColor?: string
  rubik?: React.RefObject<RubikHandle | null>
}

export function PaperCube({ version: V, params, spin, spinSpeed = 0.35, auto = false, autoInterval = 900, debug = 'off', gain = 1, alpha = 1, outline = 'off', outlineColor = '#ffffff', rubik }: PaperCubeProps) {
  const SIZE = V.size
  const isHeat = V.shader === 'heat'
  const fieldMode = V.field === 'cube' ? 3 : 2
  const root = useRef<THREE.Group>(null!)
  const maskScene = useRef<THREE.Scene>(null!)
  const { gl, camera, size } = useThree()

  const R = useMemo(
    () => ({
      mask: rt(SIZE, true, 4),
      a: rt(SIZE),
      contour: rt(SIZE),
      inner: rt(SIZE),
      bigA: rt(SIZE / V.bigDiv),
      bigB: rt(SIZE / V.bigDiv),
      big: rt(SIZE / V.bigDiv),
      combined: rt(SIZE),
      // poisson: solved at 256 with float targets; max reduced by halving eight times
      pA: frt(256),
      pB: frt(256),
      pMask: rt(256),
      red: [128, 64, 32, 16, 8, 4, 2, 1].map(frt),
    }),
    [SIZE, V.bigDiv],
  )
  // fusion needs a second mask and two screen-size outputs
  const dpr = gl.getPixelRatio()
  const F = useMemo(
    () =>
      V.fuse
        ? { mask2: rt(SIZE, true, 4), combined2: rt(SIZE), out1: rt2(Math.round(size.width * dpr), Math.round(size.height * dpr)), out2: rt2(Math.round(size.width * dpr), Math.round(size.height * dpr)) }
        : null,
    [V.fuse, SIZE, size.width, size.height, dpr],
  )
  useEffect(() => () => { if (F) Object.values(F).forEach((t) => t.dispose()) }, [F])
  const Q = useMemo(() => {
    const scene = new THREE.Scene()
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    scene.add(mesh)
    const raw = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, vertexShader = QUAD_VERT) =>
      new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader, fragmentShader, uniforms })
    return {
      scene,
      cam,
      mesh,
      blur: raw(BLUR, { t: { value: null }, dir: { value: new THREE.Vector2() }, radius: { value: 1 }, ch: { value: new THREE.Vector4(1, 0, 0, 0) } }),
      combineHeat: raw(COMBINE_HEAT, { contour: { value: null }, big: { value: null }, inner: { value: null } }),
      combineField: raw(COMBINE_FIELD, { mask: { value: null } }),
      combinePoisson: raw(COMBINE_POISSON, { mask: { value: null }, u: { value: null }, umax: { value: null } }),
      poisson: raw(POISSON, { u: { value: null }, mask: { value: null }, texel: { value: 1 / 256 } }),
      reduceMax: raw(REDUCE_MAX, { t: { value: null }, texel: { value: 1 / 128 } }),
      downMin: raw(DOWNMIN, { t: { value: null }, texel: { value: 1 / 1024 }, taps: { value: 4 } }),
      copy: raw(COPY, { t: { value: null } }),
      face: raw(FACE_FRAG, { mode: { value: 0 }, k: { value: 0.75 }, uHalf: { value: 1.5 }, uSeam: { value: 0 }, uSeamUv: { value: 1 }, uCapCos: { value: 0.999 }, uRootInv: { value: new THREE.Matrix4() } }, FACE_VERT),
      final: raw(finalFragment(V.shader), finalUniforms(), FINAL_VERT),
      final2: V.fuse ? raw(finalFragment(V.fuse), finalUniforms(), FINAL_VERT) : null,
      composite: raw(COMPOSITE, { a: { value: null }, b: { value: null } }),
    }
  }, [V.shader, V.fuse])

  useEffect(
    () => () => {
      Object.values(R).forEach((t) => (Array.isArray(t) ? t.forEach((x) => x.dispose()) : t.dispose()))
      Q.mesh.geometry.dispose()
      ;[Q.blur, Q.combineHeat, Q.combineField, Q.combinePoisson, Q.poisson, Q.reduceMax, Q.downMin, Q.copy, Q.face, Q.final, Q.final2, Q.composite].forEach((m) => m?.dispose())
    },
    [R, Q],
  )

  // preset params -> uniforms
  useEffect(() => {
    const u = Q.final.uniforms
    applyParams(u, params)
    u.u_halo.value = V.halo ? 1 : 0
    u.u_shade.value = V.shade
    u.u_fuse.value = V.fuse ? 1 : 0
    u.u_gain.value = gain
    u.u_alpha.value = alpha
    u.u_outline.value = outline === 'line' ? 1 : outline === 'glow' ? 2 : 0
    u.u_outlineW.value = V.shader === 'heat' ? 0.0045 : 0.008 // heat samples the mask through its 57% window
    u.u_outlineColor.value.set(...new THREE.Color(outlineColor).toArray())
    if (Q.final2 && V.fuse) {
      const u2 = Q.final2.uniforms
      applyParams(u2, presetNamed(V.fuse, V.fusePreset).params)
      // same camera and mask as the heat pass: heat shows the mask's central 57% window through its scale,
      // so the full mask spans scale / 0.571 of the screen for the fused pass
      u2.u_scale.value = (typeof params.scale === 'number' ? params.scale : 0.75) / IMG
      u2.u_halo.value = 0
      u2.u_shade.value = V.shade
      u2.u_gain.value = gain
      u2.u_alpha.value = alpha
    }
    Q.face.uniforms.k.value = V.fieldK
    Q.face.uniforms.uHalf.value = 1.5 * V.rubikGap
    Q.face.uniforms.uSeam.value = V.seam
    Q.face.uniforms.uSeamUv.value = V.seamSpace === 'geometry' ? 0 : V.seamSpace === 'cube' ? 2 : 1
    Q.face.uniforms.uCapCos.value = V.capCos
  }, [params, Q, V, gain, alpha, outline, outlineColor])

  const pass = (mat: THREE.RawShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
    Q.mesh.material = mat
    gl.setRenderTarget(target)
    gl.render(Q.scene, Q.cam)
  }
  const boxBlur = (src: THREE.WebGLRenderTarget, tmp: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget, radius: number, passes: number) => {
    const texel = 1 / src.width
    let input = src
    for (let p = 0; p < passes; p++) {
      Q.blur.uniforms.radius.value = radius
      Q.blur.uniforms.t.value = input.texture
      Q.blur.uniforms.dir.value.set(texel, 0)
      pass(Q.blur, tmp)
      Q.blur.uniforms.t.value = tmp.texture
      Q.blur.uniforms.dir.value.set(0, texel)
      pass(Q.blur, dst)
      input = dst
    }
  }
  // one bilinear tap per destination texel (radius 0)
  const downsample = (src: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget) => {
    Q.blur.uniforms.radius.value = 0
    Q.blur.uniforms.t.value = src.texture
    Q.blur.uniforms.dir.value.set(0, 0)
    pass(Q.blur, dst)
  }
  // square render of the cube into a mask target: clear = (1, 0, 0) = seam / outside, no alpha, no shade
  const renderMask = (target: THREE.WebGLRenderTarget, mode: number) => {
    const cam = camera as THREE.PerspectiveCamera
    const aspect = cam.aspect
    cam.aspect = 1
    cam.updateProjectionMatrix()
    const prevClear = gl.getClearColor(new THREE.Color())
    const prevAlpha = gl.getClearAlpha()
    Q.face.uniforms.mode.value = mode
    gl.setClearColor(new THREE.Color(1, 0, 0), 1)
    gl.setRenderTarget(target)
    gl.clear()
    gl.render(maskScene.current, cam)
    gl.setClearColor(prevClear, prevAlpha)
    cam.aspect = aspect
    cam.updateProjectionMatrix()
  }

  useFrame((state, dt) => {
    if (spin) root.current.rotation.y += dt * spinSpeed
    root.current.updateMatrixWorld()
    Q.face.uniforms.uRootInv.value.copy(root.current.matrixWorld).invert()
    const speed = typeof params.speed === 'number' ? (params.speed as number) : 1
    const frame = typeof params.frame === 'number' ? (params.frame as number) : 0 // paper's time offset (seconds)
    const px = (r: number, w: number) => Math.max(1, Math.round((r / 1750) * w))

    // 1. mask, 2. their preprocess
    renderMask(R.mask, isHeat ? 0 : fieldMode)
    if (isHeat) {
      boxBlur(R.mask, R.a, R.contour, px(V.blur.contour, SIZE), 1)
      boxBlur(R.mask, R.a, R.inner, px(V.blur.inner, SIZE), 3)
      downsample(R.mask, R.bigA)
      boxBlur(R.bigA, R.bigB, R.big, px(V.blur.big, SIZE / V.bigDiv), 3)
      Q.combineHeat.uniforms.contour.value = R.contour.texture
      Q.combineHeat.uniforms.big.value = R.big.texture
      Q.combineHeat.uniforms.inner.value = R.inner.texture
      pass(Q.combineHeat, R.combined)
    } else if (V.field === 'poisson') {
      // bring the alpha to 256 for the solver, then iterate Jacobi (warm-started from last frame), reduce the
      // max, normalise. 'min' keeps a hairline seam as a hole; 'blur' (box filter + bilinear, the v1-v11 look)
      // lets thin seams close so neighbouring cubies share a field. Both write to rgb, so .g works.
      if (V.poissonDown === 'min') {
        Q.downMin.uniforms.t.value = R.mask.texture
        Q.downMin.uniforms.texel.value = 1 / SIZE
        Q.downMin.uniforms.taps.value = SIZE / 256
        pass(Q.downMin, R.pMask)
      } else {
        Q.blur.uniforms.ch.value.set(0, 1, 0, 0)
        boxBlur(R.mask, R.a, R.inner, Math.max(1, Math.round(SIZE / 512)), 1)
        Q.blur.uniforms.ch.value.set(1, 0, 0, 0)
        downsample(R.inner, R.pMask)
      }
      Q.poisson.uniforms.mask.value = R.pMask.texture
      let a = R.pA, b = R.pB
      for (let i = 0; i < V.poissonIters; i++) {
        Q.poisson.uniforms.u.value = a.texture
        pass(Q.poisson, b)
        ;[a, b] = [b, a]
      }
      let src: THREE.WebGLRenderTarget = a
      for (const dst of R.red) {
        Q.reduceMax.uniforms.t.value = src.texture
        Q.reduceMax.uniforms.texel.value = 0.25 / dst.width // ± half a source texel around the destination centre
        pass(Q.reduceMax, dst)
        src = dst
      }
      Q.combinePoisson.uniforms.mask.value = R.mask.texture
      Q.combinePoisson.uniforms.u.value = a.texture
      Q.combinePoisson.uniforms.umax.value = R.red[R.red.length - 1].texture
      pass(Q.combinePoisson, R.combined)
    } else {
      Q.combineField.uniforms.mask.value = R.mask.texture
      pass(Q.combineField, R.combined)
    }

    if (debug !== 'off') {
      Q.copy.uniforms.t.value = (debug === 'mask' ? R.mask : R.combined).texture
      pass(Q.copy, null)
      return
    }

    // 3. their fragment over the screen
    const u = Q.final.uniforms
    u.u_image.value = R.combined.texture
    u.u_mask.value = R.mask.texture
    u.u_time.value = state.clock.elapsedTime * speed + frame
    u.u_aspect.value = size.width / size.height
    u.u_resolution.value.set(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio())
    if (!(V.fuse && F && Q.final2)) {
      pass(Q.final, null)
      return
    }
    // fusion: heat -> out1; second mask with per-face plates and seams as holes -> fused shader -> out2; composite
    pass(Q.final, F.out1)
    renderMask(F.mask2, fieldMode)
    Q.combineField.uniforms.mask.value = F.mask2.texture
    pass(Q.combineField, F.combined2)
    const u2 = Q.final2.uniforms
    u2.u_image.value = F.combined2.texture
    u2.u_mask.value = F.mask2.texture
    u2.u_time.value = state.clock.elapsedTime * speed + frame
    u2.u_aspect.value = size.width / size.height
    u2.u_resolution.value.copy(u.u_resolution.value)
    pass(Q.final2, F.out2)
    Q.composite.uniforms.a.value = F.out1.texture
    Q.composite.uniforms.b.value = F.out2.texture
    pass(Q.composite, null)
  }, 1)

  return (
    <>
      <OrbitControls enablePan={false} enableZoom={false} />
      {/* the mask scene: never rendered by R3F, only by the manual passes above */}
      <scene ref={maskScene}>
        <group ref={root} rotation={[0.5, -0.7, 0]}>
          <RubikMask ref={rubik} gap={V.rubikGap} rounded={V.rubikRound} material={Q.face} auto={auto} autoInterval={autoInterval} />
        </group>
      </scene>
    </>
  )
}
