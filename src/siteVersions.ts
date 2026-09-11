/**
 * Versions of the site's section transition (`?sv=`, key t cycles; `SITE_TRANSITIONS`, not the cube-version cycle in Site.tsx). Additive: never edit one, append.
 *  flight: the transition tab's flight version; join: how the landed cube becomes the page ('fade' = the face overfills the
 *  viewport and the page fades in over it; 'stretch' = the cube lands square, dims to dark tiles, stretches to the viewport and
 *  solves the page in); page: the page's look ('classic' = the first pages, blue disc, own greys; 'site' = the site's palette,
 *  hairline grid and ring, the hero drawing itself after the weld); grain: the site's grain overlay on the page.
 */
export type SiteVersion = { name: string; flight: string; join: 'fade' | 'stretch'; page: 'classic' | 'site' | 'liquid'; grain: boolean; note: string }

export const SITE_TRANSITIONS: SiteVersion[] = [
  { name: 's1', flight: 'v4', join: 'fade', page: 'classic', grain: false, note: 'the face overfills the viewport, the page fades in over it (2026-09-10 night)' },
  // s2 as of 2026-09-11 03:30 (Aaron: no dark tiles, no solve on entry, no grid, page material = the cube): lands square, the face
  // stretches into the viewport while the page's text fades in, the tiles carrying the cube's own live liquid
  { name: 's2', flight: 'v5', join: 'stretch', page: 'liquid', grain: false, note: 'lands square, stretches into the viewport as the page fades in over the cube\'s own material (2026-09-11)' },
]
export const SITE_TRANSITION_OF = (name: string) => SITE_TRANSITIONS.find((v) => v.name === name)
