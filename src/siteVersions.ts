/**
 * Versions of the site's section transition (`?sv=`, key t cycles; `SITE_TRANSITIONS`, not the cube-version cycle in Site.tsx). Additive: never edit one, append.
 *  flight: the transition tab's flight version; join: how the landed cube becomes the page ('fade' = the face overfills the
 *  viewport and the page fades in over it; 'stretch' = the cube lands square, dims to dark tiles, stretches to the viewport and
 *  solves the page in); page: the page's look ('classic' = the first pages, blue disc, own greys; 'site' = the site's palette,
 *  hairline grid and ring, the hero drawing itself after the weld); grain: the site's grain overlay on the page.
 */
/** settle: what the liquid does once the page is there ('none' = stays live; 'gradient' = the cubies close up and the liquid gives way
 *  to a still gradient; 'solid' = the liquid's highlight sweeps through once and the face rests on one dark mint); weldIn: the
 *  cube's seams stay as real gaps at the landing and the laser weld closes them */
export type SiteVersion = { name: string; flight: string; join: 'fade' | 'stretch'; page: 'classic' | 'site' | 'liquid' | 'solid'; grain: boolean; settle?: 'none' | 'gradient' | 'solid'; weldIn?: boolean; note: string }

export const SITE_TRANSITIONS: SiteVersion[] = [
  { name: 's1', flight: 'v4', join: 'fade', page: 'classic', grain: false, note: 'the face overfills the viewport, the page fades in over it (2026-09-10 night)' },
  // s2 (2026-09-11 03:30, "looks great"): lands square, the face stretches into the viewport while the page's text fades in, the
  // tiles carrying the cube's own live liquid, which stays live on the page
  { name: 's2', flight: 'v5', join: 'stretch', page: 'liquid', grain: false, settle: 'none', note: 'lands square, stretches into the viewport as the page fades in over the cube\'s live liquid, which stays' },
  // s3 (04:50): s2's arrival, then the seams weld shut, the highlight sweeps through once and the face settles on a dark mint
  { name: 's3', flight: 'v5', join: 'stretch', page: 'solid', grain: false, settle: 'solid', weldIn: true, note: 's2, then the laser weld closes the cube\'s seams and the liquid settles on the cube\'s dark mint after one last sweep' },
]
export const SITE_TRANSITION_OF = (name: string) => SITE_TRANSITIONS.find((v) => v.name === name)
