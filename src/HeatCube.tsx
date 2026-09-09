/**
 * paper.design's heatmap (Apache 2.0) on a 3D cube. Their shader is a 2D effect over a
 * preprocessed mask (R = contour blur, G = big blur, B = inner blur of "shape on white").
 * Their preprocessing runs once on the CPU per image; here it runs on the GPU every frame from a
 * render of the cube (black faces, white edges) so the effect follows the cube as you orbit it.
 * The fragment shader itself is theirs, verbatim.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { getShaderColorFromString, heatmapFragmentShader, type HeatmapParams } from '@paper-design/shaders'

// v1: 512 mask, black cube with white edge bars on white, outer glow as on the site.
// v2: 1024 MSAA mask, inverted: the cube body is paper's "outside" (R = 1) and the black background is
//     the shape, so their animated hot band sweeps *inside* the cube; edges are black seams that get the
//     inner glow. Mask G = lambert shade on the faces, 0 on the background; it rides in the combined
//     alpha so their own `a == 0 -> colorBack` branch clips everything beyond the silhouette, and one
//     appended multiply shades the faces so the cube reads 3D.
export type HeatVersion = 'v1' | 'v2'
const SIZE_OF: Record<HeatVersion, number> = { v1: 512, v2: 1024 }
const IMG = 1000 / 1750 // image fraction of the padded canvas

// separable box blur; one pass = one direction
const BLUR = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D t; uniform vec2 dir; uniform int radius;
  void main() {
    float s = 0.0;
    for (int i = -64; i <= 64; i++) {
      if (i < -radius || i > radius) continue;
      s += texture(t, vUv + dir * float(i)).r;
    }
    o = vec4(vec3(s / float(2 * radius + 1)), 1.0);
  }
`
const COMBINE = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D contour; uniform sampler2D big; uniform sampler2D inner; uniform sampler2D mask;
  void main() {
    // alpha = mask G: 1 in v1; in v2 the face shade (> 0) inside and 0 outside (their colorBack branch)
    o = vec4(texture(contour, vUv).r, texture(big, vUv).r, texture(inner, vUv).r, texture(mask, vUv).g);
  }
`
// v2 faces: R = 1 (paper's "outside", where the heat lives), G = lambert shade in view space
const FACE = /* glsl */ `
  precision highp float;
  in vec3 vN; out vec4 o;
  void main() {
    float l = 0.45 + 0.55 * max(dot(normalize(vN), normalize(vec3(0.35, 0.8, 0.6))), 0.0);
    o = vec4(1.0, l, 0.0, 1.0);
  }
`
const FACE_VERT = /* glsl */ `
  in vec3 position; in vec3 normal; out vec3 vN;
  uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform mat3 normalMatrix;
  void main() { vN = normalMatrix * normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const QUAD_VERT = /* glsl */ `
  in vec3 position; in vec2 uv; out vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`
// paper's sizing, fit contain: image uv from screen uv with the preset's scale
const HEAT_VERT = /* glsl */ `
  in vec3 position; in vec2 uv;
  uniform float u_aspect; uniform float u_scale;
  out vec2 v_imageUV; out vec2 v_objectUV;
  void main() {
    vec2 p = (uv - 0.5) * vec2(u_aspect, 1.0) / u_scale;
    v_objectUV = p;
    v_imageUV = p + 0.5;
    gl_Position = vec4(position, 1.0);
  }
