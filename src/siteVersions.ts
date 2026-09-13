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
  ghost?: { alpha: number; tint: string; gap: number }; note: string }

export const SITE_TRANSITIONS: SiteVersion[] = [
  { name: 's1', flight: 'v4', join: 'fade', page: 'classic', grain: false, note: 'the face overfills the viewport, the page fades in over it (2026-09-10 night)' },
  // s2 (2026-09-11 03:30, "looks great"): lands square, the face stretches into the viewport while the page's text fades in, the
  // tiles carrying the cube's own live liquid, which stays live on the page
  { name: 's2', flight: 'v5', join: 'stretch', page: 'liquid', grain: false, settle: 'none', note: 'lands square, stretches into the viewport as the page fades in over the cube\'s live liquid, which stays' },
  // s3 (04:50): s2's arrival, then the seams weld shut, the highlight sweeps through once and the face settles on a dark mint
  { name: 's3', flight: 'v5', join: 'stretch', page: 'solid', grain: false, settle: 'solid', weldIn: true, note: 's2, then the laser weld closes the cube\'s seams and the liquid settles on the cube\'s dark mint after one last sweep' },
  // s4 (2026-09-12, replacing the frozen shot, "I like nothing about s4"): s2's arrival, then the liquid fades to a faint live layer
  // over the site's own dark ground (the aura's glows through it), its pale areas tinted to the mint so they dim to teal rather than grey, the seams narrow, tiles sample only their plates (no seam glints)
  { name: 's4', flight: 'v5', join: 'stretch', page: 'solid', grain: false, settle: 'none', ghost: { alpha: 0.15, tint: '#9de8d4', gap: 0.045 }, note: 's2, then the live liquid fades to a faint layer over the site\'s dark ground and the seams narrow' },
]
export const SITE_TRANSITION_OF = (name: string) => SITE_TRANSITIONS.find((v) => v.name === name)
