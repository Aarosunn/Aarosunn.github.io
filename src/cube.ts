/**
 * The cube's look: paper.design's liquid metal over a Rubik's cube of 27 rounded cubies, mint with grain, an ascii
 * outline trailing off to the right. These are the numbers the lab settled on (shader cube v18, mint grain).
 */
import { THEME } from './theme'

export const CUBE = {
  /** mask render target size (square); narrow screens get 768 for integrated GPUs */
  size: 1024,
  /** hairline seam along each cubie face border, in cubie units */
  seam: 0.03,
  /** multiply the colour by the lambert shade of the faces */
  shade: 0.35,
  /** plate sharpness of the per-face field */
  fieldK: 0.75,
  /** cubie spacing (1 = touching) and corner radius */
  gap: 1,
  round: 0.07,
  /** Jacobi iterations per frame for the Poisson field at 256², warm-started */
  poissonIters: 60,
  /** alpha threshold that counts as inside for the solver */
  poissonThresh: 0.5,
  /** camera distance */
  camZ: 11,
  /** the ascii outline: glyph cell (css px), reach into the page (mask uv), the extra reach to the left (glyphs trail right),
   *  random drop-out, the colour by the cube and the colour the tips fade to, how much shorter straight up and down, the
   *  ordered dither, how much the far glyphs dim, the glow under each glyph */
  ascii: { cell: 9, reach: 0.022, bias: 8, scatter: 0.2, color: '#2f9a80', color2: '#e8fbf5', squash: 0.35, dither: 1.2, fade: 0.3, glow: 0.35 },
}

/** paper's liquid metal parameters (their "mint grain" preset as tuned for the site) */
export const LIQUID = {
  colorBack: THEME.bg,
  colorTint: '#9de8d4',
  softness: 0.15,
  repetition: 2.5,
  shiftRed: 0.2,
  shiftBlue: 0.4,
  distortion: 0.05,
  contour: 0.5,
  angle: 60,
  speed: 0.6,
  /** paper's scale: how much of the screen the mask spans (the sections around it need room) */
  scale: 0.6 * 0.85,
  grain: 0.7,
}