`

const rt = (size: number, depth = false, samples = 0) =>
  new THREE.WebGLRenderTarget(size, size, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: depth,
    samples,
  })

export type HeatCubeProps = { params: Omit<HeatmapParams, 'image'>; spin: boolean; hollow: boolean; version: HeatVersion }

export function HeatCube({ params, spin, hollow, version }: HeatCubeProps) {
  const SIZE = SIZE_OF[version]
  const v2 = version === 'v2'
  const cube = useRef<THREE.Mesh>(null!)
  const maskScene = useRef<THREE.Scene>(null!)
  const { gl, camera, size } = useThree()

  const R = useMemo(
    () => ({
      mask: rt(SIZE, true, v2 ? 4 : 0), // depth so the faces hide the back edges; MSAA in v2
      a: rt(SIZE),
      b: rt(SIZE),
      contour: rt(SIZE),
      inner: rt(SIZE),
      bigA: rt(SIZE / 2),
      bigB: rt(SIZE / 2),
      big: rt(SIZE / 2),
      combined: rt(SIZE),
    }),
    [SIZE, v2],
  )
  const quad = useMemo(() => {
    const scene = new THREE.Scene()
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    scene.add(mesh)
    const blur = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: BLUR,
      uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() }, radius: { value: 1 } },
    })
    const combine = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: COMBINE,
      uniforms: { contour: { value: null }, big: { value: null }, inner: { value: null }, mask: { value: null } },
    })
    const heat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: HEAT_VERT,
      // their shader verbatim, plus one appended multiply by the face shade (u_shade = 0 leaves it untouched)
      fragmentShader: heatmapFragmentShader
        .replace('#version 300 es', '')
        .replace('uniform float u_contour;', 'uniform float u_contour; uniform float u_shade;')
        .replace('fragColor = vec4(color, opacity);', 'fragColor = vec4(color, opacity);\n  fragColor.rgb *= mix(1.0, texture(u_image, imgUV).a, u_shade);'),
      uniforms: {
        u_image: { value: null },
        u_time: { value: 0 },
        u_imageAspectRatio: { value: 1 },
        u_colorBack: { value: [0, 0, 0, 1] },
        u_colors: { value: new Float32Array(40) },
        u_colorsCount: { value: 7 },
        u_angle: { value: 0 },
        u_noise: { value: 0 },
        u_innerGlow: { value: 0.5 },
        u_outerGlow: { value: 0.5 },
        u_contour: { value: 0.5 },
        u_shade: { value: 0 },
        u_aspect: { value: 1 },
        u_scale: { value: 0.75 },
      },
    })
    const face = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: FACE_VERT, fragmentShader: FACE })
    return { scene, cam, mesh, blur, combine, heat, face }
  }, [])

  useEffect(
    () => () => {
      Object.values(R).forEach((t) => t.dispose())
      quad.blur.dispose()
      quad.combine.dispose()
      quad.heat.dispose()
      quad.face.dispose()
    },
    [R, quad],
  )

  // preset -> uniforms
  useEffect(() => {
    const u = quad.heat.uniforms
    const colors = (params.colors ?? []).map(getShaderColorFromString)
    // three wants vec4[] flat
    const flat = new Float32Array(40)
    colors.forEach((c, i) => flat.set(c, i * 4))
    u.u_colors.value = flat
    u.u_colorsCount.value = colors.length
    u.u_colorBack.value = getShaderColorFromString(params.colorBack ?? '#000000')
    u.u_angle.value = params.angle ?? 0
    u.u_noise.value = params.noise ?? 0
    u.u_innerGlow.value = params.innerGlow ?? 0.5
    u.u_outerGlow.value = params.outerGlow ?? 0.5
    u.u_shade.value = v2 ? 0.55 : 0
    u.u_contour.value = params.contour ?? 0.5
    u.u_scale.value = params.scale ?? 0.75
  }, [params, quad, v2])

  const pass = (mat: THREE.RawShaderMaterial, target: THREE.WebGLRenderTarget) => {
    quad.mesh.material = mat
    gl.setRenderTarget(target)
    gl.render(quad.scene, quad.cam)
  }
  const boxBlur = (src: THREE.WebGLRenderTarget, tmp: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget, radius: number, passes: number) => {
    const texel = 1 / src.width
    let input = src
    for (let p = 0; p < passes; p++) {
      quad.blur.uniforms.radius.value = radius
      quad.blur.uniforms.t.value = input.texture
      quad.blur.uniforms.dir.value.set(texel, 0)
      pass(quad.blur, tmp)
      quad.blur.uniforms.t.value = tmp.texture
      quad.blur.uniforms.dir.value.set(0, texel)
      pass(quad.blur, dst)
      input = dst
    }
  }

  useFrame((state, dt) => {
    if (spin) cube.current.rotation.y += dt * 0.35
    const t = state.clock.elapsedTime
    const cam = camera as THREE.PerspectiveCamera
    const aspect = cam.aspect

    // 1. mask: cube on white, square, cube inside the central "image" region
    cam.aspect = 1
    cam.updateProjectionMatrix()
    const prevClear = gl.getClearColor(new THREE.Color())
    gl.setClearColor(v2 ? '#000000' : '#ffffff', 1) // v2: background is the shape, G = 0 clips it
    gl.setRenderTarget(R.mask)
    gl.clear()
    gl.render(maskScene.current, cam)
    gl.setClearColor(prevClear, 1)
    cam.aspect = aspect
    cam.updateProjectionMatrix()

    // 2. their three blurs, radii scaled from a 1750px canvas
    const px = (r: number, w: number) => Math.max(1, Math.round((r / 1750) * w))
    boxBlur(R.mask, R.a, R.contour, px(5, SIZE), 1)
    boxBlur(R.mask, R.a, R.inner, px(18, SIZE), 3)
    // big blur at half res: downsample by blurring with radius 0 into bigA
    quad.blur.uniforms.radius.value = 0
    quad.blur.uniforms.t.value = R.mask.texture
    quad.blur.uniforms.dir.value.set(0, 0)
    pass(quad.blur, R.bigA)
    // v2: wider big blur so the sweep reaches into the faces instead of hugging the rim
    boxBlur(R.bigA, R.bigB, R.big, px(v2 ? 260 : 150, SIZE / 2), 3)

    quad.combine.uniforms.contour.value = R.contour.texture
    quad.combine.uniforms.big.value = R.big.texture
    quad.combine.uniforms.inner.value = R.inner.texture
    quad.combine.uniforms.mask.value = R.mask.texture
    pass(quad.combine, R.combined)

    // 3. their fragment shader over the screen
    quad.heat.uniforms.u_image.value = R.combined.texture
    quad.heat.uniforms.u_time.value = t
    quad.heat.uniforms.u_aspect.value = size.width / size.height
    quad.mesh.material = quad.heat
    gl.setRenderTarget(null)
    gl.render(quad.scene, quad.cam)
  }, 1)

  return (
    <>
      <OrbitControls enablePan={false} enableZoom={false} />
      {/* the mask scene: never rendered by R3F, only by the manual pass above */}
      <scene ref={maskScene}>
        <mesh ref={cube} rotation={[0.5, -0.7, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          {/* hollow: drop the faces so every edge shows through. v2 faces write the shade into G */}
          {v2 ? (
            <primitive object={quad.face} attach="material" visible={!hollow} />
          ) : (
            <meshBasicMaterial color="#000000" visible={!hollow} />
          )}
          {/* v1 solid: white edges cut lines into the shape. v2: half-grey hairline seams. hollow: black edges are the shape */}
          <EdgeBars
            size={1}
            width={hollow ? 0.06 : v2 ? 0.007 : 0.035}
            color={hollow ? '#000000' : v2 ? '#000000' : '#ffffff'}
          />
        </mesh>
      </scene>
    </>
  )
}

/** The 12 cube edges as thin white bars, so they survive the mask render and feed paper's contour channel. */
function EdgeBars({ size, width, color }: { size: number; width: number; color: string }) {
  const h = size / 2
  const bars: { pos: [number, number, number]; dims: [number, number, number] }[] = []
  for (const a of [-h, h])
    for (const b of [-h, h]) {
      bars.push({ pos: [0, a, b], dims: [size + width, width, width] })
      bars.push({ pos: [a, 0, b], dims: [width, size + width, width] })
      bars.push({ pos: [a, b, 0], dims: [width, width, size + width] })
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
