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
