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
    /** s6: s2's tile look (the paper's rounded plates and dark seams inside touching tiles) with each tile sampling `plates` of a
     *  cell inside its edges (the seams trimmed narrower) and the bright stars at the crossings masked over `corner` of a cell */
    plates?: number; corner?: number }; note: string }

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
  // plates and seams (s2), the seams trimmed by sampling .03 of a cell inside, the crossing stars masked; no gap tweens
  { name: 's6', flight: 'v5', join: 'stretch', page: 'solid', grain: false, settle: 'none', ghost: { alpha: 0, tint: '#9de8d4', gap: 0, wake: true, plates: 0.03, corner: 0.045 }, note: 's5 with s2\'s plates in the tiles, the seams a little narrower, the crossing stars gone' },
]
export const SITE_TRANSITION_OF = (name: string) => SITE_TRANSITIONS.find((v) => v.name === name)
