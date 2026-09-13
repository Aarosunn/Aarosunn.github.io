/**
 * paper.design's liquid metal (Apache 2.0) on the Rubik's cube. Their shader is a 2D effect over a preprocessed
 * image; here that image is rendered every frame from the cube: a mask of the 27 cubies (R = cubie id or plate,
 * G = 1 inside / 0 on seams, B = lambert shade, A = view depth), occlusion edges cut in, a Poisson field solved on
 * the GPU per cubie (∇²u = -1 inside each plate, warm-started, 60 Jacobi steps at 256²), then their fragment runs
 * verbatim over the screen with a tail of ours: silhouette clip, shade, grain, the ascii outline, and the hooks the
 * section transition needs (a zoom and a stretch of paper's window, a capture of the final image to a texture).
 */
import { useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { getShaderColorFromString, liquidMetalFragmentShader } from '@paper-design/shaders'
import { RubikMask, type RubikHandle } from './RubikMask'
import { CUBE, LIQUID } from './cube'

const QUAD_VERT = /* glsl */ `
  in vec3 position; in vec2 uv; out vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`
// separable box blur of one channel; one pass = one direction (radius 0 = one bilinear tap: a downsample)
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
// Jacobi step for  ∇²u = -1  inside the shape (mask G > thresh), u = 0 outside. Their preprocess, on the GPU.
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
// cubie faces: the plate and seam of each face are found from the fragment's position in the cubie's own frame
// (never from the interpolated normal, which drifts across a rounded face), with the v11 mapping's +0.07 plate shift
// brought into that frame, so the look is the same at rest and through turns
const FACE_VERT = /* glsl */ `
  in vec3 position; in vec3 normal; out vec3 vN; out vec3 vLocal; out vec3 vShift; out float vViewZ;
  uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform mat3 normalMatrix; uniform mat4 modelMatrix; uniform mat4 uRootInv;
  void main() {
    vN = normalMatrix * normal; vLocal = position;
    mat3 R = mat3(uRootInv * modelMatrix);
    vShift = transpose(R) * vec3(0.07);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewZ = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const FACE_FRAG = /* glsl */ `
  precision highp float;
  in vec3 vN; in vec3 vLocal; in vec3 vShift; in float vViewZ; out vec4 o;
  uniform float uCamZ;   // alpha = view depth relative to the camera distance, over 6 units (occlusion edges)
  uniform float k;       // plate sharpness
  uniform float uSeam;   // hairline along each cubie face border, in cubie units (cubie = 1)
  uniform float uId;     // this cubie's id, written to R when uIdOut = 1 (the Poisson solver keeps cubies apart)
  uniform float uIdOut;
  float plate(vec2 p) { float b = (1.0 - p.x * p.x) * (1.0 - p.y * p.y); return 1.0 - pow(clamp(b, 0.0, 1.0), k); }
  // which face of the cubie a fragment lies on, from its position alone (the largest |coordinate|); returns the two
  // coordinates across that face, taken from the shifted position
  vec2 acrossRigid(vec3 pos, vec3 shifted) {
    vec3 ap = abs(pos);
    return ap.x >= ap.y && ap.x >= ap.z ? shifted.yz : ap.y >= ap.z ? shifted.xz : shifted.xy;
  }
  void main() {
    float l = 0.35 + 0.65 * max(dot(normalize(vN), normalize(vec3(0.35, 0.8, 0.6))), 0.0);
    vec2 f = acrossRigid(vLocal, vLocal - vShift);
    float e = 0.5 - max(abs(f.x), abs(f.y));
    float seam = uSeam > 0.0 ? 1.0 - smoothstep(uSeam * 0.6, uSeam, e) : 0.0;
    float depth = clamp((vViewZ - uCamZ) / 6.0 + 0.5, 0.0, 1.0);
    // seams become holes in the alpha, so the Poisson field sees every cubie face as its own shape
    o = vec4(uIdOut > 0.5 ? uId : plate(2.0 * f), 1.0 - seam, l, depth);
  }
`
// paper's vertex semantics for fit = contain, square image, no rotation / offset; u_stretch pulls the window (and the
// mask in it) to a non-square shape: the landed face stretching into the viewport
const FINAL_VERT = /* glsl */ `
  in vec3 position; in vec2 uv;
  uniform float u_aspect; uniform float u_scale; uniform vec2 u_stretch;
  out vec2 v_imageUV; out vec2 v_objectUV; out vec2 v_responsiveUV; out vec2 v_responsiveBoxGivenSize;
  void main() {
    vec2 p = uv - 0.5;
    vec2 q = p * vec2(u_aspect, 1.0) / (u_scale * u_stretch);
    v_objectUV = q;
    v_imageUV = vec2(q.x + 0.5, 0.5 - q.y);
    v_responsiveUV = p / (u_scale * u_stretch);
    v_responsiveBoxGivenSize = vec2(u_aspect, 1.0) * 1000.0;
    gl_Position = vec4(position, 1.0);
  }
`

/** their fragment verbatim, plus our tail */
function finalFragment() {
  const src = liquidMetalFragmentShader.replace('#version 300 es', '').replace(/precision mediump float;/, 'precision highp float;')
  const tail = `
  {
    vec2 mUV = v_imageUV;
    vec4 m = texture(u_mask, vec2(mUV.x, 1.0 - mUV.y));
    float inFrame = step(0.0, mUV.x) * step(mUV.x, 1.0) * step(0.0, mUV.y) * step(mUV.y, 1.0);
    float inside = m.g * inFrame;
    fragColor = mix(u_colorBack, fragColor, inside);
    fragColor.rgb *= mix(1.0, m.b, u_shade * inside);
    // static grain over the cube body
    float grainN = u_grain * 0.35 * (fract(sin(dot(v_imageUV * 1000.0, vec2(12.9898, 78.233))) * 43758.5453123) - 0.5);
    fragColor.rgb *= mix(1.0, 1.0 + grainN, inside);
    // ascii outline: the screen in glyph cells; a cell's density is how near the cube is when looking out from its
    // centre, with a longer reach toward the left (u_asciiBias) so the glyphs trail off to the right of the cube;
    // a per-cell hash thins the far cells so the trail scatters. Glyphs are 5x5 bitmaps packed into ints.
    // Measured from the un-turned cube's shape (u_asciiMask), so a turning layer does not drag the glyphs along.
    if (u_asciiMul > 0.001) {
      vec2 cid = floor(gl_FragCoord.xy / u_asciiCell);
      vec2 cuv = (cid + 0.5) * u_asciiCell / u_resolution;
      vec2 cq = (cuv - 0.5) * vec2(u_aspect, 1.0) / (u_scale * u_stretch);
      vec2 cm = vec2(cq.x + 0.5, 0.5 - cq.y);
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
      // 5x5 bitmaps, the code ramp: . ; / < = { #
      int glyph = idx == 0 ? 0 : idx == 1 ? 4194304 : idx == 2 ? 2232324 : idx == 3 ? 1118480 : idx == 4 ? 8521864 : idx == 5 ? 1016800 : idx == 6 ? 12720268 : 11512810;
      vec2 fc = fract(gl_FragCoord.xy / u_asciiCell);
      vec2 pc = floor(vec2(fc.x, 1.0 - fc.y) * 8.0 - 1.5);
      float ink = 0.0;
      if (pc.x >= 0.0 && pc.x <= 4.0 && pc.y >= 0.0 && pc.y <= 4.0) ink = float((glyph >> int(pc.x + 5.0 * pc.y)) & 1);
      float silA = step(0.01, m.b) * inFrame;
      vec3 gcol = mix(u_asciiColor2, u_asciiColor, dens);
      // glow: a soft blob of the glyph colour under the cell, by density; then the glyph, dimmer the farther out
      float blob = smoothstep(0.9, 0.0, length(fc - 0.5) * 2.0);
      fragColor.rgb = mix(fragColor.rgb, gcol, u_asciiMul * u_asciiGlow * dens * blob * step(0.5, level) * (1.0 - silA));
      fragColor.rgb = mix(fragColor.rgb, gcol, u_asciiMul * ink * mix(1.0, dens, u_asciiFade) * (1.0 - silA));
    }
  }`
  const marker = 'fragColor = vec4(color, opacity);'
  const i = src.lastIndexOf(marker)
  const body = src.slice(0, i + marker.length) + tail + src.slice(i + marker.length)
  const res = body.includes('uniform vec2 u_resolution') ? '' : ' uniform vec2 u_resolution;'
  return body.replace('uniform float u_time;', 'uniform float u_time;' + res + ' uniform sampler2D u_mask; uniform sampler2D u_asciiMask; uniform float u_shade; uniform float u_grain; uniform float u_asciiCell; uniform float u_asciiReach; uniform float u_asciiBias; uniform float u_asciiScatter; uniform vec3 u_asciiColor; uniform vec3 u_asciiColor2; uniform float u_asciiSquash; uniform float u_asciiDither; uniform float u_asciiFade; uniform float u_asciiGlow; uniform float u_asciiMul; uniform float u_aspect; uniform float u_scale; uniform vec2 u_stretch; precision highp int;')
}

const rt = (size: number, depth = false, samples = 0) => new THREE.WebGLRenderTarget(size, size, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: depth, samples })
const frt = (size: number) => new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false })
const rt2 = (w: number, h: number) => new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false })
const rgb = (hex: string) => new THREE.Vector3(...new THREE.Color(hex).toArray())

const finalUniforms = (): Record<string, THREE.IUniform> => ({
  u_image: { value: null },
  u_mask: { value: null },
  u_asciiMask: { value: null },
  u_time: { value: 0 },
  u_resolution: { value: new THREE.Vector2(1, 1) },
  u_imageAspectRatio: { value: 1 },
  u_isImage: { value: true },
  u_shape: { value: 0 },
  u_shade: { value: CUBE.shade },
  u_grain: { value: LIQUID.grain },
  u_asciiCell: { value: CUBE.ascii.cell },
  u_asciiReach: { value: CUBE.ascii.reach },
  u_asciiBias: { value: CUBE.ascii.bias },
  u_asciiScatter: { value: CUBE.ascii.scatter },
  u_asciiColor: { value: rgb(CUBE.ascii.color) },
  u_asciiColor2: { value: rgb(CUBE.ascii.color2) },
  u_asciiSquash: { value: CUBE.ascii.squash },
  u_asciiDither: { value: CUBE.ascii.dither },
  u_asciiFade: { value: CUBE.ascii.fade },
  u_asciiGlow: { value: CUBE.ascii.glow },
  u_asciiMul: { value: 1 },
  u_aspect: { value: 1 },
  u_scale: { value: LIQUID.scale },
  u_stretch: { value: new THREE.Vector2(1, 1) },
  // the paper pass writes to the screen raw: the hex as-is, not THREE's linear conversion
  u_colorBack: { value: getShaderColorFromString(LIQUID.colorBack) },
  u_colorTint: { value: getShaderColorFromString(LIQUID.colorTint) },
  u_softness: { value: LIQUID.softness },
  u_repetition: { value: LIQUID.repetition },
  u_shiftRed: { value: LIQUID.shiftRed },
  u_shiftBlue: { value: LIQUID.shiftBlue },
  u_distortion: { value: LIQUID.distortion },
  u_contour: { value: LIQUID.contour },
  u_angle: { value: LIQUID.angle },
})

/** the section transition's hooks. half: the cube's true half extent (the face plane's distance from its centre, and the
 *  face's half size); scale0: paper's window scale at rest */
export type FlyHandle = {
  root: THREE.Group
  camera: THREE.PerspectiveCamera
  half: number
  scale0: number
  /** paper's window scaled (the flight zooms it so the cube can fill the whole viewport) */
  zoom: (k: number) => void
  /** the ascii outline's opacity */
  ascii: (k: number) => void
  /** the window pulled to a non-square shape (x, y multipliers) */
  stretch: (x: number, y: number) => void
  /** capture on: the final image goes to a screen-sized target instead of the screen (the section page's tiles sample it) */
  capture: (on: boolean) => void
  /** that target's texture (valid content only while capturing) */
  shot: THREE.Texture
  /** asleep: nothing is rendered at all (the section page at rest shows none of the cube) */
  sleep: (on: boolean) => void
}

export type PaperCubeProps = {
  /** mask size: 1024, or 768 on narrow screens */
  size: number
  /** paper's window scale */
  scale: number
  spin: boolean
  /** idle spin, rad/s */
  spinSpeed: number
  /** idle turns: on, the pause between them (ms), the chance one is a burst of two or three */
  auto: boolean
  autoInterval: number
  combo: number
  rubik: React.RefObject<RubikHandle | null>
  fly: React.RefObject<FlyHandle | null>
}

export function PaperCube({ size: SIZE, scale: scale0, spin, spinSpeed, auto, autoInterval, combo, rubik, fly }: PaperCubeProps) {
  const root = useRef<THREE.Group>(null!)
  const maskScene = useRef<THREE.Scene>(null!)
  const { gl, camera, size } = useThree()

  const R = useMemo(
    () => ({
      mask: rt(SIZE, true, 4),
      maskE: rt(SIZE), // mask with occlusion-edge seams cut in
      a: rt(SIZE),
      inner: rt(SIZE),
      combined: rt(SIZE),
      still: rt(256, true, 4), // the un-turned cube's silhouette (a plain box on layer 1) for the ascii outline
      // poisson: solved at 256 with float targets; max reduced by halving eight times
      pA: frt(256),
      pB: frt(256),
      pMask: rt(256),
      red: [128, 64, 32, 16, 8, 4, 2, 1].map(frt),
    }),
    [SIZE],
  )
  const Q = useMemo(() => {
    const scene = new THREE.Scene()
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    scene.add(mesh)
    const raw = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, vertexShader = QUAD_VERT) => new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader, fragmentShader, uniforms })
    return {
      scene,
      cam,
      mesh,
      blur: raw(BLUR, { t: { value: null }, dir: { value: new THREE.Vector2() }, radius: { value: 1 }, ch: { value: new THREE.Vector4(1, 0, 0, 0) } }),
      combinePoisson: raw(COMBINE_POISSON, { mask: { value: null }, u: { value: null }, umax: { value: null } }),
      poisson: raw(POISSON, { u: { value: null }, mask: { value: null }, ids: { value: null }, texel: { value: 1 / 256 }, thresh: { value: CUBE.poissonThresh } }),
      reduceMax: raw(REDUCE_MAX, { t: { value: null }, texel: { value: 1 / 128 } }),
      edge: raw(EDGE, { t: { value: null }, texel: { value: 1 / 1024 } }),
      face: raw(FACE_FRAG, { k: { value: CUBE.fieldK }, uSeam: { value: CUBE.seam }, uId: { value: 0 }, uIdOut: { value: 0 }, uCamZ: { value: CUBE.camZ }, uRootInv: { value: new THREE.Matrix4() } }, FACE_VERT),
      final: raw(finalFragment(), finalUniforms(), FINAL_VERT),
    }
  }, [])
  useEffect(
    () => () => {
      Object.values(R).forEach((t) => (Array.isArray(t) ? t.forEach((x) => x.dispose()) : t.dispose()))
      Q.mesh.geometry.dispose()
      ;[Q.blur, Q.combinePoisson, Q.poisson, Q.reduceMax, Q.edge, Q.face, Q.final].forEach((m) => m.dispose())
    },
    [R, Q],
  )

  const zoom = useRef(1)
  const captureOn = useRef(false)
  const asleep = useRef(false)
  const dpr = gl.getPixelRatio()
  const shot = useMemo(() => rt2(Math.round(size.width * dpr), Math.round(size.height * dpr)), [size.width, size.height, dpr])
  useEffect(() => () => shot.dispose(), [shot])
  useEffect(() => { Q.final.uniforms.u_scale.value = scale0 * zoom.current; Q.final.uniforms.u_asciiCell.value = CUBE.ascii.cell * dpr }, [Q, scale0, dpr])
  useImperativeHandle(fly, () => ({
    root: root.current,
    camera: camera as THREE.PerspectiveCamera,
    half: CUBE.gap + 0.5,
    scale0,
    zoom: (k) => { zoom.current = k; Q.final.uniforms.u_scale.value = scale0 * k },
    ascii: (k) => { Q.final.uniforms.u_asciiMul.value = k },
    stretch: (x, y) => { Q.final.uniforms.u_stretch.value.set(x, y) },
    capture: (on) => { captureOn.current = on },
    shot: shot.texture,
    sleep: (on) => { asleep.current = on },
  }), [camera, scale0, Q, shot])

  const pass = (mat: THREE.RawShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
    Q.mesh.material = mat
    gl.setRenderTarget(target)
    gl.render(Q.scene, Q.cam)
  }
  // square render of the cube into a mask target: clear = (1, 0, 0) = seam / outside, no alpha, no shade
  const renderMask = (target: THREE.WebGLRenderTarget, idOut: boolean, layerMask = 1) => {
    Q.face.uniforms.uIdOut.value = idOut ? 1 : 0
    const cam = camera as THREE.PerspectiveCamera
    const prevLayers = cam.layers.mask
    cam.layers.mask = layerMask
    const aspect = cam.aspect
    cam.aspect = 1
    cam.updateProjectionMatrix()
    const prevClear = gl.getClearColor(new THREE.Color())
    const prevAlpha = gl.getClearAlpha()
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
    if (asleep.current) return
    if (spin) root.current.rotation.y += dt * spinSpeed
    root.current.updateMatrixWorld()
    Q.face.uniforms.uRootInv.value.copy(root.current.matrixWorld).invert()

    // 1. the mask (cubie ids in R), and the un-turned silhouette for the outline
    renderMask(R.mask, true)
    renderMask(R.still, false, 2)
    // 2. occlusion edges cut in; everything below reads maskE
    Q.edge.uniforms.t.value = R.mask.texture
    Q.edge.uniforms.texel.value = 1 / SIZE
    pass(Q.edge, R.maskE)
    // 3. the alpha brought to 256 for the solver (a box filter, then one bilinear tap), Jacobi warm-started from last frame,
    //    the max reduced, the field normalised
    Q.blur.uniforms.ch.value.set(0, 1, 0, 0)
    Q.blur.uniforms.radius.value = Math.max(1, Math.round(SIZE / 512))
    Q.blur.uniforms.t.value = R.maskE.texture
    Q.blur.uniforms.dir.value.set(1 / SIZE, 0)
    pass(Q.blur, R.a)
    Q.blur.uniforms.t.value = R.a.texture
    Q.blur.uniforms.dir.value.set(0, 1 / SIZE)
    pass(Q.blur, R.inner)
    Q.blur.uniforms.ch.value.set(1, 0, 0, 0)
    Q.blur.uniforms.radius.value = 0
    Q.blur.uniforms.t.value = R.inner.texture
    Q.blur.uniforms.dir.value.set(0, 0)
    pass(Q.blur, R.pMask)
    Q.poisson.uniforms.mask.value = R.pMask.texture
    Q.poisson.uniforms.ids.value = R.maskE.texture
    let a = R.pA, b = R.pB
    for (let i = 0; i < CUBE.poissonIters; i++) {
      Q.poisson.uniforms.u.value = a.texture
      pass(Q.poisson, b)
      ;[a, b] = [b, a]
    }
    let src: THREE.WebGLRenderTarget = a
    for (const dst of R.red) {
      Q.reduceMax.uniforms.t.value = src.texture
      Q.reduceMax.uniforms.texel.value = 0.25 / dst.width
      pass(Q.reduceMax, dst)
      src = dst
    }
    Q.combinePoisson.uniforms.mask.value = R.maskE.texture
    Q.combinePoisson.uniforms.u.value = a.texture
    Q.combinePoisson.uniforms.umax.value = R.red[R.red.length - 1].texture
    pass(Q.combinePoisson, R.combined)

    // 4. their fragment over the screen (or into the capture)
    const u = Q.final.uniforms
    u.u_image.value = R.combined.texture
    u.u_mask.value = R.maskE.texture
    u.u_asciiMask.value = R.still.texture
    u.u_time.value = state.clock.elapsedTime * LIQUID.speed
    u.u_aspect.value = size.width / size.height
    u.u_resolution.value.set(size.width * dpr, size.height * dpr)
    pass(Q.final, captureOn.current ? shot : null)
  }, 1)

  return (
    <>
      <OrbitControls enablePan={false} enableZoom={false} />
      {/* the mask scene: never rendered by R3F, only by the manual passes above */}
      <scene ref={maskScene}>
        <group ref={root} rotation={[0.5, -0.7, 0]}>
          <RubikMask ref={rubik} gap={CUBE.gap} rounded={CUBE.round} material={Q.face} auto={auto} autoInterval={autoInterval} combo={combo} />
          {/* the un-turned cube's shape, layer 1 only: the ascii outline measures from this */}
          <mesh layers-mask={2} material={Q.face}>
            <boxGeometry args={[3 * CUBE.gap, 3 * CUBE.gap, 3 * CUBE.gap]} />
          </mesh>
        </group>
      </scene>
    </>
  )
}
