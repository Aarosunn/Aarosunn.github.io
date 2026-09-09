/**
 * Versions of the x-ray technical floral for the site's base (the floral tab). Additive: never edit one, append.
 * References: x-ray poppy with data panels · iridescent iris with measure lines · specimen poster with hex
 * swatches and corner frames · peony with file-name callouts and coordinates · scanner video with jittering x/y.
 */
export type FloralVersion = {
  name: string
  /** petals in the outer ring and whether an inner ring sits inside it */
  petals: number
  innerRing: boolean
  /** vertical squash of the bloom (1 = face on, .6 = seen from the side) */
  tilt: number
  /** blurred copy of the bloom and stem under the crisp one, 0 = none */
  glow: number
  /** petal fill opacity (screen blended, so overlaps brighten) and rim opacity */
  body: number
  rim: number
  /** petal tint: one colour, or hue-rotated per petal (iridescent) */
  tint: 'mono' | 'spectral'
  /** stem and leaves as solid off-white silhouette (specimen) instead of x-ray */
  silhouette: boolean
  /** technical layer */
  labels: boolean
  coords: 'off' | 'static' | 'live'
  frame: 'off' | 'bloom' | 'parts'
  arcs: boolean
  ruler: boolean
  swatches: boolean
  measures: boolean
  specks: number
  /** 'mesh': the procedural flower mesh with the fresnel x-ray shader (XrayFlower3D); default the SVG plant */
  kind?: 'svg' | 'mesh'
  /** mesh: wire pass intensity (0 = off) and the fresnel curve */
  wire?: number
  fresnel?: { power: number; gain: number; base: number }
  /** mesh: thin-film sheen on the petals (0..1), CSS blur (px) and opacity of the stem / leaf / bud canvas, centre brightness */
  irid?: number
  blur?: number
  dim?: number
  centreGlow?: number
  note: string
}

const base = { petals: 11, innerRing: true, tilt: 0.78, glow: 0.5, body: 0.16, rim: 0.7, tint: 'mono' as const, silhouette: false, labels: false, coords: 'off' as const, frame: 'off' as const, arcs: false, ruler: true, swatches: false, measures: false, specks: 0 }

export const FLORAL_VERSIONS: FloralVersion[] = [
  { ...base, name: 'v1', note: 'x-ray: translucent petals that brighten where they overlap, veins, a glowing stem, one ruler at the base' },
  { ...base, name: 'v2', labels: true, coords: 'static', frame: 'bloom', note: 'blueprint: v1 with file-name callouts on leaders, a frame with corner marks around the bloom, coordinates at the anchors' },
  { ...base, name: 'v3', tint: 'spectral', petals: 9, tilt: 0.7, glow: 0.7, labels: true, measures: true, note: 'spectral: iridescent petals (hue rotated per petal), measure lines and ticks down the stem, a few callouts' },
  { ...base, name: 'v4', silhouette: true, body: 0.22, rim: 0.85, frame: 'parts', swatches: true, labels: true, note: 'specimen: solid off-white stem and leaves under x-ray petals, hex swatches along the top, square frames with corner marks on the parts' },
  { ...base, name: 'v5', labels: true, coords: 'live', frame: 'parts', arcs: true, specks: 60, glow: 0.6, note: 'scanner: v2 with live x / y readouts that tick, dashed arcs between anchors, tracking frames on petals, specks' },
  { ...base, name: 'v6', kind: 'mesh', wire: 0.14, fresnel: { power: 3.0, gain: 0.85, base: 0.012 }, note: 'mesh x-ray: the procedural flower rendered with a fresnel shader on additive blending, faces see-through, rims and edge-on geometry bright, a wire pass over it' },
  { ...base, name: 'v7', kind: 'mesh', wire: 0.14, fresnel: { power: 3.0, gain: 0.85, base: 0.012 }, labels: true, coords: 'static', frame: 'bloom', note: 'mesh blueprint: v6 with callouts, the bloom frame and coordinates projected from the 3D anchors' },
  { ...base, name: 'v8', kind: 'mesh', wire: 0.2, fresnel: { power: 3.4, gain: 1.0, base: 0.01 }, labels: true, coords: 'live', frame: 'parts', arcs: true, specks: 60, note: 'mesh scanner: denser wire, sharper fresnel, live readouts, arcs, part frames, specks' },
  // flower assets: no technical layer, the bloom is the subject, stem and leaves soft
  { ...base, name: 'v9', kind: 'mesh', ruler: false, wire: 0.12, fresnel: { power: 2.8, gain: 0.9, base: 0.015 }, irid: 0.25, blur: 2.5, dim: 0.55, centreGlow: 0.9, note: 'ghost: the scheme\'s white-blue x-ray on any flower type, a little sheen, stem and leaves blurred and dimmed' },
  { ...base, name: 'v10', kind: 'mesh', tint: 'spectral', ruler: false, wire: 0.1, fresnel: { power: 2.6, gain: 1.0, base: 0.02 }, irid: 0.6, blur: 2.5, dim: 0.5, centreGlow: 0.7, note: 'iridescent: each flower\'s own palette with a thin-film sheen and a warm glowing centre, stem and leaves soft' },
]

export const FLORAL_OF = (name: string) => FLORAL_VERSIONS.find((v) => v.name === name)
