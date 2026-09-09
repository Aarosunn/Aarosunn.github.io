/**
 * paper.design's heatmap / liquid metal / gem smoke (Apache 2.0) on a 3D shape.
 * Each is a 2D effect over a preprocessed mask image; the preprocess runs on the GPU every frame from a
 * render of the shape, and their fragment shader runs verbatim over the screen. Versions in paperVersions.ts.
 *
 * Mask channels written by the shape render:
 *   heat:          R = luminance (0 shape / 1 outside, or inverted), G = lambert shade, B = 1 inside
 *   liquid, smoke: R = Poisson-like field (1 boundary -> 0 deep inside), G = 1 inside, B = lambert shade
 * Their preprocess then: heat = three box blurs (contour / inner / big); liquid + smoke = the field as is
 * (they blur it in the fragment). The final pass gets the raw mask too, for silhouette clipping and shading.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, RoundedBox } from '@react-three/drei'
import { RubikMask, type RubikHandle } from './RubikMask'
import * as THREE from 'three'
import { gemSmokeFragmentShader, getShaderColorFromString, heatmapFragmentShader, liquidMetalFragmentShader } from '@paper-design/shaders'
import type { PaperShader, PaperShape, PaperVersion } from './paperVersions'

export type PaperDebug = 'off' | 'mask' | 'combined'

const IMG = 1000 / 1750 // heat: image fraction of paper's padded canvas

const QUAD_VERT = /* glsl */ `
  in vec3 position; in vec2 uv; out vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`
