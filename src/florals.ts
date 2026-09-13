/**
 * The three ghost blooms at the base of the home page: lotus, rose and orchid as x-ray meshes, hand-placed
 * (the lab's floral v18). Positions are bloom centres; rotations are radians about the bloom centre; gain and wire
 * dim a flower (a dense bloom's white core is mostly its wire pass).
 */
export type Placed = { flower: 'lotus' | 'rose' | 'orchid'; at: [number, number, number]; scale: number; rot?: [number, number, number]; gain?: number; wire?: number }

export const FLORAL = {
  /** fresnel x-ray: faces see-through, grazing angles bright */
  fresnel: { power: 2.8, gain: 0.9, base: 0.015 },
  /** wire pass intensity and the thin-film sheen */
  wire: 0.12,
  irid: 0.25,
  /** how far the petals and their rims lean from the mint toward white */
  petalWhite: 0.2,
  rimWhite: 0.6,
  /** camera distance for the group */
  camDist: 4.6,
  place: [
    { flower: 'rose', at: [-0.42, 0.04, 0], scale: 0.8, rot: [-0.45, 0, 0.4], gain: 0.3, wire: 0.3 },
    { flower: 'lotus', at: [0.18, -0.18, 0.09], scale: 0.69, rot: [-1.49, 0.4, 0.35], gain: 0.3, wire: 0.4 },
    { flower: 'orchid', at: [-0.1, -0.43, 0.39], scale: 0.73, rot: [-0.06, 0.09, 0], gain: 1 },
  ] as Placed[],
}
