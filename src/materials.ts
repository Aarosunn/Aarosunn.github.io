/**
 * Three cube surfaces adapted from Paper Shaders (github.com/paper-design/shaders, Apache 2.0):
 * heatmap, liquid-metal, gem-smoke. Theirs are 2D shape-masked; these run on the cube's
 * surface using root-space coords (`vCube`) so patterns span the whole cube, not one cubie.
 */
import * as THREE from 'three'

export type Variant = 'heat' | 'chrome' | 'smoke'
export const VARIANTS: Variant[] = ['heat', 'chrome', 'smoke']

const COMMON = /* glsl */ `
  uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform vec3 uBg; uniform vec3 uBright; uniform vec3 uText;
  varying vec3 vNormal; varying vec3 vView; varying vec3 vCube; varying vec3 vCubeN; varying vec3 vLocal; varying vec3 vLocalN;
  float sst(float a, float b, float x) { return smoothstep(a, b, x); }
  vec2 rot(vec2 v, float a) { float s = sin(a), c = cos(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  // 0 at face centres, 1 along the big cube's outer edges and corners.
  float edgeProx() {
    vec3 a = abs(vCube);
    float hi = max(a.x, max(a.y, a.z));
    float mid = a.x + a.y + a.z - hi - min(a.x, min(a.y, a.z));
    return sst(1.2, 1.5, mid);
  }
  // Face-local 2D coords picked by the dominant root-space normal (triplanar pick).
  vec2 faceUV() {
    vec3 n = abs(vCubeN);
    if (n.x > n.y && n.x > n.z) return vCube.zy;
    if (n.y > n.z) return vCube.xz;
    return vCube.xy;
  }
  float fresnel(float p) { return pow(1.0 - max(dot(vNormal, vView), 0.0), p); }
  // Hairline at every cubie boundary, in cubie-local space so it stays put mid-turn. 1 on the line.
  float seam() {
    vec3 d = 0.5 - abs(vLocal);
    vec3 n = abs(vLocalN);
    if (n.x > 0.5) d.x = 1.0; if (n.y > 0.5) d.y = 1.0; if (n.z > 0.5) d.z = 1.0;
    float m = min(d.x, min(d.y, d.z));
    return 1.0 - sst(0.0, 0.012, m);
  }
  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  vec3 lightest() { return lum(uBright) > lum(uBg) ? uBright : uBg; }
  vec3 darkest() { return lum(uBright) > lum(uBg) ? uBg : uBright; }
`

const VERT = /* glsl */ `
  uniform mat4 uRootInv;
  varying vec3 vNormal; varying vec3 vView; varying vec3 vCube; varying vec3 vCubeN; varying vec3 vLocal; varying vec3 vLocalN;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vLocal = position;
    vLocalN = normal;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    vCube = (uRootInv * wp).xyz;
    vCubeN = normalize(mat3(uRootInv) * vNormal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

// Paper "heatmap" defaults: 7 stops, cold to hot. Body stays cool, edges run hot, a warm band rises.
const heatFrag = /* glsl */ `
  ${COMMON}
  vec3 grad7(float h) {
    vec3 c[7];
    c[0] = vec3(0.067, 0.125, 0.416); c[1] = vec3(0.122, 0.231, 0.635); c[2] = vec3(0.184, 0.388, 0.906);
    c[3] = vec3(0.420, 0.843, 1.000); c[4] = vec3(1.000, 0.902, 0.475); c[5] = vec3(1.000, 0.600, 0.118);
    c[6] = vec3(1.000, 0.298, 0.000);
    float m = clamp(h, 0.0, 0.9999) * 6.0;
    int i = int(floor(m));
    return mix(c[i], c[i + 1], fract(m));
  }
  void main() {
    float t = 0.1 * uTime;
    float edge = edgeProx();
    float fres = fresnel(2.0);
    float inner = 0.16 + 0.6 * edge + 0.3 * fres;
    // three cold voids drifting up through the body, like the original's shadow shapes
    for (int k = 0; k < 3; k++) {
      float tk = fract(t + float(k) / 3.0);
      float cy = mix(-3.2, 3.6, tk);
      vec3 d = (vCube - vec3(0.0, cy, 0.0)) * vec3(0.6, 1.0, 0.6);
      float s = 1.0 - sst(0.8, 2.0, length(d));
      inner = mix(inner, 0.06, s * (1.0 - 0.7 * edge));
    }
    // one warm band rising faster (the original's animated outer mask)
    float y = fract((vCube.y + 1.5) / 3.0 - fract(t * 3.0 - 0.1));
    float band = sst(0.3, 0.65, y) * (1.0 - sst(0.65, 1.0, y));
    inner += 0.3 * band;
    inner += 0.35 * (noise(vCube * 1.6 + vec3(0.0, -uTime * 0.2, 0.0)) - 0.5) * (1.0 - edge);
    float heat = clamp(inner, 0.0, 1.0);
    vec3 col = grad7(heat);
    col *= 0.8 + 1.7 * sst(0.6, 1.0, heat);
    col *= 1.0 - 0.25 * seam();
    gl_FragColor = vec4(col, 1.0);
  }
