/**
 * Versions of "paper shader on the Rubik's cube" (the shader cube tab). Additive: never edit one, append.
 * Renumbered 2026-09-09 after the overnight cull (old v10 v11 v12 v13 v14 v17 v18 v19 v23 v24 v27 v31 v34 v35).
 */
export type PaperShader = 'heat' | 'liquid' | 'smoke'

export type PaperVersion = {
  name: string
  shader: PaperShader
  /** mask render target size (square) */
  size: number
  /** seam hairline painted along each cubie face border, in face-uv units (0 = none) */
  seam: number
  /** let the effect exist beyond the silhouette (heat halo / outer smoke) */
  halo: boolean
  /** multiply the final colour by the lambert shade of the faces, 0..1 */
  shade: number
  /** liquid/smoke R field: analytic plate per cubie face, per whole cube face in cube space, or the real Poisson field per cubie */
  field: 'face' | 'cube' | 'poisson'
  /** plate sharpness: field = 1 - (bx*by)^k */
  fieldK: number
  /** cubie spacing (1 = touching) and corner radius (0 = sharp) */
  rubikGap: number
  rubikRound: number
  /** poisson: Jacobi iterations per frame at 256² (warm-started) */
  poissonIters: number
  /** heat blur radii in paper's 1750px canvas units */
  blur: { contour: number; inner: number; big: number }
  /** heat: run the big blur at size / bigDiv (2 = as paper's canvas; 4 = cheaper, for integrated GPUs) */
  bigDiv: 2 | 4
  /** camera distance */
  camZ: number
  /** default preset name (lowercase) in the preset row */
  preset?: string
  /** heat only: composite a second paper shader onto the faces (heat keeps the halo and seam rims) */
  fuse?: 'liquid' | 'smoke'
  fusePreset?: string
  note: string
}

const base = {
  size: 1024,
  seam: 0,
  halo: true,
  shade: 0,
  field: 'face' as const,
  fieldK: 0.75,
  rubikGap: 1,
  rubikRound: 0,
  poissonIters: 30,
  blur: { contour: 5, inner: 18, big: 150 },
  bigDiv: 2 as const,
}
const heat = { ...base, shader: 'heat' as const, rubikGap: 1.03, seam: 0.035, camZ: 20 }
const liquid = { ...base, shader: 'liquid' as const, camZ: 11 }
const smoke = { ...base, shader: 'smoke' as const, camZ: 11, halo: false, shade: 0.3 }

export const PAPER_VERSIONS: PaperVersion[] = [
  { ...heat, name: 'v1', note: "heatmap on the Rubik's cube: rim glow on every seam, halo, the hot band sweeping the base" },
  { ...liquid, name: 'v2', field: 'cube', note: 'liquid metal: one plate per cube face in cube space, splits with the turning layer' },
  { ...smoke, name: 'v3', field: 'cube', note: 'gem smoke: one plate per cube face, no outer smoke' },
  { ...heat, name: 'v4', halo: false, shade: 0.45, note: 'v1 without the halo, faces shaded' },
  { ...liquid, name: 'v5', field: 'face', note: 'liquid metal: one plate per cubie face, a grid of chrome buttons' },
  { ...liquid, name: 'v6', field: 'cube', shade: 0.4, preset: 'noir slow', note: 'liquid metal noir, slow, shaded: dark chrome' },
  { ...smoke, name: 'v7', field: 'cube', preset: 'icemint', note: 'gem smoke in icemint on the dark scheme: glassy marble faces' },
  { ...heat, name: 'v8', seam: 0.02, halo: false, shade: 0.45, preset: 'icemint slow', note: 'hairline seams, icemint, no halo, slower' },
  { ...liquid, name: 'v9', field: 'poisson', shade: 0.4, preset: 'noir slow', note: 'liquid metal with the silhouette Poisson field: one blob of chrome, seams only where a turn splits it' },
  { ...liquid, name: 'v10', field: 'poisson', seam: 0.04, halo: false, shade: 0.35, note: 'liquid metal, true Poisson per cubie face (seams as boundaries): 27 chrome cubies' },
  { ...heat, name: 'v11', preset: 'icemint', fuse: 'liquid', fusePreset: 'ice', shade: 0.3, note: 'fusion: heat seams and halo over liquid-metal cubie faces (ice)' },
  { ...heat, name: 'v12', seam: 0.02, preset: 'icemint', bigDiv: 4, note: 'icemint hairline seams with the big blur at quarter res: same look, cheaper on integrated GPUs' },
  { ...heat, name: 'v13', rubikRound: 0.06, seam: 0.012, preset: 'icemint', note: 'rounded cubies with a hairline seam: soft corners, thin glow' },
  { ...liquid, name: 'v14', field: 'poisson', rubikRound: 0.07, seam: 0.03, shade: 0.35, preset: 'ice', note: 'liquid metal on rounded cubies, Poisson per cubie: 27 chrome pillows' },
]

export const VERSION_OF = (name: string) => PAPER_VERSIONS.find((v) => v.name === name)
