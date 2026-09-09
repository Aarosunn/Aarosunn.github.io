# aarcube design decisions (2026-09-09)

Personal portfolio for Aaron (CE, University of Michigan). One 3D Rubik's cube, always on screen, never scrolls. Jack-of-all-trades story, told through one object.

## Direction
Five references, one idea: light through or off translucent/reflective matter on a dark ground, disciplined by thin technical line-work. Called "spectral engineering" internally.

| Style | Job | Never |
|---|---|---|
| Aura gradient | Background wash only, later driven by webcam blur | Foreground element |
| Spectral glow | Cube edges, hover halo | On text |
| Y2K futurism | Type, chrome accents, at most one flare | Full-bleed chrome imagery |
| Glassmorphism | Panels when a face opens | Glass on glass |
| Technical xray floral | Annotation system, lowkey at bottom | Generated flowers as content |

Rule: UI is greyscale, hue is emitted by the cube (shaders), not painted in CSS. Heat = stress = deformation is the connective tissue (heat material, stress-type wordmark later).

## Scope decisions
- Sections: about, code, hardware, creatives. Cube is a toy at rest; routing is code-driven.
- Nav v1: deck stepping (arrows step through a curated order, cube spins to match, face pans to full screen, page shows).
- Stack: Vite + React + TS strict, TanStack Router (later), R3F + drei + postprocessing, GSAP, GitHub Pages.
- Future, not now: webcam reflection + aura, MediaPipe hands, head-coupled perspective, ASCII portrait, music-synced edit, backend quirks.

## Current lab (`src/`)
- 27 rounded cubies, real layer turns (pivot attach, GSAP, snap to quarter turns), auto mode.
- Materials: heat (turbo colormap + bloom), chrome (physical metal + iridescence, Lightformer studio env), smoke (fbm glass shader).
- Six schemes as CSS vars + shader uniforms: ice, aura, ember, graphite, mint, paper.
- Grey dashed slots for undecided things. Readout shows real data.
- `node scripts/shoot.mjs` screenshots every scheme x material on the real GPU and asserts cube integrity after 12 turns.

## Lab, second pass (2026-09-09, later)
Both iterations coexist, switchable in the UI and via keys `s` (shape) / `v` (set):
- **shape** `classic` = first iteration exactly (rounded r=0.09, gap 1.06). `solid` = rounded r=0.045, touching; the bevels are the seams.
- **set** `v1` = first three materials, untouched (`src/materials/v1.ts`). `v2` = paper.design trio rebuilt on `MeshPhysicalMaterial` (`src/materials/v2.ts`): heat = emissive injection on a dark clearcoat body; smoke = diffuse injection on a clearcoat stone, brighter dome; chrome = mirror metal reflecting a baked equirect of paper's stripe function (`liquidTexture` in App), animated by rotating the environment.
- v2 patterns use per-cubie rest-space uniforms (`uRot`/`uPos`, one material per cubie) so the skin rides with a turning slice. Never define surface patterns in root space again.
- `float` toggle restores the old bob, default off. `icemint` scheme added (ice top-left, mint bottom-right).
- `node scripts/shoot.mjs [--all]` shoots set x shape x material on icemint + paper (all schemes with `--all`) and asserts integrity for both sets.

## Sets are additive (rule, 2026-09-09)
A new iteration is a new set file (`src/materials/v4.ts`, `SETS` entry, env/bloom branch in App). An existing set is never edited in place; Aaron compares them side by side. Current: v1 (first shaders), v2 (paper trio on physical bases, rest-slot patterns), v3 (deeper heat, graded metal env with rainbow fringe, 3D marble smoke, fields in cube space so turns never pop).

## v4 (2026-09-09, later) — `src/materials/v4.ts`, five variants
Aaron's notes on v3: heat redder and dimmer; chrome not pixelated, slower, band present more of the time; smoke = v2 look but slower. Plus two fusions.
- heat: ten-stop ramp ending in deep red, emissive multiplier 0.28–0.83 so the rim stays red instead of blowing out; bloom 0.9.
- chrome: liquid env baked as a 128x1024 strip (2048 wide blocked the main thread for seconds on every scheme change); `hold` keeps the wide gradient bright then drops to a broad dark band; body 0.96 -> 0.55; env rotation at a quarter speed with a wider sweep; roughness 0.10; thin-film range 100–700 nm for the rainbow.
- smoke: v2's face-centred swirl evaluated in cube space (continuous through turns) at a third of the speed.
- heatsmoke: dark clearcoat glass, the smoke ring drives the heat ramp as emissive.
- smokechrome: metal whose diffuse is the smoke (silver / dark oil / pale core) under the liquid env with strong iridescence.
- Turn check now screenshots before/mid/after for every v4 variant (`shots/turn-v4-*`); all fields are continuous, edge glow rides the slice.

## Paper shaders tab (2026-09-09, later)
`src/Paper.tsx`, key `p` or the tab switch next to the wordmark. Pure recreation, no cube: the official `@paper-design/shaders-react` (Apache 2.0) `Heatmap`, `LiquidMetal`, `GemSmoke` with the site's own presets, preset buttons per panel. Heatmap is image-masked, so it gets the site's diamond logo vendored at `public/paper/diamond.svg`. Reference frames of the live pages: `node scripts/paper-ref.mjs` -> `shots/paper/<name>-N.png`; ours: `node scripts/paper-shoot.mjs` -> `shots/paper/mine-N.png`. Global `canvas { position: fixed }` is scoped away inside `.paper-canvas`.

Why v4 smokechrome went green/pink: the 100–700 nm thin-film iridescence range on a white metal produces magenta/green interference, and the mint scheme's `b` colour tinted the oil veins. Neither is in paper's shader.