// separable box blur on R; one pass = one direction
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
// liquid / smoke: (field, alpha, 1, 1), flipped
const COMBINE_FIELD = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D mask; uniform sampler2D blurred; uniform float useBlur;
  void main() {
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
    vec4 m = texture(mask, uv);
    // blurred silhouette as a Poisson stand-in: 1 at the boundary (blur = .5), 0 deep inside (blur = 1)
    float f = mix(m.r, 1.0 - clamp((texture(blurred, uv).r - 0.5) * 2.0, 0.0, 1.0), useBlur);
    o = vec4(f, m.g, 1.0, 1.0);
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
  uniform sampler2D u; uniform sampler2D mask; uniform float texel; uniform float h2;
  void main() {
    float inside = step(0.5, texture(mask, vUv).g);
    float s = texture(u, vUv + vec2(texel, 0.0)).r + texture(u, vUv - vec2(texel, 0.0)).r
            + texture(u, vUv + vec2(0.0, texel)).r + texture(u, vUv - vec2(0.0, texel)).r;
    o = vec4(vec3(inside * 0.25 * (s + h2)), 1.0);
  }
`
// running max of u (for normalisation): reduce by sampling 4 texels per pass
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
const COPY = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o; uniform sampler2D t;
  void main() { o = vec4(texture(t, vUv).rgb, 1.0); }
`
// shape faces
const FACE_VERT = /* glsl */ `
  in vec3 position; in vec3 normal; in vec2 uv; out vec3 vN; out vec2 vUv; out vec3 vCube; out vec3 vCubeN;
  uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform mat3 normalMatrix; uniform mat4 modelMatrix; uniform mat4 uRootInv;
  void main() {
    vN = normalMatrix * normal; vUv = uv;
    mat4 toCube = uRootInv * modelMatrix;
    vCube = (toCube * vec4(position, 1.0)).xyz;
    vCubeN = mat3(toCube) * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const FACE_FRAG = /* glsl */ `
  precision highp float;
  in vec3 vN; in vec2 vUv; in vec3 vCube; in vec3 vCubeN; out vec4 o;
  uniform float mode;   // 0 heat solid, 1 heat inverted, 2 field per geometry face uv, 3 field per whole-cube face (cube space)
  uniform float k;      // field sharpness
  uniform float uHalf;   // cube half extent in cube space (mode 3)
  uniform float uSeam;   // heat modes: hairline of the opposite value along each geometry face border, in uv units
  float plate(vec2 p) { float b = (1.0 - p.x * p.x) * (1.0 - p.y * p.y); return 1.0 - pow(clamp(b, 0.0, 1.0), k); }
  void main() {
    float l = 0.35 + 0.65 * max(dot(normalize(vN), normalize(vec3(0.35, 0.8, 0.6))), 0.0);
    if (mode < 1.5) {
      float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      float seam = uSeam > 0.0 ? 1.0 - smoothstep(uSeam * 0.6, uSeam, e) : 0.0;
      o = vec4(mix(mode, 1.0 - mode, seam), l, 1.0, 1.0);
    } else if (mode < 2.5) {
      float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      float seam = uSeam > 0.0 ? 1.0 - smoothstep(uSeam * 0.6, uSeam, e) : 0.0;
      // seams become holes in the alpha, so a Poisson field sees every cubie face as its own shape
      o = vec4(plate(2.0 * vUv - 1.0), 1.0 - seam, l, 1.0);
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

/** their fragment verbatim, plus: raw mask uniform, silhouette clip, lambert shade multiply */
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
  }`
  // insert before the last `fragColor = vec4(color, opacity);` -> after it
  const marker = 'fragColor = vec4(color, opacity);'
  const i = src.lastIndexOf(marker)
  const body = src.slice(0, i + marker.length) + tail + src.slice(i + marker.length)
  return body.replace('uniform float u_time;', 'uniform float u_time; uniform sampler2D u_mask; uniform float u_halo; uniform float u_shade;')
}

const frt = (size: number) =>
  new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false })
const rt = (size: number, depth = false, samples = 0) =>
  new THREE.WebGLRenderTarget(size, size, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: depth,
    samples,
  })

export type PaperCubeProps = {
  version: PaperVersion
  shape?: PaperShape
  params: Record<string, unknown>
  spin: boolean
  /** idle spin, rad/s */
  spinSpeed?: number
  /** rubik: chain random turns, with this pause between them (ms) */
  auto?: boolean
  autoInterval?: number
  debug?: PaperDebug
  rubik?: React.RefObject<RubikHandle | null>
}

export function PaperCube({ version, shape: shapeOverride, params, spin, spinSpeed = 0.35, auto = false, autoInterval = 900, debug = 'off', rubik }: PaperCubeProps) {
  const V = version
  const shape = shapeOverride ?? V.shape
  const SIZE = V.size
  const isHeat = V.shader === 'heat'
  // only the box has one uv square per face; other shapes get the blurred-silhouette field
  const useBlur = V.field === 'blur' || (V.field !== 'poisson' && shape !== 'box' && shape !== 'rubik')
  const root = useRef<THREE.Group>(null!)
  const maskScene = useRef<THREE.Scene>(null!)
  const { gl, camera, size } = useThree()

  const R = useMemo(
    () => ({
      mask: rt(SIZE, true, 4),
      a: rt(SIZE),
      contour: rt(SIZE),
      inner: rt(SIZE),
      bigA: rt(SIZE / 2),
      bigB: rt(SIZE / 2),
      big: rt(SIZE / 2),
      combined: rt(SIZE),
      // poisson: solved at 256 with float targets, reduced to 1 px for the max
      pA: frt(256),
      pB: frt(256),
      pMask: rt(256),
      r64: frt(64),
      r16: frt(16),
      r4: frt(4),
      r1: frt(1),
    }),
    [SIZE],
  )
  const Q = useMemo(() => {
    const scene = new THREE.Scene()
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    scene.add(mesh)
    const raw = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, vertexShader = QUAD_VERT) =>
      new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader, fragmentShader, uniforms })
    const blur = raw(BLUR, { t: { value: null }, dir: { value: new THREE.Vector2() }, radius: { value: 1 }, ch: { value: new THREE.Vector4(1, 0, 0, 0) } })
    const combineHeat = raw(COMBINE_HEAT, { contour: { value: null }, big: { value: null }, inner: { value: null } })
    const combineField = raw(COMBINE_FIELD, { mask: { value: null }, blurred: { value: null }, useBlur: { value: 0 } })
    const combinePoisson = raw(COMBINE_POISSON, { mask: { value: null }, u: { value: null }, umax: { value: null } })
    const poisson = raw(POISSON, { u: { value: null }, mask: { value: null }, texel: { value: 1 / 256 }, h2: { value: 1 } })
    const reduceMax = raw(REDUCE_MAX, { t: { value: null }, texel: { value: 1 / 128 } })
    const copy = raw(COPY, { t: { value: null } })
    const face = raw(FACE_FRAG, { mode: { value: 0 }, k: { value: 0.75 }, uHalf: { value: 1.5 }, uSeam: { value: 0 }, uRootInv: { value: new THREE.Matrix4() } }, FACE_VERT)
    const final = raw(
      finalFragment(V.shader),
      {
        u_image: { value: null },
        u_mask: { value: null },
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(1, 1) },
        u_imageAspectRatio: { value: 1 },
        u_isImage: { value: true },
        u_shape: { value: 0 },
        u_halo: { value: 1 },
        u_shade: { value: 0 },
        u_aspect: { value: 1 },
        u_scale: { value: 1 },
        // shader params (superset; unused ones are harmless)
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
      },
      FINAL_VERT,
    )
    return { scene, cam, mesh, blur, combineHeat, combineField, combinePoisson, poisson, reduceMax, copy, face, final }
  }, [V.shader])

  useEffect(
    () => () => {
      Object.values(R).forEach((t) => t.dispose())
      Q.mesh.geometry.dispose()
      ;[Q.blur, Q.combineHeat, Q.combineField, Q.combinePoisson, Q.poisson, Q.reduceMax, Q.copy, Q.face, Q.final].forEach((m) => m.dispose())
    },
    [R, Q],
  )

  // preset params -> uniforms
  useEffect(() => {
    const u = Q.final.uniforms
    const color = (v: unknown, fallback: string) => getShaderColorFromString(typeof v === 'string' ? v : fallback)
    const num = (k: string, fallback: number) => (typeof params[k] === 'number' ? (params[k] as number) : fallback)
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
    for (const k of ['angle', 'noise', 'innerGlow', 'outerGlow', 'contour', 'softness', 'repetition', 'shiftRed', 'shiftBlue', 'distortion', 'innerDistortion', 'outerDistortion', 'offset', 'size'])
      if (typeof params[k] === 'number') u[`u_${k}`].value = params[k]
    u.u_scale.value = num('scale', 1)
    u.u_halo.value = V.halo ? 1 : 0
    u.u_shade.value = V.shade
    Q.face.uniforms.mode.value = isHeat ? (V.polarity === 'solid' ? 0 : 1) : V.field === 'cube' ? 3 : 2
    Q.face.uniforms.k.value = V.fieldK
    Q.face.uniforms.uHalf.value = shape === 'rubik' ? 1.5 * V.rubikGap : 0.5
    Q.face.uniforms.uSeam.value = shape === 'rubik' ? V.seam : 0
  }, [params, Q, V, isHeat, shape])

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

  useFrame((state, dt) => {
    if (spin) root.current.rotation.y += dt * spinSpeed
    root.current.updateMatrixWorld()
    Q.face.uniforms.uRootInv.value.copy(root.current.matrixWorld).invert()
    const speed = typeof params.speed === 'number' ? (params.speed as number) : 1
    const cam = camera as THREE.PerspectiveCamera
    const aspect = cam.aspect

    // 1. mask: square render of the shape
    cam.aspect = 1
    cam.updateProjectionMatrix()
    const prevClear = gl.getClearColor(new THREE.Color())
    const prevAlpha = gl.getClearAlpha()
    // heat solid: white outside (lum 1), no shade, not inside. inverted: black outside. field: boundary value, alpha 0
    if (isHeat) gl.setClearColor(V.polarity === 'inverted' ? new THREE.Color(0, 0, 0) : new THREE.Color(1, 0, 0), 1)
    // cage: faces white (outside) and seams black (the shape) on a white background
    else gl.setClearColor(new THREE.Color(1, 0, 0), 1)
    gl.setRenderTarget(R.mask)
    gl.clear()
    gl.render(maskScene.current, cam)
    gl.setClearColor(prevClear, prevAlpha)
    cam.aspect = aspect
    cam.updateProjectionMatrix()

    // 2. their preprocess
    const px = (r: number, w: number) => Math.max(1, Math.round((r / 1750) * w))
    if (isHeat) {
      boxBlur(R.mask, R.a, R.contour, px(V.blur.contour, SIZE), 1)
      boxBlur(R.mask, R.a, R.inner, px(V.blur.inner, SIZE), 3)
      Q.blur.uniforms.radius.value = 0
      Q.blur.uniforms.t.value = R.mask.texture
      Q.blur.uniforms.dir.value.set(0, 0)
      pass(Q.blur, R.bigA)
      boxBlur(R.bigA, R.bigB, R.big, px(V.blur.big, SIZE / 2), 3)
      Q.combineHeat.uniforms.contour.value = R.contour.texture
      Q.combineHeat.uniforms.big.value = R.big.texture
      Q.combineHeat.uniforms.inner.value = R.inner.texture
      pass(Q.combineHeat, R.combined)
    } else {
      if (useBlur) {
        // silhouette (G) blurred wide, as a Poisson stand-in
        Q.blur.uniforms.ch.value.set(0, 1, 0, 0)
        Q.blur.uniforms.radius.value = 0
        Q.blur.uniforms.t.value = R.mask.texture
        Q.blur.uniforms.dir.value.set(0, 0)
        pass(Q.blur, R.bigA)
        boxBlur(R.bigA, R.bigB, R.big, px(V.blur.big, SIZE / 2), 3)
        Q.blur.uniforms.ch.value.set(1, 0, 0, 0)
      }
      if (V.field === 'poisson') {
        // downsample the mask, iterate Jacobi (warm-started from last frame), reduce the max, normalise
        Q.blur.uniforms.ch.value.set(0, 1, 0, 0)
        Q.blur.uniforms.radius.value = 0
        Q.blur.uniforms.t.value = R.mask.texture
        Q.blur.uniforms.dir.value.set(0, 0)
        pass(Q.blur, R.pMask)
        Q.blur.uniforms.ch.value.set(1, 0, 0, 0)
        // pMask R now holds alpha; the solver reads .g, so point it at R via a swizzle-free trick: copy R->G
        Q.poisson.uniforms.mask.value = R.pMask.texture
        let a = R.pA, b = R.pB
        for (let i = 0; i < V.poissonIters; i++) {
          Q.poisson.uniforms.u.value = a.texture
          pass(Q.poisson, b)
          ;[a, b] = [b, a]
        }
        const chain = [R.r64, R.r16, R.r4, R.r1]
        let src: THREE.WebGLRenderTarget = a
        for (const dst of chain) {
          Q.reduceMax.uniforms.t.value = src.texture
          Q.reduceMax.uniforms.texel.value = 0.5 / dst.width
          pass(Q.reduceMax, dst)
          src = dst
        }
        Q.combinePoisson.uniforms.mask.value = R.mask.texture
        Q.combinePoisson.uniforms.u.value = a.texture
        Q.combinePoisson.uniforms.umax.value = R.r1.texture
        pass(Q.combinePoisson, R.combined)
      } else {
        Q.combineField.uniforms.mask.value = R.mask.texture
        Q.combineField.uniforms.blurred.value = R.big.texture
        Q.combineField.uniforms.useBlur.value = useBlur ? 1 : 0
        pass(Q.combineField, R.combined)
      }
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
    u.u_time.value = state.clock.elapsedTime * speed
    u.u_aspect.value = size.width / size.height
    u.u_resolution.value.set(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio())
    pass(Q.final, null)
  }, 1)

  const seam = V.seam
  const seamColor = V.seamValue > 0.5 ? '#ffffff' : '#000000'
  return (
    <>
      <OrbitControls enablePan={false} enableZoom={false} />
      <scene ref={maskScene}>
        <group ref={root} rotation={[0.5, -0.7, 0]}>
          {shape === 'box' && (
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <primitive object={Q.face} attach="material" />
            </mesh>
          )}
          {shape === 'rounded' && (
            <RoundedBox args={[1, 1, 1]} radius={0.06} smoothness={4}>
              <primitive object={Q.face} attach="material" />
            </RoundedBox>
          )}
          {shape === 'octa' && (
            <mesh>
              <octahedronGeometry args={[0.72, 0]} />
              <primitive object={Q.face} attach="material" />
            </mesh>
          )}
          {shape === 'rubik' && <RubikMask ref={rubik} gap={V.rubikGap} material={Q.face} auto={auto} autoInterval={autoInterval} />}
          {shape === 'cage' && (
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              {/* white faces occlude the back edges; strokes are the shape */}
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          )}
          {seam > 0 && shape !== 'octa' && shape !== 'rubik' && <EdgeBars size={1} width={seam} color={shape === 'cage' ? '#000000' : seamColor} inset={shape !== 'cage'} />}
        </group>
      </scene>
    </>
  )
}

/** The 12 cube edges as thin bars, so they survive the mask render. inset: flush inside the cube (no protrusion past the silhouette). */
function EdgeBars({ size, width, color, inset = false }: { size: number; width: number; color: string; inset?: boolean }) {
  const h = size / 2
  const o = inset ? width / 2 : 0
  const len = inset ? size : size + width
  const bars: { pos: [number, number, number]; dims: [number, number, number] }[] = []
  for (const a of [-h, h])
    for (const b of [-h, h]) {
      const A = a - Math.sign(a) * o
      const B = b - Math.sign(b) * o
      bars.push({ pos: [0, A, B], dims: [len, width, width] })
      bars.push({ pos: [A, 0, B], dims: [width, len, width] })
      bars.push({ pos: [A, B, 0], dims: [width, width, len] })
    }
  return (
    <>
      {bars.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.dims} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </>
  )
}

export { IMG }
