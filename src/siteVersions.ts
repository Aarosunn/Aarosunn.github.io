/**
 * Versions of the site's section transition (`?sv=`, key t cycles; `SITE_TRANSITIONS`, not the cube-version cycle in Site.tsx). Additive: never edit one, append.
 *  flight: the transition tab's flight version; join: how the landed cube becomes the page ('fade' = the face overfills the
 *  viewport and the page fades in over it; 'stretch' = the cube lands square, dims to dark tiles, stretches to the viewport and
 *  solves the page in); page: the page's look ('classic' = the first pages, blue disc, own greys; 'site' = the site's palette,
 *  hairline grid and ring, the hero drawing itself after the weld); grain: the site's grain overlay on the page.
 */
/** settle: what the liquid does once the page is there ('none' = stays live; 'gradient' = the cubies close up and the liquid gives way
 *  to a still gradient; 'solid' = the liquid's highlight sweeps through once and the face rests on one dark mint; 'frozen' = the
 *  liquid stops where it is and its highlights are pressed down to the dark mint shades, a still of the shader); weldIn: the
 *  cube's seams stay as real gaps at the landing and the laser weld closes them */
export type SiteVersion = { name: string; flight: string; join: 'fade' | 'stretch'; page: 'classic' | 'site' | 'liquid' | 'solid'; grain: boolean; settle?: 'none' | 'gradient' | 'solid' | 'frozen'; weldIn?: boolean;
  /** the live liquid as a faint layer over the site's own dark ground (alpha), the seams narrowed to `gap` of a tile */
  ghost?: { alpha: number; tint: string; gap: number;
    /** s5: on `next` the tiles come back to the live liquid (seams reopening), the turns and weld run, then they fade out again */
    wake?: boolean;
    /** s6: s2's tile look (the paper's plates and dark seams inside touching tiles) with each tile sampling `plates` of a cell
     *  inside its edges (the seams trimmed narrower), every plate drawn as a rounded rectangle of corner radius `round` (of a
     *  cell), and `bare`: the turns without the break and the weld (no seam lines, the gaps never open) */
    plates?: number; round?: number; bare?: boolean;
    /** the black gap the tile shader draws between plates (fraction of a tile; with `plates` past the paper's rim it is the whole gap) */
    plateGap?: number;
    /** the radius of a sticker's corners away from the face's outer corners (`round` is for those) */
    roundInner?: number;
    /** the outer half-seams pushed off the viewport (the page scaled up by that much), and the text staying through a turn */
    noEdge?: boolean; textStays?: boolean }; note: string }

export const SITE_TRANSITIONS: SiteVersion[] = [
  { name: 's1', flight: 'v4', join: 'fade', page: 'classic', grain: false, note: 'the face overfills the viewport, the page fades in over it (2026-09-10 night)' },
  // s2 (2026-09-11 03:30, "looks great"): lands square, the face stretches into the viewport while the page's text fades in, the
  // tiles carrying the cube's own live liquid, which stays live on the page
  { name: 's2', flight: 'v5', join: 'stretch', page: 'liquid', grain: false, settle: 'none', note: 'lands square, stretches into the viewport as the page fades in over the cube\'s live liquid, which stays' },
  // s3 (04:50): s2's arrival, then the seams weld shut, the highlight sweeps through once and the face settles on a dark mint
  { name: 's3', flight: 'v5', join: 'stretch', page: 'solid', grain: false, settle: 'solid', weldIn: true, note: 's2, then the laser weld closes the cube\'s seams and the liquid settles on the cube\'s dark mint after one last sweep' },
  // s4 (2026-09-12, replacing the frozen shot, "I like nothing about s4"): s2's arrival, then the liquid fades to a faint live layer
  // over the site's own dark ground (the aura's glows through it), its pale areas tinted to the mint so they dim to teal rather than grey, the seams narrow, tiles sample only their plates (no seam glints)
  { name: 's4', flight: 'v5', join: 'stretch', page: 'solid', grain: false, settle: 'none', ghost: { alpha: 0, tint: '#9de8d4', gap: 0 }, note: 's2, then the liquid fades out and the seams close: the page is the site\'s own dark ground' },
  // s5 (2026-09-12): s4, and on next the page wakes: "it shifts back to the live liquid, does the spin then merge"
  { name: 's5', flight: 'v5', join: 'stretch', page: 'solid', grain: false, settle: 'none', ghost: { alpha: 0, tint: '#9de8d4', gap: 0, wake: true }, note: 's4, and on next the live liquid comes back, turns and welds, then fades into the ground again' },
  // s6 (2026-09-12): "I dont like the thin break, also it went wide then back thin, I like s2's version of some round some
  // straight edges (still slightly round), but close the gaps slightly": s5 with the tiles touching and showing the paper's own
  // plates and seams (s2), the seams trimmed by sampling .03 of a cell inside; no gap tweens. Then "no more divided lines no
  // weld, also try making all edges slightly rounded": every plate a rounded rectangle, the turns bare. Then "I still see a border,
  // also dont let text fade out": the plate mask a soft fall-off, the outer half-seams off the viewport, the text kept through the turn.
  // Then "there literally is a faded border": the tiles sample only the bright plate (past the paper's seam and its blurred rim,
  // .1 of a cell in) and the shader draws the whole gap itself, black and crisp, .08 of a tile. Then "cubes are too round, make some
  // edges straight (but still slightly rounded)": only a sticker's corner at the face's outer corner keeps the big radius
  { name: 's6', flight: 'v5', join: 'stretch', page: 'solid', grain: false, settle: 'none', ghost: { alpha: 0, tint: '#9de8d4', gap: 0, wake: true, plates: 0.1, plateGap: 0.08, round: 0.08, roundInner: 0.022, bare: true, noEdge: true, textStays: true }, note: 's5 with s2\'s plates in the tiles, the seams a little narrower, every plate rounded, turns without seam lines or weld' },
]
export const SITE_TRANSITION_OF = (name: string) => SITE_TRANSITIONS.find((v) => v.name === name)
