/**
 * Versions of the cube-to-screen transition (the transition tab): a plain grey Rubik's cube spins, flies into the
 * camera until one face fills the viewport, and the next page fades in over it. Additive: never edit one, append.
 */
export type TransitionVersion = {
  name: string
  /** whole turns about x and y over the flight (the cube ends face-on either way) */
  spin: [number, number]
  /** seconds for the flight, and the ease of the approach and of the spin (GSAP names) */
  duration: number
  approachEase: string
  spinEase: string
  /** how far past "face fills the screen" the cube flies (1 = exactly fills; 1.6 = one cubie fills) */
  overshoot: number
  /** the next page's fade: when it starts (fraction of the flight) and how long it takes (s) */
  fadeAt: number
  fade: number
  note: string
}

export const TRANSITION_VERSIONS: TransitionVersion[] = [
  { name: 'v1', spin: [1, 2], duration: 2.2, approachEase: 'power3.in', spinEase: 'power2.inOut', overshoot: 1.4, fadeAt: 0.72, fade: 0.7, note: 'one turn over, two around, accelerating into the camera until a face overfills the screen; the page fades in over the last quarter' },
]

export const TRANSITION_OF = (name: string) => TRANSITION_VERSIONS.find((v) => v.name === name)

/** the screen-as-cube solve: how the nine tiles bring the next project in (the transition tab's `screen` row) */
export type SolveVersion = {
  name: string
  /** the order the tiles land in (cell index 0..8, row-major from the top-left) */
  order: number[]
  /** seconds per flip and between launches */
  flip: number
  stagger: number
  /** the gap the seams open to (px) and the weld: bead run per seam pass (s) and the scar's cooling (s) */
  gap: number
  bead: number
  cool: number
  note: string
}
const SOLVE = [4, 1, 3, 5, 7, 0, 2, 6, 8]
const SWEEP = [0, 1, 3, 2, 4, 6, 5, 7, 8]
const SCATTER = [6, 1, 8, 3, 0, 7, 2, 5, 4]
export const SOLVE_VERSIONS: SolveVersion[] = [
  { name: 's1 solve', order: SOLVE, flip: 0.26, stagger: 0.09, gap: 8, bead: 0.22, cool: 0.5, note: 'solve order: the centre lands first, then the four edges, then the corners' },
  { name: 's2 sweep', order: SWEEP, flip: 0.26, stagger: 0.09, gap: 8, bead: 0.22, cool: 0.5, note: 'sweep: a diagonal wave from the top-left to the bottom-right' },
  { name: 's3 scatter', order: SCATTER, flip: 0.26, stagger: 0.09, gap: 8, bead: 0.22, cool: 0.5, note: 'scatter: a fixed irregular order, a speed-solver\'s hands' },
]
export const SOLVE_OF = (name: string) => SOLVE_VERSIONS.find((v) => v.name === name)
