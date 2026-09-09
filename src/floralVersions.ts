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
  note: string
}

const base = { petals: 11, innerRing: true, tilt: 0.78, glow: 0.5, body: 0.16, rim: 0.7, tint: 'mono' as const, silhouette: false, labels: false, coords: 'off' as const, frame: 'off' as const, arcs: false, ruler: true, swatches: false, measures: false, specks: 0 }

export const FLORAL_VERSIONS: FloralVersion[] = [
  { ...base, name: 'v1', note: 'x-ray: translucent petals that brighten where they overlap, veins, a glowing stem, one ruler at the base' },
  { ...base, name: 'v2', labels: true, coords: 'static', frame: 'bloom', note: 'blueprint: v1 with file-name callouts on leaders, a frame with corner marks around the bloom, coordinates at the anchors' },
  { ...base, name: 'v3', tint: 'spectral', petals: 9, tilt: 0.7, glow: 0.7, labels: true, measures: true, note: 'spectral: iridescent petals (hue rotated per petal), measure lines and ticks down the stem, a few callouts' },
  { ...base, name: 'v4', silhouette: true, body: 0.22, rim: 0.85, frame: 'parts', swatches: true, labels: true, note: 'specimen: solid off-white stem and leaves under x-ray petals, hex swatches along the top, square frames with corner marks on the parts' },
  { ...base, name: 'v5', labels: true, coords: 'live', frame: 'parts', arcs: true, specks: 60, glow: 0.6, note: 'scanner: v2 with live x / y readouts that tick, dashed arcs between anchors, tracking frames on petals, specks' },
]

export const FLORAL_OF = (name: string) => FLORAL_VERSIONS.find((v) => v.name === name)
