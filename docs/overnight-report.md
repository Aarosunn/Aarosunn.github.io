# Overnight run report, 2026-09-09

Started 02:50 EDT. Cleaned up the morning after: the old cube tab and the weaker versions were deleted and the survivors renumbered. The four whole-face-plate versions moved to the paper tab as plain-cube demos. Final map, overnight → now: v10→v1, v13→v2, v14→v3, v19→v4, v23→v5, v24→v6, v27→v7, v31→v8, v34→v9, v35→v10; v11/v12/v17/v18 → paper tab demos (liquid metal, gem smoke, noir, icemint smoke).

## What to open first

1. `npx vite --port 5173` → http://localhost:5173. The **site** tab is the default: the mock portfolio.
   - arrows / 1–4 / click / wheel step the deck; every step turns a layer of the cube
   - click any list item → glass detail panel; Esc closes
   - `v` cycles the cube version in place: v1 → v9 → v4 → v7 → v2 → v6
   - `l` toggles the layout: sections in the corners, or deck-only with the panels doing the work
   - `c` cycles the colour scheme: the cube's palette follows it (ember = red cube, paper = light page), `p` cycles tabs
   - link a state: `/?v=v7&c=ember`, `/?tab=shader`
   - wheel and swipe also step the deck; the cube turns a layer on every step and idles with a turn every few seconds
2. **shader cube** tab: 11 versions, opens on v1; v11 is the site candidate (v10's cube with eight colour themes, brightness and opacity rows), rows version / preset / motion; the readout shows each version's note.
3. `shots/sheet-all.png` = every version v1–v10 in one image; `shots/sheet-palettes.png` = v10 across the heat presets and v24 across the liquid presets; `shots/sheet-site*.png`, `shots/sheet-panel*.png`, `shots/sheet-schemes.png`.

## What was built

- **PaperCube pipeline** (`src/PaperCube.tsx`, `src/paperVersions.ts`, `src/paperPresets.ts`): paper.design's heatmap, liquid metal and gem smoke run *verbatim* over a per-frame GPU render of a 3D shape. Heat gets their three blurs; liquid/smoke get either an analytic per-face plate or their real Poisson field solved on the GPU (Jacobi, 256², warm-started). The final pass clips to the silhouette (`halo`), can shade faces by lambert, and runs on the Rubik's cube (sharp or rounded cubies).
- **Rubik's cube as the mask** (`src/RubikMask.tsx`): 27 cubies, real quarter turns, integrity asserted after 12 random turns in the shoot script for every Rubik's version. Seams are painted in the face shader; in liquid/smoke modes they cut the alpha so each cubie face is its own paper shape.
- **Site mock** (`src/Site.tsx`, `src/Floral.tsx`, `src/Ascii.tsx`): cube as the light source, four sections as a deck, glass panel that emerges from the cube, x-ray floral, ASCII portrait placeholder, aura + grain, responsive at 1440 / 1024 / 420. `shots/site/tour.webm` is a 25 s recording.
- **Fusion** (v7): heat's halo and seam rims composited over liquid metal on the faces.
- **Scripts**: `papercube-shoot.mjs` (frames, orbit drags, mask/combined debug views, turn before/mid/after, integrity, fps, `--igpu`), `sheet.mjs` (contact sheets), `site-shoot.mjs`.

## The versions I'd put in front of you first

| version | what | why |
|---|---|---|
| v1 | heatmap on the Rubik's, paper's default palette, halo | the hero; the paper look on the real cube |
| v8 / v4 | icemint, hairline seams, with / without halo | the site's palette (v8 is the cheap-blur one) |
| v9 | rounded cubies, hairline seams | the connected-rounded look you asked for |
| v2 | v1 without the halo | when the CSS aura should carry the colour |
| v6 / v10 | liquid metal, one Poisson shape per cubie, sharp / rounded | 27 chrome cubies, exact paper field each |
| v7 | fusion: heat seams and halo over ice liquid-metal cubies | the two languages in one object |
| v3 / v5 | liquid cubie plates / silhouette Poisson | comparison points |
| paper tab | liquid metal, gem smoke, noir, icemint smoke on a plain cube | the shaders as objects, no cubies until a turn |

## Numbers

RTX 4060: every version 61 fps at 1440×900. Integrated GPU (`--igpu`), lab tab: v1 39, v4 43, v6 61, v8 (quarter-res big blur) 48. The **site** on the integrated GPU (`scripts/site-fps.mjs`, after warm-up): 52 fps at 1440×900 with v1, 55–60 at 420×820 (768 mask + quarter-res blur under 900px), 60 with v6.

`npx vite build` passes (one 1.26 MB chunk, 357 kB gzip after dropping the old cube tab and postprocessing); code-splitting the lab tabs is the next step before a Pages deploy.

## Decisions for you

- Which cube goes on the site (v1 paper palette vs v4/v8/v9 icemint vs v6 chrome vs v7 fusion).
- Halo or no halo on the site (the halo is the page's light; without it the CSS aura carries the colour).
- Sections in the corners or deck-only (key `l` compares them live).

## Known limits

- Heat seams soften as the object gets smaller in the mask frame (blur radii are frame-relative); the site keeps the lab camera and uses paper's `scale` instead.
- Liquid metal stripes are in image space (as on paper's site), so they slide across the cube as it spins; that is the reference behaviour, not a bug.
- Gem smoke's outer plume is meant to fill the frame; `halo: false` versions clip it.
- Floral is procedural placeholder art, seeded; a real drawing would replace `Floral.tsx`.

Spec with a section per commit: `docs/superpowers/specs/2026-09-09-aarcube-design.md`. Plan and log: `docs/superpowers/plans/2026-09-09-overnight.md`.
