/**
 * Versions of "paper shader on the Rubik's cube" (the shader cube tab). Additive: never edit one, append.
 * Renumbered 2026-09-09 after the morning cull; the whole-face "cube plate" ones moved to the paper tab (CUBE_DEMOS).
 */
export type PaperShader = 'heat' | 'liquid' | 'smoke'

/** a theme picks a shader + preset and may override version fields (a heat theme on a liquid version) */
export type PaperTheme = { name: string; shader: PaperShader; preset: string; over?: Partial<PaperVersion> }

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
  /** seams and plates from the geometry's uv (v1-v11 look) or from local geometry (true edges on rounded cubies after turns) */
  seamSpace: 'uv' | 'geometry'
  /** how the mask alpha reaches the 256² Poisson grid: box blur (v1-v11) or min filter (hairline seams stay holes) */
  poissonDown: 'blur' | 'min'
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
  /** when set, the preset row shows these themes instead of the shader's presets */
  themes?: PaperTheme[]
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
  seamSpace: 'uv' as const,
  poissonDown: 'blur' as const,
  blur: { contour: 5, inner: 18, big: 150 },
  bigDiv: 2 as const,
}
const heat = { ...base, shader: 'heat' as const, rubikGap: 1.03, seam: 0.035, camZ: 20 }
const liquid = { ...base, shader: 'liquid' as const, camZ: 11 }
const smoke = { ...base, shader: 'smoke' as const, camZ: 11, halo: false, shade: 0.3 }

export const PAPER_VERSIONS: PaperVersion[] = [
  { ...heat, name: 'v1', note: "heatmap on the Rubik's cube: rim glow on every seam, halo, the hot band sweeping the base" },
  { ...heat, name: 'v2', halo: false, shade: 0.45, note: 'v1 without the halo, faces shaded' },
  { ...liquid, name: 'v3', field: 'face', note: 'liquid metal: one plate per cubie face, a grid of chrome buttons' },
  { ...heat, name: 'v4', seam: 0.02, halo: false, shade: 0.45, preset: 'icemint slow', note: 'hairline seams, icemint, no halo, slower' },
  { ...liquid, name: 'v5', field: 'poisson', shade: 0.4, preset: 'noir slow', note: 'liquid metal with the silhouette Poisson field: one blob of chrome, seams only where a turn splits it' },
  { ...liquid, name: 'v6', field: 'poisson', seam: 0.04, halo: false, shade: 0.35, note: 'liquid metal, true Poisson per cubie face (seams as boundaries): 27 chrome cubies' },
  { ...heat, name: 'v7', preset: 'icemint', fuse: 'liquid', fusePreset: 'ice', shade: 0.3, note: 'fusion: heat seams and halo over liquid-metal cubie faces (ice)' },
  { ...heat, name: 'v8', seam: 0.02, preset: 'icemint', bigDiv: 4, note: 'icemint hairline seams with the big blur at quarter res: same look, cheaper on integrated GPUs' },
  { ...heat, name: 'v9', rubikRound: 0.06, seam: 0.012, preset: 'icemint', note: 'rounded cubies with a hairline seam: soft corners, thin glow' },
  { ...liquid, name: 'v10', field: 'poisson', rubikRound: 0.07, seam: 0.03, shade: 0.35, preset: 'ice', note: 'liquid metal on rounded cubies, Poisson per cubie: 27 chrome pillows' },
  {
    ...liquid,
    name: 'v11',
    field: 'poisson',
    poissonIters: 60,
    rubikRound: 0.07,
    seam: 0.03,
    halo: false,
    shade: 0.35,
    preset: 'ice',
    // all liquid metal: the heatmap / icemint themes are v10's chrome with its luminance run through the palette
    themes: ['default', 'backdrop', 'heatmap', 'heatmap grain', 'ice', 'mint', 'icemint', 'icemint grain'].map((name) => ({ name, shader: 'liquid' as const, preset: name })),
    note: "v10's cube and effect for the site: eight colour themes on the scheme's background, nothing outside the cube, brightness and opacity to taste",
  },
  {
    ...liquid,
    name: 'v12',
    field: 'poisson',
    poissonIters: 60,
    poissonDown: 'min',
    seamSpace: 'geometry',
    rubikRound: 0.07,
    seam: 0.03,
    halo: false,
    shade: 0.35,
    preset: 'ice',
    themes: ['default', 'backdrop', 'heatmap', 'heatmap grain', 'ice', 'mint', 'icemint', 'icemint grain'].map((name) => ({ name, shader: 'liquid' as const, preset: name })),
    note: 'v11 with seams and plates from the geometry (true edges on rounded cubies after turns) and a min-filtered Poisson mask: thinner seams, crisper plates',
  },
  {
    ...liquid,
    name: 'v13',
    field: 'poisson',
    poissonIters: 60,
    seamSpace: 'geometry',
    rubikRound: 0.07,
    seam: 0.04,
    halo: false,
    shade: 0.35,
    preset: 'ice',
    themes: ['default', 'backdrop', 'heatmap', 'heatmap grain', 'ice', 'mint', 'icemint', 'icemint grain'].map((name) => ({ name, shader: 'liquid' as const, preset: name })),
    note: "v11's look (soft blurred mask, thin seams) with seams and plates measured from the geometry, so nothing drifts after turns",
  },
]

/** paper tab: the shaders on a plain-looking cube (whole-face plates hide the cubies until a layer turns) */
export const CUBE_DEMOS: PaperVersion[] = [
  { ...liquid, size: 512, camZ: 8, name: 'liquid metal', field: 'cube', note: 'one plate per cube face, in cube space' },
  { ...smoke, size: 512, camZ: 8, name: 'gem smoke', field: 'cube', note: 'one plate per cube face, no outer smoke' },
  { ...liquid, size: 512, camZ: 8, name: 'noir', field: 'cube', shade: 0.4, preset: 'noir slow', note: 'dark chrome, slow' },
  { ...smoke, size: 512, camZ: 8, name: 'icemint smoke', field: 'cube', preset: 'icemint', note: 'glassy marble on the dark scheme' },
]

export const VERSION_OF = (name: string) => PAPER_VERSIONS.find((v) => v.name === name)

/** the version to render for a theme (its fields overridden), or the version itself */
export const withTheme = (v: PaperVersion, theme?: PaperTheme): PaperVersion => (theme ? { ...v, ...theme.over, shader: theme.shader } : v)
