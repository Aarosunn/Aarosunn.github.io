# aarcube

A personal portfolio where a Rubik's cube is always on screen and is also the menu. The cube is rendered through paper.design's shaders (heatmap, liquid metal, gem smoke; Apache 2.0) on real 3D geometry.

```
npm install
npx vite --port 5173
```

Tabs (key `p`): **site** (the mock portfolio), **cube** (material lab v1–v4), **heat cube** (the shader cube, 31 versions), **paper shaders** (the official components, ground truth).

Site keys: arrows / 1–4 / wheel / swipe step the deck, click an item for a panel, `v` cycles the cube version, `c` the colour scheme.

Verification (needs the dev server; uses the NVIDIA GPU via PRIME):

```
node scripts/papercube-shoot.mjs            # every shader-cube version: frames, orbits, turn integrity, fps
node scripts/papercube-shoot.mjs v10 --igpu # integrated GPU numbers
node scripts/site-shoot.mjs                 # the site at 1440 / 1024 / 420
node scripts/sheet.mjs out.png a.png b.png  # contact sheet
```

Read `docs/overnight-report.md` first, then `docs/superpowers/specs/2026-09-09-aarcube-design.md` (a section per decision).
