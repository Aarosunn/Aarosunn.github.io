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
import { useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { gemSmokeFragmentShader, getShaderColorFromString, heatmapFragmentShader, liquidMetalFragmentShader } from '@paper-design/shaders'
import { RubikMask, type RubikHandle } from './RubikMask'
import type { AsciiParams, PaperShader, PaperVersion } from './paperVersions'
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
// occlusion edges: where a nearer cubie overlaps a farther one there is no painted seam, so cut one from the depth
// stored in the mask alpha (both sides must be inside the cube; the silhouette is left alone)
const EDGE = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D t; uniform float texel;
  void main() {
    vec4 m = texture(t, vUv);
    float edge = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      vec4 n = texture(t, vUv + vec2(cos(a), sin(a)) * texel * 2.0);
      edge = max(edge, step(0.012, abs(n.a - m.a)) * step(0.01, n.b) * step(0.01, m.b));
    }
    o = vec4(m.r, m.g * (1.0 - edge), m.b, m.a);
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
  uniform sampler2D u; uniform sampler2D mask; uniform sampler2D ids; uniform float texel; uniform float thresh;
  // a neighbour that belongs to another cubie (id in the full-res mask R) is a wall (u = 0 there)
  float nb(vec2 p, float id) {
    float same = step(abs(texture(ids, p).r - id), 0.012);
    return texture(u, p).r * same;
  }
  void main() {
    float inside = step(thresh, texture(mask, vUv).g);
    float id = texture(ids, vUv).r;
    float s = nb(vUv + vec2(texel, 0.0), id) + nb(vUv - vec2(texel, 0.0), id) + nb(vUv + vec2(0.0, texel), id) + nb(vUv - vec2(0.0, texel), id);
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
  in vec3 position; in vec3 normal; in vec2 uv; out vec3 vN; out vec2 vUv; out vec3 vLocal; out vec3 vLocalN; out vec3 vCube; out vec3 vCubeN; out vec3 vShift; out vec3 vCap; out float vViewZ;
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
  in vec3 vN; in vec2 vUv; in vec3 vLocal; in vec3 vLocalN; in vec3 vCube; in vec3 vCubeN; in vec3 vShift; in vec3 vCap; in float vViewZ; out vec4 o;
  uniform float uCamZ;    // alpha = view depth relative to the camera distance, over 6 units (occlusion edges)
  uniform float mode;   // 0 heat, 2 plate per cubie face, 3 plate per whole cube face (cube space)
  uniform float k;      // plate sharpness
  uniform float uHalf;  // cube half extent in cube space (mode 3)
  uniform float uSeam;  // hairline along each cubie face border, in cubie units (cubie = 1)
  uniform float uSeamSym; // mode 2: seams on all four sides (1) or v11's two (0)
  uniform float uId;      // this cubie's id, written to R in plate mode when uIdOut = 1 (Poisson keeps cubies apart)
  uniform float uIdOut;
  uniform float uCapCos; // mode 2: a fragment counts as a cap (z face) only if |n.z| exceeds this, like the extrusion's cap / side-wall split
  uniform float uSeamUv; // 0: from local geometry (true edges); 1: from the geometry's uv (v1-v11 look; drifts on rounded cubies after turns);
                         // 2: the v11 mapping (extrude uv = coordinate + 0.43: one-sided seams, plate centre at +0.07) rebuilt in cube-space axes
                         //    around each cubie's centre, so it matches v11 at rest and stays consistent through turns
  float plate(vec2 p) { float b = (1.0 - p.x * p.x) * (1.0 - p.y * p.y); return 1.0 - pow(clamp(b, 0.0, 1.0), k); }
  // the two coordinates across the face this fragment lies on (dominant local normal axis), -.5..+.5
  vec2 across(vec3 pos, vec3 n) { vec3 a = abs(n); return a.x > a.y && a.x > a.z ? pos.yz : a.y > a.z ? pos.xz : pos.xy; }
  // which face of the cubie a fragment lies on, from its position alone (the largest |coordinate|); never from
  // the interpolated normal, which drifts across a rounded face and splits it. Returns the two coordinates across
  // that face, taken from the shifted position (v11's +0.07 plate offset).
  vec2 acrossRigid(vec3 pos, vec3 shifted) {
    vec3 ap = abs(pos);
    return ap.x >= ap.y && ap.x >= ap.z ? shifted.yz : ap.y >= ap.z ? shifted.xz : shifted.xy;
  }
  void main() {
    float l = 0.35 + 0.65 * max(dot(normalize(vN), normalize(vec3(0.35, 0.8, 0.6))), 0.0);
    // face coordinates -.5..+.5 for the plate, and for the seam. v11's uv shifts both by the same +0.07, so seams
    // fall on two sides of each face only and neighbouring faces merge into one field island across the edge;
    // that island creases when the cubie turns. Mode 2 keeps the shifted plate but seams every side (uSeamSym).
    vec2 f = uSeamUv > 1.5 ? acrossRigid(vLocal, vLocal - vShift) : uSeamUv > 0.5 ? vUv - 0.5 : across(vLocal, vLocalN);
    vec2 fs = uSeamUv > 1.5 && uSeamSym > 0.5 ? acrossRigid(vLocal, vLocal) : f;
    float e = 0.5 - max(abs(fs.x), abs(fs.y));
    float seam = uSeam > 0.0 ? 1.0 - smoothstep(uSeam * 0.6, uSeam, e) : 0.0;
    float depth = clamp((vViewZ - uCamZ) / 6.0 + 0.5, 0.0, 1.0);
    if (mode < 1.0) {
      o = vec4(seam, l, 1.0, depth);
    } else if (mode < 2.5) {
      // seams become holes in the alpha, so a Poisson field sees every cubie face as its own shape;
      // with uIdOut the R channel carries the cubie id instead of the plate (the solver uses it as a wall)
      o = vec4(uIdOut > 0.5 ? uId : plate(2.0 * f), 1.0 - seam, l, depth);
    } else {
      // the whole cube face this fragment lies on, in cube space: coords perpendicular to the dominant normal axis
      vec3 n = abs(normalize(vCubeN));
      vec3 c = vCube / uHalf;
      vec2 p = n.x > n.y && n.x > n.z ? c.yz : n.y > n.z ? c.xz : c.xy;
      o = vec4(plate(clamp(p, -1.0, 1.0)), 1.0, l, depth);
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
    if (u_outline > 0.5 && u_outline < 2.5) {
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
    // ascii outline: the screen in glyph cells; a cell's density is how near the cube is when looking out from its
    // centre, with a longer reach toward the left (u_asciiBias) so the glyphs trail off to the right of the cube;
    // a per-cell hash thins the far cells so the trail scatters. Glyphs are 5x5 bitmaps packed into ints.
    if (u_outline > 2.5) {
      vec2 cid = floor(gl_FragCoord.xy / u_asciiCell);
      vec2 cuv = (cid + 0.5) * u_asciiCell / u_resolution;
      vec2 cq = (cuv - 0.5) * vec2(u_aspect, 1.0) / u_scale;
      vec2 cm = vec2(cq.x + 0.5, 0.5 - cq.y);
      ${shader === 'heat' ? 'cm = (cm - 0.5) * 0.5714285714285714 + 0.5;' : ''}
      float dens = 0.0;
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 0.5235988;
        vec2 dir = vec2(cos(a), sin(a));
        float reach = u_asciiReach * (1.0 - u_asciiSquash * abs(dir.y)) * (1.0 + u_asciiBias * max(-dir.x, 0.0));
        for (int s = 0; s < 6; s++) {
          float t = reach * (float(s) + 0.5) / 6.0;
          vec2 sm = cm + dir * t;
          float hit = step(0.01, texture(u_asciiMask, vec2(sm.x, 1.0 - sm.y)).b) * step(0.0, sm.x) * step(sm.x, 1.0) * step(0.0, sm.y) * step(sm.y, 1.0);
          dens = max(dens, hit * (1.0 - t / reach));
        }
      }
      float hc = fract(sin(dot(cid, vec2(12.9898, 78.233))) * 43758.5453123);
      // ordered dither: a 4x4 Bayer threshold per cell shifts the glyph level between neighbours
      ivec2 bi = ivec2(mod(cid, 4.0));
      int bx = bi.x ^ bi.y;
      float bayer = float(((bi.y & 1) << 3) | ((bx & 1) << 2) | ((bi.y & 2) << 0) | ((bx & 2) >> 1)) / 16.0;
      float level = dens * (1.0 - u_asciiScatter * hc) * 8.0 + (bayer - 0.5) * u_asciiDither;
      int idx = int(clamp(level, 0.0, 7.99));
      // 5x5 bitmaps: dots  . : * o & 8 @ (v15)   marks  . - ~ + x % #   code  . ; / < = { #
      int glyph = u_asciiGlyphs < 0.5
        ? (idx == 0 ? 0 : idx == 1 ? 4096 : idx == 2 ? 65600 : idx == 3 ? 332772 : idx == 4 ? 15255086 : idx == 5 ? 23385164 : idx == 6 ? 15252014 : 13199452)
        : u_asciiGlyphs < 1.5
        ? (idx == 0 ? 0 : idx == 1 ? 4194304 : idx == 2 ? 14336 : idx == 3 ? 283712 : idx == 4 ? 4357252 : idx == 5 ? 18157905 : idx == 6 ? 27070835 : 11512810)
        : (idx == 0 ? 0 : idx == 1 ? 4194304 : idx == 2 ? 2232324 : idx == 3 ? 1118480 : idx == 4 ? 8521864 : idx == 5 ? 1016800 : idx == 6 ? 12720268 : 11512810);
      vec2 fc = fract(gl_FragCoord.xy / u_asciiCell);
      // dots keep v15's decode (x mirrored, y up); marks are bit x + 5y with y down
      vec2 pc = u_asciiGlyphs < 0.5 ? floor((fc - 0.5) * vec2(-8.0, 8.0) + 2.5) : floor(vec2(fc.x, 1.0 - fc.y) * 8.0 - 1.5);
      float ink = 0.0;
      if (pc.x >= 0.0 && pc.x <= 4.0 && pc.y >= 0.0 && pc.y <= 4.0) ink = float((glyph >> int(pc.x + 5.0 * pc.y)) & 1);
      float silA = step(0.01, m.b) * inFrame;
      vec3 gcol = mix(u_asciiColor2, u_asciiColor, dens);
      // glow: a soft blob of the glyph colour under the cell, by density; then the glyph, dimmer the farther out
      float blob = smoothstep(0.9, 0.0, length(fc - 0.5) * 2.0);
      fragColor.rgb = mix(fragColor.rgb, gcol, u_asciiMul * u_asciiGlow * dens * blob * step(0.5, level) * (1.0 - silA));
      fragColor.rgb = mix(fragColor.rgb, gcol, u_asciiMul * ink * mix(1.0, dens, u_asciiFade) * (1.0 - silA));
    }
    ${shader === 'heat' ? 'fragColor.a = mix(fragColor.a, max(1.0 - inside, smoothstep(0.0, 0.35, img.r)), u_fuse);' : ''}
  }`
  const marker = 'fragColor = vec4(color, opacity);'
  const i = src.lastIndexOf(marker)
  const body = src.slice(0, i + marker.length) + tail + src.slice(i + marker.length)
  // heatmap's fragment never declares u_resolution; the ascii outline needs it
  const res = body.includes('uniform vec2 u_resolution') ? '' : ' uniform vec2 u_resolution;'
  return body.replace('uniform float u_time;', 'uniform float u_time;' + res + ' uniform sampler2D u_mask; uniform float u_halo; uniform float u_shade; uniform float u_fuse; uniform float u_gain; uniform float u_alpha; uniform vec4 u_ramp[10]; uniform float u_rampCount; uniform float u_rampGamma; uniform float u_rampFloor; uniform float u_grain; uniform float u_outline; uniform float u_outlineW; uniform vec3 u_outlineColor; uniform float u_asciiCell; uniform float u_asciiReach; uniform float u_asciiBias; uniform float u_asciiScatter; uniform vec3 u_asciiColor; uniform vec3 u_asciiColor2; uniform float u_asciiGlyphs; uniform float u_asciiSquash; uniform float u_asciiDither; uniform float u_asciiFade; uniform float u_asciiGlow; uniform float u_asciiMul; uniform sampler2D u_asciiMask; uniform float u_aspect; uniform float u_scale; precision highp int;')
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
  u_asciiCell: { value: 12 },
  u_asciiReach: { value: 0.05 },
  u_asciiBias: { value: 3 },
  u_asciiScatter: { value: 0.5 },
  u_asciiColor: { value: new THREE.Vector3(1, 1, 1) },
  u_asciiColor2: { value: new THREE.Vector3(1, 1, 1) },
  u_asciiGlyphs: { value: 0 },
  u_asciiSquash: { value: 0 },
  u_asciiDither: { value: 0 },
  u_asciiFade: { value: 0 },
  u_asciiGlow: { value: 0 },
  u_asciiMul: { value: 1 }, // the flight fades the ascii outline out (Site)
  u_asciiMask: { value: null },
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
  /** outline behind the silhouette: 'line' (constant width) or 'glow' (soft) in this colour, or 'ascii' glyph cells; defaults to the version's */
  outline?: 'off' | 'line' | 'glow' | 'ascii'
  outlineColor?: string
  /** ascii outline overrides on top of the version's */
  ascii?: Partial<AsciiParams>
  rubik?: React.RefObject<RubikHandle | null>
  /** the flight (Site): the mask scene's root and camera, the cube's half extent, and a zoom on paper's window */
  fly?: React.RefObject<FlyHandle | null>
}
export type FlyHandle = { root: THREE.Group; camera: THREE.PerspectiveCamera; half: number; scale0: number; zoom: (k: number) => void; ascii: (k: number) => void }

export function PaperCube({ version: V, params, spin, spinSpeed = 0.35, auto = false, autoInterval = 900, debug = 'off', gain = 1, alpha = 1, outline: outlineProp, outlineColor = '#ffffff', ascii, rubik, fly }: PaperCubeProps) {
  const outline = outlineProp ?? V.outline ?? 'off'
  const A: AsciiParams = { cell: 9, reach: 0.05, bias: 3, scatter: 0.5, color: '#ece8df', ...V.ascii, ...ascii }
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
      maskE: rt(SIZE), // mask with occlusion-edge seams cut in (liquid / smoke)
      still: rt(256, true, 4), // the un-turned cube's silhouette (a plain box on layer 1) for the still ascii outline
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
      poisson: raw(POISSON, { u: { value: null }, mask: { value: null }, ids: { value: null }, texel: { value: 1 / 256 }, thresh: { value: 0.5 } }),
      reduceMax: raw(REDUCE_MAX, { t: { value: null }, texel: { value: 1 / 128 } }),
      downMin: raw(DOWNMIN, { t: { value: null }, texel: { value: 1 / 1024 }, taps: { value: 4 } }),
      edge: raw(EDGE, { t: { value: null }, texel: { value: 1 / 1024 } }),
      copy: raw(COPY, { t: { value: null } }),
      face: raw(FACE_FRAG, { mode: { value: 0 }, k: { value: 0.75 }, uHalf: { value: 1.5 }, uSeam: { value: 0 }, uSeamUv: { value: 1 }, uSeamSym: { value: 0 }, uId: { value: 0 }, uIdOut: { value: 0 }, uCamZ: { value: 11 }, uCapCos: { value: 0.999 }, uRootInv: { value: new THREE.Matrix4() } }, FACE_VERT),
      final: raw(finalFragment(V.shader), finalUniforms(), FINAL_VERT),
      final2: V.fuse ? raw(finalFragment(V.fuse), finalUniforms(), FINAL_VERT) : null,
      composite: raw(COMPOSITE, { a: { value: null }, b: { value: null } }),
    }
  // shader sources in the deps: a hot reload of this file must rebuild the materials, not keep the old GLSL
  }, [V.shader, V.fuse, FACE_FRAG, FACE_VERT])

  useEffect(
    () => () => {
      Object.values(R).forEach((t) => (Array.isArray(t) ? t.forEach((x) => x.dispose()) : t.dispose()))
      Q.mesh.geometry.dispose()
      ;[Q.blur, Q.combineHeat, Q.combineField, Q.combinePoisson, Q.poisson, Q.reduceMax, Q.downMin, Q.edge, Q.copy, Q.face, Q.final, Q.final2, Q.composite].forEach((m) => m?.dispose())
    },
    [R, Q],
  )

  // the flight zooms paper's window (u_scale) so the cube can fill the whole viewport, not just the mask square
  const zoom = useRef(1)
  const scale0 = typeof params.scale === 'number' ? params.scale : 0.75
  useImperativeHandle(fly, () => ({ root: root.current, camera: camera as THREE.PerspectiveCamera, half: 1.5 * V.rubikGap, scale0, zoom: (k) => { zoom.current = k; Q.final.uniforms.u_scale.value = scale0 * k; if (Q.final2) Q.final2.uniforms.u_scale.value = (scale0 / IMG) * k }, ascii: (k) => { Q.final.uniforms.u_asciiMul.value = k } }), [camera, V.rubikGap, scale0, Q])
  // preset params -> uniforms
  useEffect(() => {
    const u = Q.final.uniforms
    applyParams(u, params)
    u.u_scale.value = scale0 * zoom.current
    u.u_halo.value = V.halo ? 1 : 0
    u.u_shade.value = V.shade
    u.u_fuse.value = V.fuse ? 1 : 0
    u.u_gain.value = gain
    u.u_alpha.value = alpha
    u.u_outline.value = outline === 'line' ? 1 : outline === 'glow' ? 2 : outline === 'ascii' ? 3 : 0
    u.u_asciiCell.value = A.cell * gl.getPixelRatio()
    u.u_asciiReach.value = A.reach
    u.u_asciiBias.value = A.bias
    u.u_asciiScatter.value = A.scatter
    u.u_asciiColor.value.set(...new THREE.Color(A.color).toArray())
    u.u_asciiColor2.value.set(...new THREE.Color(A.color2 ?? A.color).toArray())
    u.u_asciiGlyphs.value = A.glyphs === 'marks' ? 1 : A.glyphs === 'code' ? 2 : 0
    u.u_asciiSquash.value = A.squash ?? 0
    u.u_asciiDither.value = A.dither ?? 0
    u.u_asciiFade.value = A.fade ?? 0
    u.u_asciiGlow.value = A.glow ?? 0
    u.u_outlineW.value = V.shader === 'heat' ? 0.0045 : 0.008 // heat samples the mask through its 57% window
    u.u_outlineColor.value.set(...new THREE.Color(outlineColor).toArray())
    if (Q.final2 && V.fuse) {
      const u2 = Q.final2.uniforms
      applyParams(u2, presetNamed(V.fuse, V.fusePreset).params)
      // same camera and mask as the heat pass: heat shows the mask's central 57% window through its scale,
      // so the full mask spans scale / 0.571 of the screen for the fused pass
      u2.u_scale.value = (scale0 / IMG) * zoom.current
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
    Q.face.uniforms.uSeamSym.value = V.seamSym ? 1 : 0
    Q.face.uniforms.uCamZ.value = V.camZ
  }, [params, Q, V, gain, alpha, outline, outlineColor, A.cell, A.reach, A.bias, A.scatter, A.color, A.color2, A.glyphs, A.squash, A.dither, A.fade, A.glow, gl])

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
  const renderMask = (target: THREE.WebGLRenderTarget, mode: number, idOut = false, layerMask = 1) => {
    Q.face.uniforms.uIdOut.value = idOut ? 1 : 0
    const cam = camera as THREE.PerspectiveCamera
    const prevLayers = cam.layers.mask
    cam.layers.mask = layerMask
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
    cam.layers.mask = prevLayers
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
    renderMask(R.mask, isHeat ? 0 : fieldMode, V.field === 'poisson')
    if (outline === 'ascii' && A.still) renderMask(R.still, isHeat ? 0 : fieldMode, false, 2)
    // liquid / smoke: cut hairline seams at occlusion edges, then everything below reads maskE
    const M = isHeat ? R.mask : R.maskE
    if (!isHeat) {
      Q.edge.uniforms.t.value = R.mask.texture
      Q.edge.uniforms.texel.value = 1 / SIZE
      pass(Q.edge, R.maskE)
    }
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
        Q.downMin.uniforms.t.value = M.texture
        Q.downMin.uniforms.texel.value = 1 / SIZE
        Q.downMin.uniforms.taps.value = SIZE / 256
        pass(Q.downMin, R.pMask)
      } else {
        Q.blur.uniforms.ch.value.set(0, 1, 0, 0)
        boxBlur(M, R.a, R.inner, Math.max(1, Math.round(SIZE / 512)), 1)
        Q.blur.uniforms.ch.value.set(1, 0, 0, 0)
        downsample(R.inner, R.pMask)
      }
      Q.poisson.uniforms.mask.value = R.pMask.texture
      Q.poisson.uniforms.ids.value = M.texture
      Q.poisson.uniforms.thresh.value = V.poissonThresh
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
      Q.combinePoisson.uniforms.mask.value = M.texture
      Q.combinePoisson.uniforms.u.value = a.texture
      Q.combinePoisson.uniforms.umax.value = R.red[R.red.length - 1].texture
      pass(Q.combinePoisson, R.combined)
    } else {
      Q.combineField.uniforms.mask.value = M.texture
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
    u.u_mask.value = M.texture
    u.u_asciiMask.value = (A.still ? R.still : M).texture
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
          {/* the un-turned cube's shape, layer 1 only: the still ascii outline measures from this */}
          <mesh layers-mask={2} material={Q.face}>
            <boxGeometry args={[3 * V.rubikGap, 3 * V.rubikGap, 3 * V.rubikGap]} />
          </mesh>
        </group>
      </scene>
    </>
  )
}
