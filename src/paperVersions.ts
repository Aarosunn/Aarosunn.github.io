/**
 * Versions of "paper shader on a 3D shape" (the shader cube tab). Additive: never edit one, append.
 * v1/v2 live in HeatCube.tsx (frozen); v3+ run through PaperCube.tsx.
 */
export type PaperShader = 'heat' | 'liquid' | 'smoke'
export type PaperShape = 'box' | 'rounded' | 'octa' | 'cage' | 'rubik'

export type PaperVersion = {
  name: string
  shader: PaperShader
  shape: PaperShape
  /** mask render target size (square) */
  size: number
  /** edge bars width in cube units (0 = none) and their mask value (1 = white / boundary, 0 = black) */
  seam: number
  seamValue: number
  /** heat only: 'solid' = the shape is black on white (site-faithful); 'inverted' = faces white, background black; 'cage' = faces white, seams black, background white (hidden-line) */
  polarity: 'solid' | 'inverted' | 'cage'
  /** let the effect exist beyond the silhouette (heat halo / outer smoke) */
  halo: boolean
  /** multiply the final colour by the lambert shade of the faces, 0..1 */
  shade: number
  /** liquid/smoke: R field from each geometry face's uv (analytic Poisson-ish), from the whole cube face in cube space (rubik plates), or from a blurred silhouette */
  field: 'face' | 'cube' | 'blur' | 'poisson'
  /** poisson: Jacobi iterations per frame at 256² (warm-started, so ~30 keeps up with motion) */
  poissonIters: number
  /** rubik: cubie spacing (1 = touching) */
  rubikGap: number
  /** rubik: cubie corner radius (0 = sharp) */
  rubikRound: number
  /** liquid/smoke face field sharpness: field = 1 - (bx*by)^k */
  fieldK: number
  /** heat blur radii in paper's 1750px canvas units */
  blur: { contour: number; inner: number; big: number }
  /** heat: run the big blur at SIZE / bigDiv (2 = as paper's canvas; 4 = cheaper, for integrated GPUs) */
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
  seamValue: 1,
  polarity: 'solid' as const,
  halo: true,
  shade: 0,
  field: 'face' as const,
  rubikGap: 1,
  rubikRound: 0,
  poissonIters: 30,
  fieldK: 0.75,
  blur: { contour: 5, inner: 18, big: 150 },
  bigDiv: 2 as const,
  camZ: 7,
}