`

// Paper "liquid-metal": white/near-black stripe cycle with two thin strips, a wide gradient,
// and per-channel dispersion. Stripe coordinate comes from the reflected view vector so it reads
// as a studio reflection sliding over the metal.
const metalFrag = /* glsl */ `
  ${COMMON}
  float stripes(float c1, float c2, float p, vec3 w, float blur, float bump) {
    float ch = mix(c2, c1, sst(0.0, 2.0 * blur, p));
    float border = w[0];
    ch = mix(ch, c2, sst(border, border + 2.0 * blur, p));
    border = w[0] + 0.4 * (1.0 - bump) * w[1];
    ch = mix(ch, c1, sst(border, border + 2.0 * blur, p));
    border = w[0] + 0.5 * (1.0 - bump) * w[1];
    ch = mix(ch, c2, sst(border, border + 2.0 * blur, p));
    border = w[0] + w[1];
    ch = mix(ch, c1, sst(border, border + 2.0 * blur, p));
    float g = mix(c1, c2, sst(0.0, 1.0, (p - w[0] - w[1]) / w[2]));
    return mix(ch, g, sst(border, border + 0.5 * blur, p));
  }
  void main() {
    const float repetition = 2.0, softness = 0.1, shiftR = 0.3, shiftB = 0.3, distortion = 0.07;
    float t = 0.3 * (uTime + 2.8);
    float edge = fresnel(1.5);
    float bump = 1.0 - edge;
    vec3 R = reflect(-vView, vNormal);
    float ang = radians(70.0 - 90.0);
    float direction = 0.5 + 0.5 * (R.y * cos(ang) + R.x * sin(ang));
    float n = noise(vCube * 0.45 + vec3(0.0, -t * 0.6, t * 0.2)) - 0.5;
    direction += distortion * n * 2.0;
    direction -= 0.25 * edge;
    direction *= repetition;
    direction -= t;
    float disp = min(edge, 0.45); // cap so grazing faces keep a thin fringe, not a rainbow
    float dR = (disp + 0.03 * bump * n) * (shiftR / 20.0);
    float dB = (disp * 1.3 - 0.2 * edge) * (shiftB / 20.0);
    vec3 c1 = mix(vec3(0.98, 0.98, 1.0), uA, 0.08);
    vec3 c2 = mix(vec3(0.08, 0.08, 0.1), uB, 0.1);
    vec3 w = vec3(0.12 * (1.0 - 0.4 * bump), 0.07 * (1.0 + 0.4 * bump), 0.0);
    w[2] = 1.0 - w[0] - w[1];
    w[1] -= 0.02 * sst(0.0, 1.0, edge + bump);
    float pr = fract(direction + dR), pg = fract(direction), pb = fract(direction - dB);
    float blur = softness / 15.0;
    vec3 col = vec3(
      stripes(c1.r, c2.r, pr, w, blur + fwidth(pr), bump),
      stripes(c1.g, c2.g, pg, w, blur + fwidth(pg), bump),
      stripes(c1.b, c2.b, pb, w, blur + fwidth(pb), bump));
    // faces read as planes, not paper: soft key light + seams
    col *= 0.8 + 0.2 * max(dot(vNormal, normalize(vec3(0.35, 1.0, 0.6))), 0.0);
    col *= 1.0 - 0.2 * seam();
    gl_FragColor = vec4(col, 1.0);
  }
`

// Paper "gem-smoke": swirl field -> gaussian smoke -> two-stop gradient over a milky glass body.
const smokeFrag = /* glsl */ `
  ${COMMON}
  void main() {
    const float innerDistortion = 0.8, size = 0.8, colorsCount = 2.0;
    float time = uTime;
    float fres = fresnel(2.5);
    float roundness = 1.0 - edgeProx();
    vec2 uv = faceUV() / 3.0 * mix(4.0, 1.0, size);
    uv.y += innerDistortion * (1.0 - sst(0.0, 1.0, length(0.4 * uv)));
    uv.y -= 0.4 * innerDistortion;
    float swirl = innerDistortion * roundness;
    for (int i = 1; i < 5; i++) {
      float fi = float(i);
      float stretch = max(length(dFdx(uv)), length(dFdy(uv)));
      float sw = swirl / (1.0 + stretch * 8.0);
      uv.x += sw / fi * cos(time + fi * 2.9 * uv.y);
      uv.y += sw / fi * cos(time + fi * 1.5 * uv.x);
    }
    float shape = exp(-1.5 * dot(uv, uv));
    float mixer = shape * colorsCount;
    vec3 smokeDark = mix(darkest(), uB, 0.45) * 0.6;
    vec3 smokeLight = mix(lightest(), uA, 0.35);
    float m1 = sst(0.0, 1.0, clamp(mixer, 0.0, 1.0));
    float m2 = sst(0.0, 1.0, clamp(mixer - 1.0, 0.0, 1.0));
    vec3 smoke = mix(smokeDark, smokeLight, m2);
    vec3 glass = mix(lightest(), uA, 0.06);
    vec3 col = mix(glass, smoke, m1);
    // gem body: rim light and one fixed specular so the faces read as polished stone
    col += fres * 0.35 * mix(vec3(1.0), uA, 0.5);
    vec3 L = normalize(vec3(0.4, 0.9, 0.6));
    col += pow(max(dot(reflect(-L, vNormal), vView), 0.0), 48.0) * 0.5;
    col *= 1.0 - 0.18 * seam();
    gl_FragColor = vec4(col, 1.0);
  }
`

const FRAG: Record<Variant, string> = { heat: heatFrag, chrome: metalFrag, smoke: smokeFrag }

export type Palette = { a: string; b: string; bg: string; bright: string; text: string }

export function makeMaterial(variant: Variant, p: Palette): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRootInv: { value: new THREE.Matrix4() },
      uA: { value: new THREE.Color(p.a) },
      uB: { value: new THREE.Color(p.b) },
      uBg: { value: new THREE.Color(p.bg) },
      uBright: { value: new THREE.Color(p.bright) },
      uText: { value: new THREE.Color(p.text) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG[variant],
  })
}
