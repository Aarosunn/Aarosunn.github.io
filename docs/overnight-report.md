# Overnight run report, 2026-09-09

Started 02:50 EDT. Everything below is committed on `main`; nothing older was edited in place (v1/v2 of the heat cube and the cube tab's v1–v4 materials are untouched).

## What to open first

1. `npx vite --port 5173` → http://localhost:5173. The **site** tab is the default: the mock portfolio.
   - arrows / 1–4 / click / wheel step the deck; every step turns a layer of the cube
   - click any list item → glass detail panel; Esc closes
   - `v` cycles the cube version in place: v10 → v16 → v19 → v13 → v18 → v17
   - `c` cycles the colour scheme (aura wash + UI greys), `p` cycles tabs
2. **heat cube** tab (shader cube): 26 versions, rows version / preset / shape / motion. The `rubik` shape has `turning` (auto) and `turn`.
3. `shots/sheet-all.png` = every version v3–v23 in one image; `shots/sheet-v24-26.png`; `shots/sheet-site*.png`, `shots/sheet-panel.png`.

## What was built

- **PaperCube pipeline** (`src/PaperCube.tsx`, `src/paperVersions.ts`, `src/paperPresets.ts`): paper.design's heatmap, liquid metal and gem smoke run *verbatim* over a per-frame GPU render of a 3D shape. Heat gets their three blurs; liquid/smoke get either an analytic per-face plate or their real Poisson field solved on the GPU (Jacobi, 256², warm-started). The final pass clips to the silhouette (`halo`), can shade faces by lambert, and works on box / rounded box / octahedron / hidden-line cage / the Rubik's cube.
- **Rubik's cube as the mask** (`src/RubikMask.tsx`): 27 cubies, real quarter turns, integrity asserted after 12 random turns in the shoot script for every Rubik's version. Seams are painted in the face shader; in liquid/smoke modes they cut the alpha so each cubie face is its own paper shape.
- **Site mock** (`src/Site.tsx`, `src/Floral.tsx`): cube as the light source, four sections as a deck, glass panel, x-ray floral, aura + grain, responsive at 1440 / 1024 / 420.
- **Scripts**: `papercube-shoot.mjs` (frames, orbit drags, mask/combined debug views, turn before/mid/after, integrity, fps, `--igpu`), `sheet.mjs` (contact sheets), `site-shoot.mjs`.

## The versions I'd put in front of you first

| version | what | why |
|---|---|---|
| v10 | heatmap on the Rubik's, paper's default palette, halo | the hero; the paper look on the real cube |
| v16 / v19 | same in icemint, hairline seams, with / without halo | the site's palette |
| v20 | hidden-line Rubik's cage | quietest, most graphic |
| v24 | liquid metal, one Poisson shape per cubie | 27 chrome cubies, exact paper field each |
| v18 | gem smoke icemint, no outer smoke | glassy marble faces |
| v3 / v4 / v5 / v6 | the three shaders on a plain box / cage | closest to the site pages themselves |

## Numbers

RTX 4060: every version 61 fps at 1440×900. Integrated GPU (`--igpu`): v10 39, v16 36, v19 43, v24 61. The site uses a 768 mask under 900px wide for that reason.

## Decisions for you

- Which cube goes on the site (v10 paper palette vs v16/v19 icemint vs v20 cage vs v24 chrome).
- Halo or no halo on the site (the halo is the page's light; without it the CSS aura carries the colour).
- Sections stay in the corners, or collapse to the deck only with panels doing the work.
- Whether the old cube tab (v1–v4 materials) stays as a lab or goes.

## Known limits

- Heat seams soften as the object gets smaller in the mask frame (blur radii are frame-relative); the site keeps the lab camera and uses paper's `scale` instead.
- Liquid metal stripes are in image space (as on paper's site), so they slide across the cube as it spins; that is the reference behaviour, not a bug.
- Gem smoke's outer plume is meant to fill the frame; `halo: false` versions clip it.
- Floral is procedural placeholder art, seeded; a real drawing would replace `Floral.tsx`.

Spec with a section per commit: `docs/superpowers/specs/2026-09-09-aarcube-design.md`. Plan and log: `docs/superpowers/plans/2026-09-09-overnight.md`.
