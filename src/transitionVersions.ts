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
  /** what the screen row offers under this version (default: the flight plus every s / c screen) */
  screens?: string[]
  note: string
}

export const TRANSITION_VERSIONS: TransitionVersion[] = [
  { name: 'v1', spin: [1, 2], duration: 2.2, approachEase: 'power3.in', spinEase: 'power2.inOut', overshoot: 1.4, fadeAt: 0.72, fade: 0.7, note: 'one turn over, two around, accelerating into the camera until a face overfills the screen; the page fades in over the last quarter' },
  { name: 'v2', spin: [1, 2], duration: 2.2, approachEase: 'power3.in', spinEase: 'power2.inOut', overshoot: 1.4, fadeAt: 0.72, fade: 0.7, screens: ['a1 rows', 'a2 columns', 'a3 slices'], note: 'v2: the screen is a real cube and the next project is solved onto the front face by an algorithm, three to choose from; unseen faces are printed with the next project before they come round' },
]

export const TRANSITION_OF = (name: string) => TRANSITION_VERSIONS.find((v) => v.name === name)

/** the screen-as-cube solve: how the nine tiles bring the next project in (the transition tab's `screen` row) */
export type SolveVersion = {
  name: string
  /** the order the tiles land in (cell index 0..8, row-major from the top-left), or `moves`: layers that roll
   *  together, one move after another (r0..r2 rows rolling up, c0..c2 columns rolling sideways); each tile once */
  order: number[]
  moves?: ('r0' | 'r1' | 'r2' | 'c0' | 'c1' | 'c2')[][]
  /** seconds the break-apart takes to open (0 = a hard cut) */
  open?: number
  /** the weld: two bead passes (default) or a laser: three random points on the grid grow rings that erase the seams over `weld` s */
  laser?: boolean
  weld?: number
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
SOLVE_VERSIONS.push(
  { name: 's4 rows', order: [], moves: [['r0'], ['r1'], ['r2']], flip: 0.46, stagger: 0.24, open: 0.3, gap: 8, bead: 0, cool: 0, laser: true, weld: 0.95, note: 'rows: the three rows roll up one after another, a real layer turn each; the break opens over a beat; a laser weld grows from three random points and erases the grid' },
  { name: 's5 two and one', order: [], moves: [['r0', 'r2'], ['r1']], flip: 0.46, stagger: 0.3, open: 0.3, gap: 8, bead: 0, cool: 0, laser: true, weld: 0.95, note: 'two and one: the outer rows roll together in one move, the middle row follows; laser weld' },
  { name: 's6 columns', order: [], moves: [['c0'], ['c1'], ['c2']], flip: 0.46, stagger: 0.24, open: 0.3, gap: 8, bead: 0, cool: 0, laser: true, weld: 0.95, note: 'columns: the three columns roll sideways one after another (the phone\'s natural move); laser weld' },
)
export const SOLVE_OF = (name: string) => SOLVE_VERSIONS.find((v) => v.name === name)

/** the screen as a real cube: legal layer turns that bring a neighbouring face (the next project) to the front */
export type CubeMove = { axis: 'x' | 'y'; layers: number[]; dir: 1 | -1 }
/** `moves`: layers turning together, one move after another; or `alg` in cube notation (U D E R L M, with ' and 2; no F/S/B:
 *  a face turn would shape-shift a stretched cube). Hidden faces are printed with the next project just before they come
 *  round, oriented to arrive upright, so any legal sequence delivers the page the right way up. */
/** the turn itself (duration, step response, recoil) is the site cube's `FEEL.turn`, so one tuning serves both */
export type CubeVersion = { name: string; moves?: CubeMove[]; alg?: string; stagger: number; open: number; gap: number; weld: number; note: string }
const CUBE = { stagger: 0.22, open: 0.35, gap: 8, weld: 1.6 }
export const CUBE_VERSIONS: CubeVersion[] = [
  { name: 'c1 row by row', ...CUBE, moves: [{ axis: 'y', layers: [1], dir: -1 }, { axis: 'y', layers: [0], dir: -1 }, { axis: 'y', layers: [-1], dir: -1 }], note: 'a real cube: U, then E, then D turn the same way, the right face comes to the front one row of stickers at a time; laser weld, slower' },
  { name: 'c2 two and one', ...CUBE, moves: [{ axis: 'y', layers: [1, 0], dir: -1 }, { axis: 'y', layers: [-1], dir: -1 }], note: 'a real cube: the top two layers turn together (a wide u), then D; the right face comes to the front' },
  { name: 'c3 whole cube', ...CUBE, moves: [{ axis: 'y', layers: [1, 0, -1], dir: -1 }], note: 'a real cube: a y rotation, all three layers at once; the right face comes to the front in one move' },
  { name: 'c4 columns', ...CUBE, moves: [{ axis: 'x', layers: [-1], dir: 1 }, { axis: 'x', layers: [0], dir: 1 }, { axis: 'x', layers: [1], dir: 1 }], note: 'a real cube: L\', M\', R turn the same way, the top face comes down to the front one column at a time' },
]
const ALG = { stagger: 0.08, open: 0.35, gap: 8, weld: 1.6 }
CUBE_VERSIONS.push(
  { name: 'a1 rows', ...ALG, alg: 'U E D R E D', note: 'solving: six legal turns, mostly rows with one column, the next page fills in 2 · 2 · 2 · 3 · 6 · 9 cells' },
  { name: 'a2 columns', ...ALG, alg: 'R M U M E L', note: 'solving: columns first then rows, the page fills in 1 · 1 · 2 · 4 · 6 · 9' },
  { name: 'a3 slices', ...ALG, alg: 'L E M D R D', note: 'solving: a mixed sequence with two slice turns, the page fills in 1 · 2 · 4 · 4 · 6 · 9' },
)
export const CUBE_OF = (name: string) => CUBE_VERSIONS.find((v) => v.name === name)
