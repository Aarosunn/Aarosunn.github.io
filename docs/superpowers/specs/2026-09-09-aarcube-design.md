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

## Heat cube tab (2026-09-09, later) — `src/HeatCube.tsx`
Paper's heatmap on a plain 3D cube, drag to orbit, no Rubik's. Their fragment shader runs verbatim (imported from `@paper-design/shaders`). Their CPU preprocessing (grey shape on white -> R box blur r5 x1, G r150 x3, B r18 x3, image in the central 57% of a 1750px canvas) is rebuilt on the GPU every frame from a render of the cube: black faces, white edge bars (12 thin boxes; drei's line Edges do not survive a manual render). Radii scale from 1750 to the 512 mask; the big blur runs at 256. Mask target keeps a depth buffer so faces hide back edges. `hollow` drops the faces and makes the bars black, so the wire cage becomes the shape. Presets are the site's. `node scripts/heatcube-shoot.mjs` captures spin frames, three drag orbits and hollow.
Lessons: three wants `vec4[]` uniforms as a flat Float32Array; RawShaderMaterial + GLSL3 needs their `#version` line stripped and keeps their own precision line.

### Heat cube v2 (same tab, `version` row)
Aaron on v1: gaps between the sides, low quality, no background. v2: 1024 MSAA mask; the mask is *inverted* (cube faces R = 1 = paper's "outside", background black = the shape) so their animated hot band sweeps inside the cube; the background clips itself through their own `img.a == 0 -> colorBack` branch because mask G (lambert face shade inside, 0 outside) rides in the combined alpha; one appended multiply shades the faces. Edges are hairline black bars (0.007), so seams not gaps. Big blur radius 260 instead of 150 so the sweep reaches into the faces. v1 kept.

## Shader cube v3–v9: generic paper pipeline (overnight run, 03:55)

`src/PaperCube.tsx` + `src/paperVersions.ts`. One pipeline for all three paper shaders on any shape; v1/v2 stay frozen in HeatCube.tsx.
- Mask render (1024, MSAA 4, depth) of the shape with a channel-writing face material. Heat: R = luminance (0 shape / 1 outside), G = lambert, B = inside. Liquid/smoke: R = analytic Poisson-like field per box face `1 - ((1-x²)(1-y²))^k`, G = alpha, B = lambert. Non-box shapes use a blurred-silhouette field instead.
- Their preprocess on the GPU: heat = contour r5 ×1, inner r18 ×3, big r150 ×3 at half res (radii from their 1750px canvas; image = central 57%). Liquid/smoke need no blur (they blur in-shader).
- Final pass = their fragment verbatim (`#version` stripped, mediump → highp) with `v_imageUV`/`v_objectUV`/`v_responsiveUV` reproduced for fit=contain, plus a tail: raw mask uniform, silhouette clip (`halo` off → colorBack outside), lambert multiply (`shade`).
- Versions: v3 heat box (site-faithful), v4 heat cage (hidden-line strokes), v5 liquid box, v6 smoke box, v7 heat no-halo shaded, v8 liquid shaded, v9 smoke no outer smoke. Shape row: box / rounded / octa / cage. Preset row = the shader's site presets. 61 fps on the RTX for all.
- Findings: paper's heatmap "shape" is solid (diamond.svg is a filled polygon); the moving band is the gap between three animated shadow blobs. Seam bars must be inset or they double the silhouette. Liquid/smoke want the object at ~75% of the image frame (camZ 3.9); heat wants it inside the central 57% (camZ 7).
- v1 "broken": renders after ~600 ms warm-up; the seam gap at some orbit angles came from bars protruding past the silhouette.

## Shader cube v10–v15: the Rubik's cube as the mask (04:20)

`src/RubikMask.tsx`: 27 cubies sharing the mask material, pivot-attach quarter turns (same as Cube.tsx), `__aar.paperTurn / paperPositions / paperBusy`, integrity asserted after 12 random turns in `scripts/papercube-shoot.mjs`.
- Seams: cubie gaps never show (inner cubies occlude the background), so the face shader paints a hairline of the opposite luminance along every cubie face border (`uSeam`, uv units). Heat then rims every cubie edge; through a turn the rotating layer keeps its own seams.
- Field for liquid/smoke on the Rubik's: `field: 'cube'` = one plate per whole cube face computed in cube space (`uRootInv * modelMatrix`), so the turning layer's plate rotates with it and splits/re-merges without a pop; `field: 'face'` = one plate per cubie face (chrome-button grid).
- Final pass clips to the mask frame (`inFrame`) so an object that spills past the square mask no longer smears via clamp-to-edge.
- Camera: heat maps the mask through paper's central-57% window and scale .75, so the object must be ~2.3× farther than it looks (rubik camZ 20); liquid/smoke (scale .6) camZ 11.
- v10 heat rubik (halo), v11 liquid rubik cube-plates, v12 smoke rubik cube-plates no halo, v13 heat rubik no halo, v14 liquid rubik cubie-plates, v15 smoke rubik cubie-plates. All 61 fps, integrity ok. v10/v13 are the strongest: the heatmap language on the actual Rubik's cube.

## Site mock (P3, 03:20)

`src/Site.tsx` + `.site*` CSS: default tab. The shader cube (v10, heatmap on the Rubik's) centre; four sections About / Code / Hardware / Creatives in the corners with placeholder copy, no boxes (hierarchy by type: Unbounded 300 titles, mono body, accent tick on the active one); deck stepping = arrows, 1–4, click, or the deck at the base; every step turns one layer of the cube. `src/Floral.tsx` (procedural x-ray floral, seeded, sonnet-written) sits above the deck. Lab tabs top-right, dimmed.
- The cube keeps v10's camera so the heat blurs stay crisp (radii are frame-relative); paper's `scale` (.5 desktop / .42 narrow) shrinks the image on screen instead. `outerGlow` .42 so the halo lights the page without drowning the copy.
- Grid: head / two section rows / base, so sections never collide; ≤900px: only the active section, scrim over the lower half, lab tabs hidden.
- `scripts/site-shoot.mjs`: 1440 / 1024 / 420, deck steps mid-turn.

## Polish round: presets, v16–v19, site cycler, review fixes (03:35)

- `src/paperPresets.ts`: aarcube presets after paper's in the preset row. Heat: icemint (navy→ice→mint→white), ember, graphite, icemint slow. Liquid: ice, noir slow (tint #a0a0a4 so the body reads), mint. Smoke: icemint, ember, graphite (dark colorBack). Versions carry a default `preset`.
- v16 heat Rubik's hairline seams (.02) icemint · v17 liquid Rubik's noir slow shaded (dark chrome) · v18 smoke Rubik's icemint no outer smoke (glassy marble) · v19 v16 without halo, slower.
- Site: key `v` cycles v10 → v16 → v19 → v13 → v18 → v17 (`SITE_VERSIONS`); params derive from the version's preset, scale ×.85 (.7 narrow). Bug found: App's window keydown listener re-renders synchronously on the same event, so a listener that Site re-registers per render is swapped out mid-dispatch and never fires; Site now registers one stable listener that calls a ref.
- Review (sonnet, read-only) fixes: RubikMask kills its tween and ignores `onComplete` after unmount; PaperCube's uniform effect depends on `shape` (stale seam/uHalf when only the shape changed); the fullscreen quad geometry is disposed.
- Floral second pass: lanceolate leaves with arced veins, seed heads, hatch detail, one dimension line; reads as botanical x-ray line art at the base.

## v20–v23: hidden-line Rubik's, GPU Poisson (03:45)

- `polarity: 'cage'` (heat): faces white, seams black, white background → v20 hidden-line Rubik's lattice in icemint; the turning layer detaches as its own lattice.
- `field: 'poisson'`: paper's actual preprocess on the GPU: mask alpha downsampled to 256², Jacobi for ∇²u = −1 (30 iterations per frame, warm-started from the previous frame so motion keeps up), max reduced 256→64→16→4→1, field = 1 − u/max. Half-float targets. v21 liquid on the rounded box (bands hug the boundary like the site), v22 smoke on the octahedron, v23 liquid Rubik's as one silhouette blob (seams only where a turn splits the outline). All 61 fps.
- Control rows wrap (25 versions now); the site gets the aura wash and grain.

## Site critique pass (03:36)

Sonnet critique on the three viewports, applied: inactive sections recede (opacity .42), active heading 30px (26 narrow), lede 13px and items at 80% with .02em tracking, the accent tick on right-aligned headings needed `.sec.on.sec-code` specificity (it was orphaned at the block's left), trailing dots on right-aligned lists removed (they wrapped alone), floral opacity .26 and 24px more clearance above the deck, mobile canvas raised 10vh so the section and deck share the first screen. Left alone on purpose: the cube. `shots/sheet-all.png` = every version v3–v23 at one frame.

## v24–v26: per-cubie Poisson (03:38)

In field modes the face shader now cuts the seam hairline out of the alpha, so the GPU Poisson sees every cubie face as its own shape: v24 liquid metal = 27 chrome cubies with paper's exact field each, v25 gem smoke icemint per cubie, v26 v24 in noir. Continuous through turns (the solver is per-frame, warm-started). Integrated GPU (no PRIME, `--igpu`): v10 39, v16 36, v19 43, v24 61 fps; the three heat blur chains at 1024 are the cost, Poisson at 256 is cheap.

## Site: glass detail panel (03:42)

Clicking an item opens a glass panel (backdrop blur 18px over the cube's glow, 55% bg2, 14% bright hairline, inset top highlight) on the far side of the section, with placeholder title / paragraph / media slot / meta; Esc or close dismisses; opening turns the cube once; other sections fade to 12% while it is open. Narrow: bottom sheet. Narrow screens also use a 768 mask so integrated GPUs keep up.

## Site: scheme → palette, idle turns, wheel (03:48)

- `HEAT_OF_SCHEME`: when the site's cube version has no fixed preset, the heat palette follows the scheme (icemint/ice/mint → icemint, ember → ember, graphite → graphite, aura → paper default, paper → sepia). Key `c` now recolours the cube and the aura together.
- Idle: spin .12 rad/s plus one random layer turn every 6.5 s (`autoInterval`); reduced-motion disables both. Wheel walks the deck (one step per gesture, 900 ms gate). List items are the clickable controls (Chromium computes `display: inline` on a button as inline-block, which orphaned the bullet).

## v27–v29 fusions + second review (03:55)

- `fuse: 'liquid' | 'smoke'` on a heat version: the same camera and mask scene render a second mask (per-face field, seams as alpha holes), the fused shader draws to a screen-size target, heat draws to another with its alpha rewritten to `max(1 - inside, smoothstep(0, .35, contour))`, and a composite pass mixes them: heat keeps the halo and the seam rims, the fused shader owns the faces. The fused pass uses `scale / 0.571` so the full mask spans the same screen area heat's central window does. v27 heat + ice liquid Rubik's, v28 heat + icemint smoke Rubik's, v29 box heat + noir liquid.
- Second sonnet review fixes: max-reduce now halves eight times sampling the 2×2 block centres (the 4× chain missed most texels); the alpha is box-filtered at full res before the 256 downsample so hairline seams survive; `step()` closes the panel; a killed turn tween still settles its promise. Left: v24/v26 inherit `halo: true`, which is visually identical for liquid metal (its own outside is colorBack); half-float targets assume WebGL2 colour-buffer-float, which every current browser has.

## v30–v31, presets, iGPU path (04:05)

Presets: icemint grain (noise .3), icemint diagonal (angle 40). v30 gem smoke Rubik's per cubie with the outer plume kept on the dark scheme. `bigDiv` (2 | 4) runs heat's big blur at quarter res: v31 = v16 with bigDiv 4, same look, integrated GPU 41 → 48 fps; the site uses it under 900px along with the 768 mask. Old cube tab re-verified with `shoot.mjs` (all sets, 12 turns, integrity ok) after making it switch tabs first.

## Site: scheme background is the shader background (04:12)

The canvas paints paper's `colorBack`, so a light scheme was black behind dark text. The site now passes the scheme's `bg` as `colorBack`; `paper` renders a light page with the sepia cube (grain and all), `graphite` a monochrome one. All seven schemes verified (`shots/site/scheme-*.png`).

## Review-3 fixes, URL params, v32 (04:15)

Third sonnet review: touch-orbiting the cube no longer counts as a swipe (target inside the canvas is ignored); the fusion's second mask honours `field: 'cube'`; dead heat entry dropped from the fusion preset table. `?tab=&c=&v=` link a specific tab / scheme / site cube (e.g. `/?v=v27&c=ember`), the site's readout lists the keys. v32 = inverted polarity heat Rubik's (the old v2 idea through the new pipeline, no halo, shaded).

## ASCII portrait placeholder (04:22)

`src/Ascii.tsx` (sonnet-written): a canvas ASCII bust from a procedural lit ellipse pair, seeded noise, breathing scale, 15 fps, reduced-motion aware; sits in About where the webcam portrait will go. 30×18 cells at 4 px.

## v33–v34 rounded cubies (04:30)

`rubikRound` swaps cubies for drei RoundedBox. Its uv puts the bevel at the face border, so the painted seam widens across the bevel: v33 (r .08, seam .035) = pillowed tiles with broad glowing gaps; v34 (r .06, seam .012) = soft corners, thin glow. The glass panel now emerges from the cube's side (scale .72, blur 6px → in place); shader-cube tab opens on v10.

## v35 (04:35)

Liquid metal on rounded cubies with per-cubie Poisson (seams cut the alpha): 27 icy chrome pillows, continuous through turns. Site cycle now includes v34.