export const PAPER_VERSIONS: PaperVersion[] = [
  { ...base, name: 'v3', shader: 'heat', shape: 'box', seam: 0.012, note: 'site-faithful heatmap: solid black box on white, hairline white seams, halo, MSAA 1024' },
  { ...base, name: 'v4', shader: 'heat', shape: 'cage', seam: 0.03, seamValue: 0, note: 'hidden-line cage: white faces occlude, black strokes on the visible edges are the shape' },
  { ...base, name: 'v5', shader: 'liquid', shape: 'box', camZ: 3.9, note: 'liquid metal: each face its own Poisson-like plate, stripes flow across the silhouette' },
  { ...base, name: 'v6', shader: 'smoke', shape: 'box', camZ: 3.9, note: 'gem smoke: inner swirl per face field, outer smoke around the silhouette' },
  { ...base, name: 'v7', shader: 'heat', shape: 'box', seam: 0.012, halo: false, shade: 0.45, note: 'v3 without the background halo, faces shaded by lambert' },
  { ...base, name: 'v8', shader: 'liquid', shape: 'box', camZ: 3.9, shade: 0.35, note: 'v5 with lambert shade on the faces for depth' },
  { ...base, name: 'v9', shader: 'smoke', shape: 'box', camZ: 3.9, halo: false, shade: 0.3, note: 'v6 without the outer smoke, shaded faces' },
  // Rubik's cube as the mask
  { ...base, name: 'v10', shader: 'heat', shape: 'rubik', rubikGap: 1.03, seam: 0.035, camZ: 20, note: 'heatmap on the Rubik\'s cube: the cubie gaps are the seams, rim glow follows every edge through turns' },
  { ...base, name: 'v11', shader: 'liquid', shape: 'rubik', field: 'cube', camZ: 11, note: 'liquid metal on the Rubik\'s cube: whole-face plates in cube space that split with the turning layer' },
  { ...base, name: 'v12', shader: 'smoke', shape: 'rubik', field: 'cube', camZ: 11, halo: false, shade: 0.3, note: 'gem smoke on the Rubik\'s cube: face plates, no outer smoke' },
  { ...base, name: 'v13', shader: 'heat', shape: 'rubik', rubikGap: 1.03, seam: 0.035, camZ: 20, halo: false, shade: 0.45, note: 'v10 without the halo' },
  { ...base, name: 'v14', shader: 'liquid', shape: 'rubik', field: 'face', camZ: 11, note: 'liquid metal on the Rubik\'s cube: one plate per cubie face' },
  { ...base, name: 'v15', shader: 'smoke', shape: 'rubik', field: 'face', camZ: 11, halo: false, shade: 0.3, note: 'gem smoke on the Rubik\'s cube: one plate per cubie face, no outer smoke' },
  // polish round: aarcube palettes, slower, thinner seams
  { ...base, name: 'v16', shader: 'heat', shape: 'rubik', rubikGap: 1.03, seam: 0.02, camZ: 20, preset: 'icemint', note: 'v10 with hairline seams and the icemint palette' },
  { ...base, name: 'v17', shader: 'liquid', shape: 'rubik', field: 'cube', camZ: 11, shade: 0.4, preset: 'noir slow', note: 'liquid metal Rubik\'s, noir, slow, shaded: dark chrome' },
  { ...base, name: 'v18', shader: 'smoke', shape: 'rubik', field: 'cube', camZ: 11, halo: false, shade: 0.3, preset: 'icemint', note: 'gem smoke Rubik\'s in icemint on the dark scheme, no outer smoke' },
  { ...base, name: 'v19', shader: 'heat', shape: 'rubik', rubikGap: 1.03, seam: 0.02, camZ: 20, halo: false, shade: 0.45, preset: 'icemint slow', note: 'v16 without the halo, slower' },
  // hidden-line Rubik's + true Poisson fields
  { ...base, name: 'v20', shader: 'heat', shape: 'rubik', rubikGap: 1.03, seam: 0.05, camZ: 20, polarity: 'cage', preset: 'icemint', note: 'hidden-line Rubik\'s cage: white cubies occlude, black seams are the shape' },
  { ...base, name: 'v21', shader: 'liquid', shape: 'rounded', field: 'poisson', camZ: 3.9, shade: 0.3, note: 'liquid metal with their real Poisson field (GPU Jacobi) on the rounded box' },
  { ...base, name: 'v22', shader: 'smoke', shape: 'octa', field: 'poisson', camZ: 3.9, halo: false, shade: 0.3, preset: 'icemint', note: 'gem smoke, Poisson field, octahedron, icemint, no outer smoke' },
  { ...base, name: 'v23', shader: 'liquid', shape: 'rubik', field: 'poisson', camZ: 11, shade: 0.4, preset: 'noir slow', note: 'liquid metal Rubik\'s with the silhouette Poisson field: one blob of chrome, seams from turns only' },
  // per-cubie Poisson: seams are holes in the alpha, every cubie face is its own paper shape
  { ...base, name: 'v24', shader: 'liquid', shape: 'rubik', field: 'poisson', seam: 0.04, camZ: 11, shade: 0.35, note: 'liquid metal Rubik\'s, true Poisson per cubie face (seams as boundaries): 27 chrome cubies' },
  { ...base, name: 'v25', shader: 'smoke', shape: 'rubik', field: 'poisson', seam: 0.04, camZ: 11, halo: false, shade: 0.3, preset: 'icemint', note: 'gem smoke Rubik\'s, Poisson per cubie face, icemint, no outer smoke' },
  { ...base, name: 'v26', shader: 'liquid', shape: 'rubik', field: 'poisson', seam: 0.04, camZ: 11, shade: 0.35, preset: 'noir slow', note: 'v24 in noir, slow' },
  // fusions: heat seams + halo over another paper shader on the faces
  { ...base, name: 'v27', shader: 'heat', shape: 'rubik', rubikGap: 1.03, seam: 0.035, camZ: 20, preset: 'icemint', fuse: 'liquid', fusePreset: 'ice', shade: 0.3, note: 'fusion: heat seams and halo over liquid-metal cubie faces (ice)' },
  { ...base, name: 'v28', shader: 'heat', shape: 'rubik', rubikGap: 1.03, seam: 0.035, camZ: 20, preset: 'icemint', fuse: 'smoke', fusePreset: 'icemint', shade: 0.3, note: 'fusion: heat seams and halo over gem-smoke cubie faces (icemint)' },
  { ...base, name: 'v29', shader: 'heat', shape: 'box', seam: 0.012, camZ: 7, fuse: 'liquid', fusePreset: 'noir slow', shade: 0.3, note: 'fusion on the plain box: paper heat rim over noir liquid metal' },
  { ...base, name: 'v30', shader: 'smoke', shape: 'rubik', field: 'poisson', seam: 0.04, camZ: 11, shade: 0.3, preset: 'icemint', note: 'gem smoke Rubik\'s per cubie with its outer plume kept, icemint on dark' },
  { ...base, name: 'v31', shader: 'heat', shape: 'rubik', rubikGap: 1.03, seam: 0.035, camZ: 20, preset: 'icemint', bigDiv: 4, note: 'v16 with the big blur at quarter res: same look, cheaper on integrated GPUs' },
  { ...base, name: 'v32', shader: 'heat', shape: 'rubik', rubikGap: 1.03, seam: 0.035, camZ: 20, polarity: 'inverted', halo: false, shade: 0.5, preset: 'icemint', note: 'inverted polarity (the old v2 idea through the new pipeline): the band sweeps the faces, seams dark' },
  { ...base, name: 'v33', shader: 'heat', shape: 'rubik', rubikGap: 1.03, rubikRound: 0.08, seam: 0.035, camZ: 20, preset: 'icemint', note: 'rounded cubies (r .08): the bevel widens the painted seam into pillowed tiles with broad glowing gaps' },
  { ...base, name: 'v34', shader: 'heat', shape: 'rubik', rubikGap: 1.03, rubikRound: 0.06, seam: 0.012, camZ: 20, preset: 'icemint', note: 'rounded cubies with a hairline seam: softer corners, thin glow' },
  { ...base, name: 'v35', shader: 'liquid', shape: 'rubik', field: 'poisson', rubikRound: 0.07, seam: 0.03, camZ: 11, shade: 0.35, preset: 'ice', note: 'liquid metal on rounded cubies, Poisson per cubie: 27 chrome pillows' },
]

export const VERSION_OF = (name: string) => PAPER_VERSIONS.find((v) => v.name === name)
