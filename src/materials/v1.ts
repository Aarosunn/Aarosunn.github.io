import * as THREE from 'three'

export type Variant = 'heat' | 'chrome' | 'smoke'
export const VARIANTS: Variant[] = ['heat', 'chrome', 'smoke']

const NOISE = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.02 + 7.3; a *= 0.5; }
    return v;
  }
`

// Google's turbo colormap, polynomial fit.
const TURBO = /* glsl */ `
  vec3 turbo(float t) {
    t = clamp(t, 0.0, 1.0);
    const vec4 r4 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
    const vec4 g4 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
    const vec4 b4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771);
    const vec2 r2 = vec2(-152.94239396, 59.28637943);
    const vec2 g2 = vec2(4.27729857, 2.82956604);
    const vec2 b2 = vec2(-89.90310912, 27.34824973);
    vec4 v4 = vec4(1.0, t, t * t, t * t * t);
    vec2 v2 = v4.zw * v4.z;
    return vec3(dot(v4, r4) + dot(v2, r2), dot(v4, g4) + dot(v2, g2), dot(v4, b4) + dot(v2, b2));
  }
`

const VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const heatFrag = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld; varying vec3 vNormal; varying vec3 vView;
  ${NOISE} ${TURBO}
  void main() {
    float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.5);
    float n = fbm(vWorld * 1.4 + vec3(0.0, -uTime * 0.25, uTime * 0.1));
    float t = 0.5 + vWorld.y * 0.26 + fres * 0.35 + (n - 0.5) * 0.35;
    vec3 c = turbo(max(t, 0.12));
    // hotter regions push past 1.0 so bloom picks them up
    c *= 0.7 + smoothstep(0.55, 1.0, t) * 1.5;
    gl_FragColor = vec4(c, 1.0);
  }
`

const smokeFrag = /* glsl */ `
  uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform vec3 uBg;
  varying vec3 vWorld; varying vec3 vNormal; varying vec3 vView;
  ${NOISE}
  void main() {
    float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.0);
    vec3 p = vWorld * 1.1 + vec3(uTime * 0.05, uTime * 0.08, 0.0);
    float q = fbm(p + fbm(p * 1.7 - uTime * 0.05) * 1.5);
    float veins = smoothstep(0.35, 0.7, q);
    vec3 glass = mix(uBg, uA, 0.35);
    vec3 col = mix(glass, mix(uB, uA, q), veins * 0.8);
    col += fres * 0.4;
    float alpha = 0.72 + fres * 0.28;
    gl_FragColor = vec4(col, alpha);
  }
`

export function makeMaterial(variant: Variant, a: string, b: string, bg: string): THREE.Material {
  if (variant === 'chrome') {
    return new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 1,
      roughness: 0.18,
      iridescence: 0.9,
      iridescenceIOR: 1.6,
      iridescenceThicknessRange: [200, 600],
      envMapIntensity: 1.2,
    })
  }
  const uniforms = {
    uTime: { value: 0 },
    uA: { value: new THREE.Color(a) },
    uB: { value: new THREE.Color(b) },
    uBg: { value: new THREE.Color(bg) },
  }
  if (variant === 'heat') {
    return new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: heatFrag })
  }
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: smokeFrag,
    transparent: true,
  })
}
