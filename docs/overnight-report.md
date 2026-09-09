# Overnight run report, 2026-09-09

Started 02:50 EDT. Everything below is committed on `main`; nothing older was edited in place (v1/v2 of the heat cube and the cube tab's v1–v4 materials are untouched).

## What to open first

1. `npx vite --port 5173` → http://localhost:5173. The **site** tab is the default: the mock portfolio.
   - arrows / 1–4 / click / wheel step the deck; every step turns a layer of the cube
   - click any list item → glass detail panel; Esc closes
   - `v` cycles the cube version in place: v10 → v16 → v34 → v19 → v20 → v27 → v13 → v18 → v24 → v17
   - `l` toggles the layout: sections in the corners, or deck-only with the panels doing the work
   - `c` cycles the colour scheme: the cube's palette follows it (ember = red cube, paper = light page), `p` cycles tabs
   - link a state: `/?v=v27&c=ember`, `/?tab=heatcube`
   - wheel and swipe also step the deck; the cube turns a layer on every step and idles with a turn every few seconds
2. **heat cube** tab (shader cube): 35 versions, opens on v10, rows version / preset / shape / motion; the readout shows each version's note. The `rubik` shape has `turning` (auto) and `turn`.
3. `shots/sheet-all.png` = every version v3–v35 in one image; `shots/sheet-palettes.png` = v10 across the heat presets and v24 across the liquid presets; `shots/sheet-site*.png`, `shots/sheet-panel*.png`, `shots/sheet-schemes.png`.

## What was built

- **PaperCube pipeline** (`src/PaperCube.tsx`, `src/paperVersions.ts`, `src/paperPresets.ts`): paper.design's heatmap, liquid metal and gem smoke run *verbatim* over a per-frame GPU render of a 3D shape. Heat gets their three blurs; liquid/smoke get either an analytic per-face plate or their real Poisson field solved on the GPU (Jacobi, 256², warm-started). The final pass clips to the silhouette (`halo`), can shade faces by lambert, and works on box / rounded box / octahedron / hidden-line cage / the Rubik's cube.
- **Rubik's cube as the mask** (`src/RubikMask.tsx`): 27 cubies, real quarter turns, integrity asserted after 12 random turns in the shoot script for every Rubik's version. Seams are painted in the face shader; in liquid/smoke modes they cut the alpha so each cubie face is its own paper shape.
- **Site mock** (`src/Site.tsx`, `src/Floral.tsx`, `src/Ascii.tsx`): cube as the light source, four sections as a deck, glass panel that emerges from the cube, x-ray floral, ASCII portrait placeholder, aura + grain, responsive at 1440 / 1024 / 420. `shots/site/tour.webm` is a 25 s recording.
- **Fusion** (v27–v29): heat's halo and seam rims composited over another paper shader on the faces.
- **Scripts**: `papercube-shoot.mjs` (frames, orbit drags, mask/combined debug views, turn before/mid/after, integrity, fps, `--igpu`), `sheet.mjs` (contact sheets), `site-shoot.mjs`.

## The versions I'd put in front of you first

| version | what | why |
|---|---|---|
| v10 | heatmap on the Rubik's, paper's default palette, halo | the hero; the paper look on the real cube |
| v16 / v19 | same in icemint, hairline seams, with / without halo | the site's palette |
| v34 / v33 | rounded cubies, hairline / broad seams | the connected-rounded look you asked for |
| v20 | hidden-line Rubik's cage | quietest, most graphic |
| v24 / v35 | liquid metal, one Poisson shape per cubie, sharp / rounded | 27 chrome cubies, exact paper field each |
| v27 | fusion: heat seams and halo over ice liquid-metal cubies | the two languages in one object |
| v18 / v30 | gem smoke icemint, without / with its plume | glassy marble faces |
| v3 / v4 / v5 / v6 | the three shaders on a plain box / cage | closest to the site pages themselves |

## Numbers

RTX 4060: every version 61 fps at 1440×900. Integrated GPU (`--igpu`), lab tab: v10 39, v16 41, v19 43, v24 61, v31 (quarter-res big blur) 48. The **site** on the integrated GPU (`scripts/site-fps.mjs`, after warm-up): 52 fps at 1440×900 with v10, 55–60 at 420×820 (768 mask + quarter-res blur under 900px), 60 with v24.

`npx vite build` passes (one 1.44 MB chunk, 407 kB gzip: three + paper shaders + react); code-splitting the lab tabs is the obvious next step before a Pages deploy.

## Decisions for you

- Which cube goes on the site (v10 paper palette vs v16/v19 icemint vs v20 cage vs v24 chrome).
- Halo or no halo on the site (the halo is the page's light; without it the CSS aura carries the colour).
- Sections in the corners or deck-only (key `l` compares them live).
- Whether the old cube tab (v1–v4 materials) stays as a lab or goes.

## Known limits

- Heat seams soften as the object gets smaller in the mask frame (blur radii are frame-relative); the site keeps the lab camera and uses paper's `scale` instead.
- Liquid metal stripes are in image space (as on paper's site), so they slide across the cube as it spins; that is the reference behaviour, not a bug.
- Gem smoke's outer plume is meant to fill the frame; `halo: false` versions clip it.
- Floral is procedural placeholder art, seeded; a real drawing would replace `Floral.tsx`.

Spec with a section per commit: `docs/superpowers/specs/2026-09-09-aarcube-design.md`. Plan and log: `docs/superpowers/plans/2026-09-09-overnight.md`.
