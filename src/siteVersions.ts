/**
 * Versions of the site's section transition (`?sv=`, key t cycles; `SITE_TRANSITIONS`, not the cube-version cycle in Site.tsx). Additive: never edit one, append.
 *  flight: the transition tab's flight version; join: how the landed cube becomes the page ('fade' = the face overfills the
 *  viewport and the page fades in over it; 'stretch' = the cube lands square, dims to dark tiles, stretches to the viewport and
 *  solves the page in); page: the page's look ('classic' = the first pages, blue disc, own greys; 'site' = the site's palette,
 *  hairline grid and ring, the hero drawing itself after the weld); grain: the site's grain overlay on the page.
 */
export type SiteVersion = { name: string; flight: string; join: 'fade' | 'stretch'; page: 'classic' | 'site'; grain: boolean; note: string }

export const SITE_TRANSITIONS: SiteVersion[] = [
  { name: 's1', flight: 'v4', join: 'fade', page: 'classic', grain: false, note: 'the face overfills the viewport, the page fades in over it (2026-09-10 night)' },
  { name: 's2', flight: 'v5', join: 'stretch', page: 'site', grain: true, note: 'lands square, dims to dark tiles, stretches, solves the page in; the page in the site palette (2026-09-11)' },
]
export const SITE_TRANSITION_OF = (name: string) => SITE_TRANSITIONS.find((v) => v.name === name)
