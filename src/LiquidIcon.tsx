/**
 * A logo in the cube's material: the silhouette (an SVG path) becomes the mask the cube's pipeline expects, the Poisson
 * field is solved over it once (a static shape), and paper's liquid metal runs over it with the same tail as the cube.
 * The whole thing is one small canvas; clicking it follows the link.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { COMBINE_POISSON, FINAL_VERT, POISSON, QUAD_VERT, REDUCE_MAX, finalFragment, finalUniforms, frt, rt } from './PaperCube'
import { CUBE } from './cube'

export type IconLook = {
  name: string
  /** 'pillow': the Poisson field (the cube's chrome pillow, high at the edge, deep in the middle); 'flat': no field, paper's stripes alone */
  field: 'pillow' | 'flat'
  /** the ascii trail off the silhouette, as on the cube */
  ascii: boolean
  /** paper's scale (how much of the canvas the mask spans) and speed at rest; hover multiplies the speed */
  scale: number
  speed: number
  hoverSpeed: number
  /** the silhouette's edge softness in mask texels (0 = hard) */
  soften: number
  note: string
}

/** the mask the pipeline expects: R = cubie id (one shape, one id), G = inside, B = lambert (flat), A = depth */
function maskTexture(path: string, box: number, size: number, soften: number) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = 'rgb(128, 0, 255)' // outside: R .5 (an id all the same), G 0, B 1
  g.fillRect(0, 0, size, size)
  const pad = size * 0.1 // room around the mark for the pillow's rim and the ascii trail
  g.save()
  g.translate(pad, pad)
  g.scale((size - 2 * pad) / box, (size - 2 * pad) / box)
  if (soften > 0) g.filter = `blur(${soften / ((size - 2 * pad) / box)}px)`
  g.fillStyle = 'rgb(128, 255, 255)' // inside: G 1
  g.fill(new Path2D(path))
  g.restore()
  const t = new THREE.CanvasTexture(c) // flipY (the default) stores it y-up, like the cube's render-target mask
  t.minFilter = t.magFilter = THREE.LinearFilter
  return t
}

function Liquid({ path, box, look, hover }: { path: string; box: number; look: IconLook; hover: boolean }) {
  const { gl, size } = useThree()
  const SIZE = 512
  const mask = useMemo(() => maskTexture(path, box, SIZE, look.soften), [path, box, look.soften])
  useEffect(() => () => mask.dispose(), [mask])
  const R = useMemo(() => ({ a: rt(SIZE), pMask: rt(256), pA: frt(256), pB: frt(256), red: [128, 64, 32, 16, 8, 4, 2, 1].map(frt), combined: rt(SIZE) }), [])
  const Q = useMemo(() => {
    const scene = new THREE.Scene()
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    scene.add(mesh)
    const raw = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, vertexShader = QUAD_VERT) => new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader, fragmentShader, uniforms })
    return {
      scene, cam, mesh,
      copy: raw(`precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D t; void main() { o = texture(t, vUv); }`, { t: { value: null } }),
      poisson: raw(POISSON, { u: { value: null }, mask: { value: null }, ids: { value: null }, texel: { value: 1 / 256 }, thresh: { value: CUBE.poissonThresh } }),
      reduceMax: raw(REDUCE_MAX, { t: { value: null }, texel: { value: 1 / 128 } }),
      combinePoisson: raw(COMBINE_POISSON, { mask: { value: null }, u: { value: null }, umax: { value: null } }),
      flat: raw(`precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D mask; void main() { vec4 m = texture(mask, vec2(vUv.x, 1.0 - vUv.y)); o = vec4(0.5, m.g, 1.0, 1.0); }`, { mask: { value: null } }),
      final: raw(finalFragment(), finalUniforms(), FINAL_VERT),
    }
  }, [])
  useEffect(() => () => { Object.values(R).forEach((t) => (Array.isArray(t) ? t.forEach((x) => x.dispose()) : t.dispose())); [Q.copy, Q.poisson, Q.reduceMax, Q.combinePoisson, Q.flat, Q.final].forEach((m) => m.dispose()); Q.mesh.geometry.dispose() }, [R, Q])
  const pass = (mat: THREE.RawShaderMaterial, target: THREE.WebGLRenderTarget | null) => { Q.mesh.material = mat; gl.setRenderTarget(target); gl.render(Q.scene, Q.cam) }
  // the field once: the shape never moves
  const solved = useRef(false)
  useEffect(() => { solved.current = false }, [mask, look.field])
  const speed = useRef(look.speed)
  useFrame((state) => {
    if (!solved.current) {
      Q.copy.uniforms.t.value = mask
      pass(Q.copy, R.a)
      if (look.field === 'pillow') {
        pass(Q.copy, R.pMask)
        Q.poisson.uniforms.mask.value = R.pMask.texture
        Q.poisson.uniforms.ids.value = R.a.texture
        let a = R.pA, b = R.pB
        // a static shape: solve to convergence once
        for (let i = 0; i < 400; i++) { Q.poisson.uniforms.u.value = a.texture; pass(Q.poisson, b); [a, b] = [b, a] }
        let src: THREE.WebGLRenderTarget = a
        for (const dst of R.red) { Q.reduceMax.uniforms.t.value = src.texture; Q.reduceMax.uniforms.texel.value = 0.25 / dst.width; pass(Q.reduceMax, dst); src = dst }
        Q.combinePoisson.uniforms.mask.value = R.a.texture
        Q.combinePoisson.uniforms.u.value = a.texture
        Q.combinePoisson.uniforms.umax.value = R.red[R.red.length - 1].texture
        pass(Q.combinePoisson, R.combined)
      } else {
        Q.flat.uniforms.mask.value = R.a.texture
        pass(Q.flat, R.combined)
      }
      solved.current = true
    }
    // hover eases the speed up and back
    speed.current += ((hover ? look.hoverSpeed : look.speed) - speed.current) * 0.08
    const u = Q.final.uniforms
    u.u_image.value = R.combined.texture
    u.u_mask.value = R.a.texture
    u.u_asciiMask.value = R.a.texture
    u.u_asciiMul.value = look.ascii ? 1 : 0
    u.u_asciiCell.value = CUBE.ascii.cell * gl.getPixelRatio() * 0.8
    u.u_scale.value = look.scale
    u.u_time.value = state.clock.elapsedTime * speed.current
    u.u_aspect.value = size.width / size.height
    u.u_resolution.value.set(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio())
    pass(Q.final, null)
  }, 1)
  return null
}

export function LiquidIcon({ path, box, href, label, look, px = 96 }: { path: string; box: number; href: string; label: string; look: IconLook; px?: number }) {
  const [hover, setHover] = useState(false)
  return (
    <a className="liquid-icon" href={href} target="_blank" rel="noreferrer" aria-label={label} style={{ width: px, height: px }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Canvas dpr={[1, 2]} gl={{ antialias: false, alpha: false, powerPreference: 'low-power' }} frameloop="always" style={{ position: 'absolute', inset: 0 }}>
        <Liquid path={path} box={box} look={look} hover={hover} />
      </Canvas>
    </a>
  )
}

/** GitHub's mark (octicon mark-github, 16 box) and LinkedIn's (24 box) */
export const GITHUB = { box: 16, path: 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z' }
export const LINKEDIN = { box: 24, path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' }
