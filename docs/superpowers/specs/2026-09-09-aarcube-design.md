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

## Site layout A/B (04:40)

Key `l` toggles `corners` (four sections around the cube) and `deck` (cube alone; the active section's title, blurb and items sit above the deck, panels do the rest; floral fades to 16%). One of the morning decisions is now a live comparison. `.site-head`/`.site-base` are pinned to rows 1 and 4 so an empty middle never pulls the base up. Floral seed follows the scheme.

## Morning cull (2026-09-09 11:00)

Aaron: condense, no decision fatigue. Deleted the cube tab (`Cube.tsx`, `materials/`, bloom, postprocessing dependency, its scripts) and `HeatCube.tsx` (old v1/v2); the shader cube tab replaces it, renamed. Kept 14 versions, renumbered: old v10 v11 v12 v13 v14 v17 v18 v19 v23 v24 v27 v31 v34 v35 → v1–v14. Every survivor is a Rubik's cube, so PaperCube lost the box / rounded / octa / cage shapes, `EdgeBars`, the blurred-silhouette field, `polarity`, `seamValue`; one preset table (`PRESETS_OF`, `presetNamed`) replaces the three copies; grain / diagonal presets dropped. All 14 at 61 fps, integrity ok; build 357 kB gzip (was 407). `__aar` hooks renamed `setShader*`.

## Paper-tab cube demos, second renumber (11:15)

The four whole-face-plate versions (old v11 v12 v17 v18) read as plain shader cubes, so they moved to the paper tab as `CUBE_DEMOS` (512 mask, camZ 8, spinning, a turn every 4 s) under the official panels. Shader cube keeps 10: v1 heat hero · v2 heat no halo · v3 liquid cubie plates · v4 heat icemint hairline no halo · v5 liquid silhouette Poisson · v6 liquid per-cubie Poisson · v7 fusion · v8 heat icemint quarter-res · v9 rounded hairline · v10 liquid rounded Poisson. Site cycle v1 v9 v4 v7 v2 v6.

## v11: the site candidate (11:50)

v10's rounded cube (r .07, Poisson per cubie, 60 iterations so the field keeps up with a turning slice) with **themes**: a theme picks shader + preset and may override version fields (`PaperTheme`, `withTheme`). v11's eight: default, backdrop, ice, mint (liquid) · heatmap, heatmap grain, icemint, icemint grain (heat, on the same rounded cube with hairline seams .015, gap 1.03, camZ 20, halo). Themed versions force one scale per shader (.6 liquid, .75 heat) so backdrop stops rendering huge. Every lab cube now takes the scheme background as `colorBack` (like the site). Look controls: `gain` (brightness 0.7–1.4) and `alpha` (cube-body opacity 0.5–1) as rows and `__aar.setShaderLook`. Turn check: cubies snap by rounding the rotation matrix (not Euler angles); `orientationError()` reads 2e-16 after 20 turns; the cube's pixel centroid holds within a pixel across turns. The apparent "offset" in stills was the heat band moving, not geometry. `scripts/v11-shoot.mjs` shoots all themes still + mid-turn and a brightness × opacity grid.

## v11 revised: colour ramps on the liquid effect (12:20)

Aaron: keep v10's effect and cube, port the *colour schemes*, nothing outside the cube. So v11's eight themes are all liquid metal: default, backdrop, ice, mint, and four "tinted" presets = paper's default chrome with its luminance run through a palette in the final pass (`ramp` stops as vec4[10], `rampGamma` with a negative value flipping dark-as-hot, `grain` = static noise on the luminance before the ramp). heatmap / heatmap grain use paper's heat palette at gamma 1.2; icemint / icemint grain use the icemint palette at gamma 1. The band sweeping through the chrome becomes the hot band of the heatmap. `__aar.setShaderOverride(params)` merges params for review scripts. Halo off, scheme background, brightness / opacity rows stay.

## Turn misplacement found and fixed (13:00)

Aaron: "the turning still causes some of the cubes to be misplaced". Geometry was exact (new `placementError` probe: mesh position vs slot × gap, parent must be the root: 0 after 60 chained turns). The misplacement was drawn: seams and per-cubie plates were computed from uv, and drei's RoundedBox is an ExtrudeGeometry whose cap faces and side walls carry different uv scales, so a rotated cubie showed its seam off the true edge. Seams and plates now come from local position and the face normal (`across(vLocal, vLocalN)`, edge distance `0.5 - max|f|`), identical on box cubies, correct on rounded ones. Also hardened the turn: pivot and cubie matrices are recomposed before `attach` and after the snap, so a turn started before the next render cannot reparent a stale transform. `papercube-shoot.mjs` integrity now includes orientation and placement errors. Brightness now scales the cube body only (it multiplied the whole frame, background included); opacity already did.

## Poisson mask: min-filtered downsample (13:20)

Moving seams from uv to geometry made them a true hairline, which the box-filter + bilinear downsample to the 256² Poisson grid washed below the alpha threshold: the 27 per-cubie fields merged into one. The mask alpha is now min-filtered over each destination texel's footprint (`DOWNMIN`, 4×4 taps at 1024, 3×3 at 768), so a hairline stays a hole and every cubie face keeps its own field. Verified: combined view shows 27 separate plates, integrity (positions, orientation, placement) passes for all 11 versions, 60 fps.

## v11 restored, v12 = the geometry-true one (13:40)

Aaron: "the cube looks different now, make this recent change a v12 and restore the old v11". Two version fields now carry the difference: `seamSpace` ('uv' = seams and plates from the geometry's uv, the v1–v11 look with its wider seams on rounded caps and the drift after turns; 'geometry' = true edges) and `poissonDown` ('blur' = box filter + bilinear, thin seams close and neighbouring cubies share a field; 'min' = hairlines stay holes). v11 is back on uv + blur; v12 is v11 on geometry + min. Same themes on both.

## v13: v11's look without the drift (14:00)

Why v11 drifts: drei RoundedBox caps have uv 0–0.86, so v11's uv seam only ever drew on two sides of each cap and its plate sat off-centre; after a turn a cubie shows different faces and the seams jump. v13 keeps the soft blurred Poisson mask and thin seams but measures seams and plates from the geometry (`seamSpace: 'geometry'`, seam .04, chosen against .035/.05/.065 by eye next to v11). `__aar.setShaderVersionOverride(partial)` lets review scripts vary version fields live. v11 and v12 stay as they are.

## v13 = v11 pixel for pixel, no drift (14:30)

Aaron: "v13 still looks different to v11, v11 has more rounded corners, use playwright to help confirm they look the same, no new versions". What v11's uv does on drei's RoundedBox (an ExtrudeGeometry): every face's uv is coordinate + 0.43 (caps: x, y; walls: contour coordinate and 1 − z; every bevel strip belongs to the walls), so seams fall only on the low side of each face and each plate is centred at +0.07. That asymmetry is the softer, rounder read. `seamSpace: 'cube'` rebuilds exactly that mapping in cube-space axes around each cubie's centre (`vCube - vCubieC`, `acrossExtrude` with the cap rule |n.z| > `capCos`), so it equals v11 at rest and is the same for every cubie orientation after turns. Verified with `scripts/v11-v13-diff.mjs` (speed 0 so both sit on the same frame): mean pixel difference 0.35–0.54 / 255 across all eight themes, ≤0.53% of pixels differ by more than 24, and the cap threshold sweep (0.8 → 0.999) showed 0.999 is the extrusion's own split. v13 placement and orientation error 0 after 12 turns; the after-12 frame keeps a straight grid.

## Vanishing faces on the ramped themes (15:00)

Aaron's screenshot: cubie faces reduced to bright discs. Reproduced with paper's `frame` time offset (now a param: `u_time = clock × speed + frame`): at some phases the chrome band is dark across a face, the icemint / heatmap ramp maps that to its first stop, which is the page's navy, and the face disappears leaving the dispersion rings. `rampFloor` remaps the luminance into [floor, 1] before the ramp: icemint themes .2, heatmap .12. Same phases now keep a visible navy face with the grid intact. Applies to v11 and v13 alike (shared presets), so the two stay pixel-identical.

## v14 + mid-turn squash fixed (15:40)

v14 = v13's cube with Aaron's keepers: ice, ice grain, mint, mint grain (grain now also applies to untinted themes as luminance noise), and icemint grain with its brightest stop toned to #d6ebe4 (`icemint grain soft`, other stops untouched). `outline` row (off / line / glow): the final pass samples the mask's lambert channel around each outside pixel (16 directions, 1–3 radii) and paints the scheme accent behind the silhouette, seams excluded.
Aaron's mid-turn screenshot (elliptical discs on the turning slice) was the cube-space mapping projecting tilted faces onto cube axes. `seamSpace: 'cube'` now stays rigid in each cubie's own frame and only carries the cube-space constants across: the +0.07 plate shift and the cap axis are rotated into the cubie frame per vertex (`vShift`, `vCap`), so a turning slice keeps square plates, the offset rotates continuously, and rest frames remain pixel-identical to v11 (re-verified, 0.35–0.55 / 255).

## Turn creases solved for good; v14 icemint grain on the site (16:40)

Aaron's second mid-turn screenshot reproduced with the current code once the materials rebuilt (the `Q` memo now depends on the shader sources, so a hot reload cannot keep old GLSL). Three causes, three fixes, all invisible at rest (v13 vs v11 still 0.33 / 255):
1. Face choice used the interpolated normal, which drifts across a rounded face and split faces into two mappings on turning cubies. Now the face is the largest |local coordinate| (`acrossRigid(pos, shifted)`), no normals involved.
2. v11's one-sided seams let a moving cubie's face abut a static face in screen space with no hole, and the Poisson field bridged them into one island (the chevrons). Each cubie writes its id into the mask R in Poisson mode (`onBeforeRender` sets `uId`, `uniformsNeedUpdate`), and the Jacobi step treats a neighbour with another id as a wall.
3. Where a nearer cubie overlaps a farther one there is no painted seam at all, so the two fields met without a line. The face shader writes view depth into the mask alpha (relative to camZ over 6 units) and an `EDGE` pass cuts a hairline out of the alpha wherever depth jumps between two inside pixels, so occlusion edges look like every other seam. `seamSym` (seams on all four sides) exists as a field but changes the rest look (mean 15 / 255) and is off.
Verified: every axis × layer × direction mid-turn at Aaron's low viewing angle, no creases, no discs; placement 0; 60 fps.
Site: default cube is v14 with the `icemint grain soft` preset (`SITE_PRESET`), cycle starts there; liquid versions use scale ×0.45 under 900px (heat kept ×0.7) because liquid maps the whole mask, not paper's 57% window.

## Site cube theme toggle (17:00)

Under the deck, a small three-way toggle for the v14 site cube: ice / mint / icemint (presets `ice grain`, `mint grain`, `icemint grain soft`); key `g` cycles. Ice grain and mint grain now carry `grain: 0.7` (was 0.3) so the noise reads as grain on the untinted chrome. Lab presets share the change.

## Site turns scrambled the cube (14:40)

Aaron: "the cube in the site page is still bugging out on turns". Reproduced on the site itself (`scripts/site-sweep.mjs`: every axis × layer × direction per site theme, three frames per turn; `scripts/site-rec.mjs`: a recording per theme split into frames and scanned for pops). Mid-turn, nine cubies that were not a layer swung together, cubies ended in occupied slots leaving a hole, and the cube snapped whole again at the end of the turn, so the rest-state placement probe never saw it. Root cause, in `RubikMask`: the cubie `ref` callbacks were inline arrows, so React ran them again on every re-render and each run rebuilt the cubie record with the *starting* cell as its logical position while the mesh stayed where the last turn left it. The site re-renders on every deck step and theme click (the lab never re-renders between turns, which is why it stayed clean). The next turn then filtered the slice by stale positions. Fix: `track(i, mesh)` keeps the record unless the mesh itself is new. The site exposes its cube to scripts as `window.__aarSite`. Verified after the fix: off-slot count 0 through the mount turn, a driven turn and a re-render; sweep placement 0 on ice / mint / icemint; recordings show coherent layer turns and no pops beyond the theme switch; lab v14 integrity ok, 61 fps. Shader, presets and the cube's look untouched.

## v15: ascii outline, site on mint grain (15:30)

Aaron: mint grain is the one; hide the theme toggle and the legend line under it; try an off-white ascii outline that blows to the right; asked whether a new tab should track versions. Decision: no new tab, the shader cube tab already is the version ledger, so the outline is v15 there and the site runs v15. Site: toggle and legend removed (key `g` still cycles themes for review), default theme mint grain, `v` cycle starts at v15.
The ascii outline is a fourth outline mode in the final pass: the screen in glyph cells (`cell` css px × dpr); each cell's density is how near the cube is when looking out from the cell centre along 12 directions × 6 steps, with the reach multiplied by `1 + bias` toward the left so glyphs trail off to the right of the cube; a per-cell hash times `scatter` thins the far cells; density picks one of seven 5×5 glyphs packed as ints (`.` `:` `*` `o` `&` `8` `@`). Colour `#ece8df`, only outside the silhouette. Version fields `outline` and `ascii { cell, reach, bias, scatter, color }`; lab rows `wind` (tight / breeze / gale / storm) and `cell` (7 / 9 / 12 / 16) override them. The line / glow branch now stops at mode 2 (it drew a glow under the glyphs at first). 61 fps lab and site.
Blank frames: Playwright screenshots occasionally come back with an empty canvas (one in ~160 in the sweeps, once after a uniform change). `scripts/blank-frames.mjs` reads the WebGL canvas back every frame after R3F's own rAF: 0 blank frames in 3642 across turns, deck steps, wind and preset changes on both pages, so those tiles are captures landing between clear and draw, not rendered frames.

## v16: still ascii outline, marks, mint to white (16:00)

Aaron: the ascii must not move with the turns; less on the top, left and bottom; different characters; try mint fading to white. v16 = v15 with `ascii { reach .022, bias 8, still, glyphs 'marks', color #9de8d4, color2 #f2f3f7 }`. `still`: a plain box the size of the cube sits under the root on layer 1 only and renders into a 256 mask each frame (`renderMask(..., layerMask 2)`); the ascii density samples that (`u_asciiMask`) while the glyph cut-out still uses the real mask, so a turning layer neither drags glyphs along nor gets glyphs painted over it. Reach .022 leaves one or two cells on the three quiet sides; bias 8 keeps the trail on the right where it was. `marks` glyph ramp . - ~ + x % # (bit x + 5y, y down); `dots` keeps v15's decode so v15 is unchanged (checked side by side). Colour = mix(color2, color, density): mint next to the cube, white at the tail's end. Site runs v16. 61 fps.

## Algorithms on j k l, at speed (16:30)

Aaron: keys j, k, l for famous algorithms (U perm "or whatever"), turns fast. `RubikMask` gains `parseAlg` (standard notation: U D R L F B M E S, prime, 2; face letters in cube space U +y, R +x, F +z, a clockwise face turn seen from outside = negative rotation about the +axis) and `run(alg, duration = 0.12)`, which holds `busy` for the whole sequence so the idle auto-turn cannot slip a move in, tweens each move at 0.12 s (`power2.inOut`, half turns 1.5×) and snaps as before. Keys: `j` T perm, `k` U perm (Ua), `l` Sune, on the site and in the lab; the site's layout toggle moved to `x`. Deck and idle turns keep their 0.55 s. `scripts/alg-check.mjs`: T perm ×2, U perm ×3, Sune ×6 return corners and edges to the start (face-centre twists are supercube state the cube shows nowhere), about 7 turns a second, placement 0, keys start a run, lab hook `__aar.paperRun` / `paperState`.

## Turn feel: weight (17:00)

Aaron: "add a bit of weight or animation timing to the turns, right now they feel a bit fake". The symmetric power3.inOut read as a motor. A layer under a finger flick is now the step response of an underdamped second-order system (`response(zeta, w)` in `RubikMask`, normalised so the curve ends on the detent): zero velocity at the start (inertia), peak speed about a sixth of the way in, a few degrees past the detent, settle. Deck and idle turns: ζ 0.7, ω 7, 0.5 s, 3.7° overshoot; algorithms: ζ 0.75, ω 8, 0.14 s, 2.5°; half turns 1.4× longer. The body (RubikMask's own root) recoils against the layer in proportion to the layer's speed (1.4° deck, 0.7° algorithms) and returns to exactly zero on completion. The tween drives a progress proxy with `ease: 'none'`, so the curve is plain math and the snap at the end is unchanged. Verified: v16 integrity after 12 turns, algorithm identities, 61 fps; a recorded deck turn shows the fast early sweep and long settle. `site-rec.mjs` records the default site cube now (the theme toggle it clicked is gone; `--g n` presses the theme key).

## v17: code glyphs, dither, fade, glow (17:30)

Aaron (after the turn feel: "looks a lot better now"): top and bottom slightly thinner, ascii symbols closer to code, a faded dither effect with a bit of glow. v17 = v16 with `ascii { glyphs 'code', squash .35, dither 1.2, scatter .2, fade .6, glow .35 }`. `squash` scales the reach by `1 − squash·|dir.y|`, so straight up and down reach 65% of sideways. `code` ramp . ; / < = { #. `dither`: a 4×4 Bayer threshold per cell shifts the glyph level by up to ±0.6 steps between neighbours, an ordered pattern instead of noise (scatter kept low for a little irregularity). `fade`: glyph brightness scales by `mix(1, density, fade)`, so the tail dims as well as whitens. `glow`: a soft blob of the glyph colour under each cell, by density, only where a glyph exists. Site runs v17. 61 fps.

## Floral tab: the x-ray technical floral (18:15)

Aaron sent five references for the base of the site: an x-ray poppy with data panels, an iridescent iris with measure lines, a specimen poster with hex swatches and corner frames, a peony with file-name callouts and coordinates, and a scanner video with jittering x / y readouts. New tab `floral` (fourth tab, `?tab=floral`) with a version row and a seed row, the floral at 2× and at the site's size, and `/?floral=vN&seed=S` to see any version on the site's base (the site keeps the old wireframe until one is chosen).
`src/XrayFloral.tsx` builds the plant from a seed in a 640×140 viewBox: a bloom of two petal rings (soft-tipped paths on a radial gradient that brightens toward the rim, screen-blended so overlaps glow, veins, a rim stroke), a stamen cluster, a stem with a glow pass and a bright core, three lanceolate leaves from `Floral.tsx`'s `leaf()`, a bud on a side branch; colours are the scheme's CSS variables (petals `--a`, stem and leaves `--b`). The technical layer: callouts in two columns beside the plant in fixed slots (nearest free slot to the anchor, one-elbow leaders, a few blink), x / y readouts (static or ticking), frames with corner marks (bloom or every part), dashed arcs that drift, a base ruler, a hex swatch row read from the CSS variables, measure lines with ticks, specks. `src/floralVersions.ts`: v1 x-ray · v2 blueprint (callouts, bloom frame, coordinates) · v3 spectral (explicit hsl hue per petal, since a hue-rotated gradient washes to white under screen; measures) · v4 specimen (solid off-white stem and leaves, swatches, part frames) · v5 scanner (live readouts, arcs, part frames, specks). `scripts/floral-shoot.mjs` shoots every version and two site previews. Two layout passes: margins-wide leaders and overlapping boxes → slot columns near the plant; swatches over the frame label → frame label below the frame.

## Floral path 2: the mesh x-ray (19:15)

Aaron: "doesn't look like the images at all", asked what the style is and what makes it. Research: Macoto Murayama's "Inorganic Flora" (dissected flowers modelled in 3ds Max, rendered translucent, annotated in Illustrator), the x-ray photography lineage (Koetsier, Veasey), Midjourney's "x-ray" style for the AI posters. The look is a rendered mesh with fresnel transparency and a dense wire, which flat SVG cannot reach. Two paths offered (Blender stills, or live in R3F); Aaron chose live.
`src/xrayMesh.ts`: a procedural flower from a seed. Petals are parametric surfaces along +x (a broad fan that widens to a rounded tip, curl, cup and an edge ripple that grows toward the tip), eight open outer petals and six cupped inner ones on a tilted bloom; 56 stamens on a cap with filament lines; a tube stem on a Catmull-Rom curve; three lanceolate leaves (`leafGeometry`, folded down the midrib) placed by the stem tangent; a lathe bud on a side branch. `src/XrayFlower3D.tsx`: an R3F canvas with a transparent background, every surface drawn with a fresnel shader on additive blending (`uColor · (base + gain · (1 − |n·v|)^power)`, double-sided, no depth write) plus the same geometry in wireframe at low gain; stamens instanced. Anchors (bloom centre, stem, bud, leaf tips, petal tips) are projected through the camera once into the 640×140 viewBox and fed to the shared technical layer, which now lives in `src/xrayTech.tsx` (`layoutTech` + `TechLayer`) and serves the SVG plant too. Colours come from the scheme table, since on the site the floral mounts before App applies the CSS variables (the first cut read them and drew a blue stem). Versions v6 mesh x-ray · v7 mesh blueprint · v8 mesh scanner (`kind: 'mesh'`, `wire`, `fresnel`). The mesh floral's canvas is positioned in its own box (`.xf3d canvas`), not fixed over the page like the cube's. First render had spiky petals and a blown-out centre: petal profile, two rings instead of three, fresnel power 3 / base .012 and dimmer stamens fixed it.

## Flower assets: ten types, two ghost looks, soft foliage (20:30)

Aaron: no tracking yet, just the floral design; more types of flowers; blur the stem and leaves, the flower is the focus; the ethereal see-through ghost look of three new references (iridescent poppies with warm centres, the white-blue flax, translucent pastel tulips); keep iterating until there is a set to pick from.
`src/xrayMesh.ts` became a flower table (`FLOWERS`): poppy, tulip, lily, peony, daisy, iris, bell, lotus, rose, orchid. Each spec is petal rings (count, length, width, `rise` out of the bloom plane, curl, cup, `tip` blending a broad rounded fan into a pointed lanceolate, ripple, `spiral` for the rose's golden-angle whorl that tightens and stands up toward the centre), a centre (stamen cluster with filaments, a phyllotaxis disc, six long stamens and a pistil, or none), stem length / lean / width, leaves (count, size, low at the base or up the stem), a bud, and a palette (body, rim, centre). The bell is a lathe corolla flared into five lobes, flipped to hang from a hooked pedicel. `upright` composition for the tab (bloom framed, camera closer) and the wide one for the base.
`src/XrayFlower3D.tsx` now runs two canvases in one box: foliage (stem, branch, leaves, bud) underneath with CSS `blur` and `dim` from the version, the bloom crisp on top. The x-ray shader gained a rim colour (body → rim along the fresnel) and `irid`, a thin-film sheen whose hue rolls with the view angle. Centres are instanced spheres with a larger faint halo; dense centres get a weaker halo. Colours: `tint 'mono'` = the scheme's ghost blue-white, `'spectral'` = the flower's palette. The tab has a `flower` row for mesh versions and one big upright stage; `/?floral=v10&flower=rose&seed=3` shows any of it on the site; `scripts/flower-sheet.mjs v10 3` shoots every type into a contact sheet.
Versions: v9 ghost (scheme white-blue, sheen .25, foliage blur 2.5 px at 55%) and v10 iridescent (palette, sheen .6, warm centres ×1.6, same soft foliage). Iterations: bloom framed larger; bell hung from its closed end; tulip, lily, iris, orchid widened; a stray bright dot was every stamen instance drawn at the origin because the on-demand canvas rendered before the instance matrices were set (`invalidate()` after setting them).

## Bud, pollen, the lost first frame (21:00)

Aaron: an odd dark octagon on some flowers (the bud: an 18-segment lathe, dim, then blurred) and the pollen too bright and loud, breaking the homogeneity. Bud: a 48-segment teardrop with five sepal ridges and a pointed tip, brighter rim and its own wire pass. Stamens: drawn with the same x-ray shader as the petals (the vertex shader now handles `instanceMatrix`), so they are small translucent rings in the centre colour instead of solid discs; the halo spheres are gone; filaments dimmer. Dense blooms: petals carry a `layer` (0 outer to 3 inner, the rose's spiral mapped onto it) and inner layers use lower gain and a much lower base, so the peony's four stacked rings no longer sum to white. The first gallery tile after a fresh page load came back empty twice, with the canvases on `frameloop="demand"` even after an explicit invalidate; on `always` it rendered on three consecutive loads, and the site with the floral still runs at 61 fps, so the two canvases stay on the normal loop.

## v11: flowers on the ground, mint (21:30)

Aaron: "make an example of flowers on the ground in mint colorscheme as v11". A `scene` mode on the mesh floral: the version lists flower types, `plant()` builds each from its own seed, spreads them along x with a little depth (front ones larger), and roots each on a ground plane by its stem's bounding box; a faint additive wire grid on that plane (foliage canvas, so it blurs into a soft floor) reads as the ground; the camera sits higher and looks slightly down. `scheme: 'mint'` forces the mint scheme's ghost tint whatever the page shows; `petalWhite .2` keeps the petals mint rather than white. Eight flowers: peony, tulip, poppy, daisy, rose, bell, lotus, iris. First cut crowded the top half and washed to white; wider spread, smaller scales, a farther higher camera, a stronger grid and lower gain fixed it. The tab hides the flower row for scene versions and gives them a wider stage.

## v11 second pass: no buds, no daisy, a layered bed (22:00)

Aaron: the blobs are still there (the buds, blurred into teardrops), no daisy, some stems don't line up, overlay the rest of the flowers in a few seeds on top of each other. `buds: false` on the version (`buildFlower` takes `withBud`); daisy out of the list; the scene plants its list three times (`layers`), each layer its own seed and shuffled order, back layers smaller and dimmer (`gainMul` on the materials) and farther, front layer large and bright, every plant with its own stem length (`stemMul` .65–1.35) so the blooms sit at different heights; the bed spreads ±4.3 with the camera farther and higher. The top fifth of every stem is drawn again on the crisp canvas (`stemTop`) so each bloom visibly sits on its stem through the foliage blur. Alignment checked with the blur and dimming removed via a stylesheet override on the canvas wrappers (R3F puts `style` on the wrapper div, not the canvas): every stem reaches the ground and its bloom.

## v12: the bed along the bottom of the page (22:30)

Aaron: drop bell and iris, less bright and glowy but keep the colour's vibrance, arrange them at the bottom of the page as on the real site. `placement: 'bottom'`: on the site the bed is a fixed page-wide strip (`BottomBed`, width = window, height 17% of it clamped 160–260 px) above the cube canvas and under the UI (`.floral-bottom` z 1, `.ui` z 2); the tab previews the same strip at page width. The scene sizes itself to the box: the bed's world width comes from the camera distance and the box's aspect, the list repeats to fill it (`density`), plants scale by `height`, the camera looks a little higher so the bed sits low in the strip. Dimmer: fresnel gain .32 / base .004, wire .07, centre glow .3, foliage at 45%; colour kept by leaning petals only 10% toward white and rims 55% (`rimWhite`). Five kinds in three layers. First cut at gain .55 was still white-hot and dense enough to climb into the section text.

## v13 → v14: the keepers as an exact arrangement (23:00–23:40)

Aaron, after "I dont think I like the florals": "I like lotus, rose and orchid, small grouping of these 3 without the pollen balls, color scheme of v9" → v13 (a scene with an explicit `spread` plants its list exactly once, `pollen: false`). Then: "no more seeds, make it an exact arrangement, flip the lotus around and place it close with rose and orchid, make orchid smaller, make the rose and lotus darker like orchid and get rid of the stems" → v14. `scene.place` lists each bloom by hand: bloom centre `at`, `scale`, `rot` (applied about the bloom centre by nesting the flower under a group offset by `-bloomCentre`), and per-flower `gain` / `wire` multipliers; a placed scene ignores seeds (fixed seed per item) and the tab hides the seed row. `foliage: false` drops the stem, leaves and the crisp stem top. Lotus turned 180° about y (its back to the camera); orchid at .52 of the others' .8. Dimming the rose's fresnel gain alone did nothing to its white core: a dense bloom's core is its wire pass (26 spiral petals, the small inner ones drawn at full segment count), so `wire` .3 on the rose and .45 on the lotus brought both to the orchid's level. Shots `shots/flowers/v14.png`, site `shots/floral/site-v14.png` (`/?floral=v14`). Vite gotcha: writing a source file with a truncating write while the dev server watches can leave an empty transform cached ("does not provide an export named …"); `touch` the file.

## v15: closer, the lotus facing right, the rose up and left (23:50)

Aaron: "move them slightly closer together, have the lotus face right and rose face up and left, make orchid a tinny bit bigger" → v15. Same `place` table: rose `rot [-0.45, 0, 0.4]` (less forward tilt, leaning left), lotus `rot [0, 1.15, 0]` (a three-quarter turn to the right rather than a pure profile, which read as a flat fan with a hot base where the petal bases converge; gain .26 / wire .35 to tame that base), orchid .58, centres pulled in to ±.42. Then "lotus facing forward up and right, no v16 just change it": v15 edited in place (his call), lotus `rot [0, 0.4, -0.3]`, gain .3 / wire .4. Aaron: "its facing down? The petals are curving downwards": the lotus's outer ring rises only .45 rad, so with the bloom's built-in .75 forward tilt and the camera above, the near petals point down on screen; tipped back to `rot [-0.6, 0.4, -0.3]` the cup faces the camera and the petals read as rising. Shots `shots/flowers/v15.png`, `shots/floral/site-v15.png`.

## Pose sliders on the floral tab (00:10, 2026-09-10)

Aaron: "give me a way to position the lotus how I see fit". For a version with `scene.place`, the tab shows a pose row: pick a flower, then sliders for its centre (x y z), rotation (rx ry rz in degrees, about the bloom centre) and scale; the readout prints the resulting `place` entry as it would go into `floralVersions.ts`, with a copy button. Poses are tab state only (reset clears them); the committed version changes when the entry is pasted back. Vite gotcha again: a truncating write while the dev server watches can cache an empty transform (`does not provide an export named …`); `touch` the file.

## v16: the lotus as Aaron posed it (00:30, 2026-09-10)

Aaron tinkered on the tab (zoom 1.5, finer steps, arrow keys) and pasted `{ flower: 'lotus', at: [0.18, -0.18, 0.09], scale: 0.69, rot: [-1.49, 0.4, 0.35], gain: 0.3, wire: 0.4 }` → v16, a copy of v15 with that entry; v15 stays as his base. Shot `shots/flowers/v16.png`.

## v17: the orchid as Aaron posed it (00:40, 2026-09-10)

Aaron: v16 "looked a bit wrong", new line `{ flower: 'orchid', at: [-0.1, -0.43, 0.39], scale: 0.73, rot: [-0.06, 0.09, 0], gain: 1 }` → v17 = v16 with that orchid. A pasted line carries one flower; anything else he moved on the tab is not in it, which is the likely mismatch. Shot `shots/flowers/v17.png`.

## The group on the site (00:50, 2026-09-10)

Aaron: "port it to the site page replacing the current floral". `Site` now defaults `floral` to v17: the base row shows the hand-placed group instead of the old wireframe (`Floral.tsx` stays as the fallback for an unknown `?floral=`). A placed scene sits in a 160 px box pulled up 24 px into the row's padding, with the camera 1.35× closer than the version says (the tab shows it at its own zoom); a 200 px box pushed the deck nav below the fold at 1440×900. Measured: floral 669–829, deck nav 839–876, no page scroll. Shot `shots/floral/site-v17.png`.

## v18: the group bigger and mint on the site (01:00, 2026-09-10)

Aaron: "for the site can you make the flower collage bigger and give it a mint color" → v18 = v17 with `scheme: 'mint'`, `petalWhite .2`, `rimWhite .6` (as v11/v12 kept the mint rather than washing to white). Site default → v18; the placed group's box is 210 px pulled 74 px up into the row's padding (its top now meets the cube's lower corner) with the camera 1.9× closer than the version. Measured at 1440×900: floral 619–829, deck nav 839–876, no scroll. Shots `shots/floral/site-v18.png`, `shots/flowers/v18.png`.

## Transition tab: cube to screen (01:30, 2026-09-10)

Aaron: "make a new tab for working on the cube transition to screen idea I had, use a simple grey rubiks cube, no effects, Im looking for the cube to spin and move into the camera filling the screen and then fading into a new page". Tab `transition` (`src/TransitionTab.tsx`, versions in `src/transitionVersions.ts`, additive): 27 grey rounded cubies under two lights, no shaders, resting in the three-quarter view; `play` (space) runs one GSAP timeline that spins the group whole turns about x and y (so it ends face-on) while flying it toward the camera to the distance where a face fills the viewport, times `overshoot`; the next page (a placeholder with a back button) fades in from `fadeAt` of the flight. `r` / back resets. Version fields: `spin [x, y]`, `duration`, `approachEase`, `spinEase`, `overshoot`, `fadeAt`, `fade`. v1: one turn over, two around, 2.2 s, power3.in approach, ×1.4 overshoot, fade from 72%. Hook `window.__aarTransition.play() / reset()` (the tab mounts before App's `__aar`). Verified with `scripts/transition-shoot.mjs v1` (frames at 0 … 3200 ms → `shots/sheet-transition-v1.png`): the face fills the screen by 1.7 s and the page is fully in by 2.2 s. Two gotchas: callbacks passed to the flight effect changed every render and restarted the timeline each frame (now read through a ref); R3F's canvas stays 300×150 until its resize observer lands (up to ~1 s in headless), so the shoot waits for full size before playing.

## Design: the screen as a cube (02:00, 2026-09-10, agreed in discussion)

Aaron's vision: the cube flies in and its face becomes the section's screen; inside a section the screen behaves like a cube to move between projects. Agreed in back-and-forth:
- **Aspect.** The face stays 3×3; after landing the nine cubies stretch into nine rectangles matching the viewport (portrait: tall tiles). Stretch happens after the landing, as its own beat ("land, then stretch"), not during the flight.
- **Content.** One project spans the whole 3×3 (title, text, image split across the tiles), not a project per tile.
- **Seams.** Normally the tiles are welded into one seamless page. For the next project the seam lines appear at once (a hard cut, no reverse weld), the pieces move, then a weld bead runs the seams and the scars cool away.
- **Movement.** Not rows rolling: individual tiles, one or two in motion at a time, each a quarter turn about its own row or column axis bringing its fragment of the next project in, like solving a face. Three orders as versions: **solve** (centre, edges, corners), **sweep** (diagonal from top-left), **scatter** (fixed irregular order).
- **Build.** A tile is a pivot with two planes: the current fragment at the front and the incoming fragment on the side that rotates in (below for an upward flip, right for a sideways flip), so no box is needed and any aspect works. Flip axis alternates in a checker so it reads as pieces snapping in. Content is a canvas texture per project, each tile's plane carrying its cell's UVs. Perspective camera set so the z=0 plane maps to the viewport exactly. Seams are thin quads with a bead shader (moving hot spot, trailing scar, cooling). Prototyped in the transition tab (`screen` row, key `n` for the next project) before joining the flight.

## Screen solve prototype: s1 solve / s2 sweep / s3 scatter (02:40, 2026-09-10)

Built as designed above in `src/ScreenSolve.tsx`, shown from the transition tab's `screen` row (`?screen=s1%20solve`, key `n` = next project, hook `__aarTransition.next()` / `busy()`). Three placeholder projects drawn as canvas textures at the viewport's size; nine tiles, each a pivot with a front plane and an incoming side plane (below for a checkerboard's even cells, to the right for odd), the perspective camera set so z = 0 is the viewport in CSS pixels. `next()`: the gap opens at once (8 px, the seam quads lit as scars), the tiles flip a quarter turn in the version's order with a 90 ms stagger (260 ms each, power2.inOut), then a bead runs the two horizontal seams and then the two vertical ones (220 ms each) while the scars cool (500 ms) and the gap closes. Whole thing ~1.9 s. First seams at 14 px with a bright scar read as neon bars; now hairline (scar .22, the white-hot term only on the bead). Verified landscape 1440×900 and portrait 420×820 (`scripts/solve-shoot.mjs "s1 solve"` → `shots/sheet-solve-s1-land.png` / `-port.png`, same for s2, s3): the fragments separate at the cut, flip in order, the bead passes at ~1.1 s, the page is whole by 1.9 s. Gotcha: `page.evaluate` awaits a returned promise, so a hook that resolves at the end must be fired without returning it.

## s4–s6: layer moves, eased break, laser weld (03:20, 2026-09-10)

Aaron on s1–s3: cool, but not the idea; the blocks should be constrained like a real cube, rows and columns rolling, one screen at a time or two in one move; keep s1–s3 as versions; the break-apart should be smoother; the weld should not be two passes but three random points on the grid expanding outward and erasing it, like a laser weld, a bit slower. New fields on a solve version: `moves` (layers that roll together, one move after another: r0–r2 rows rolling up, c0–c2 columns rolling sideways; every tile of a layer pivots about its own centre on the layer's axis, which is the layer turn), `open` (the gap eases open over this many seconds), `laser` + `weld` (three random points on the seam lines; each seam pixel takes the nearest point's distance, is erased inside the growing radius and white-hot at the ring; the gap closes over the same time). Layer rolls use the site cube's weighted turn response (`FEEL.turn`). Versions: **s4 rows** (r0, r1, r2), **s5 two and one** (r0+r2 together, then r1), **s6 columns** (c0, c1, c2; the phone's move). 460 ms per move, 240–300 ms between, open 300 ms, weld 950 ms: ~3.2 s in all. Verified landscape and portrait (`shots/sheet-solve-s4..s6-land/port.png`): rows roll as layers, the laser fronts run out from the points and the grid is gone by 2.8 s. Bug on the way: the laser's uniforms were armed when `next()` was called, not on the timeline, so the hot points showed at the start.

## c1–c4: the screen as a real Rubik's cube (04:10, 2026-09-10)

Aaron on s4–s6: "it's not behaving like a Rubik's cube… you are treating each square as its independent cube"; make the weld slower. Right: on a real cube a row of front stickers cannot roll up, it can only slide sideways (a U, E or D turn), a column can only slide up or down (R, M, L), and every sticker belongs to a cubie that carries its other faces along. `src/CubeScreen.tsx` is that cube: 27 cubies as state (`pos`, and each sticker's project, cell and its up / right / normal vectors in cube space), six faces holding six projects (front, right, back, left, up, down, each a page texture at the viewport's size), `turn(axis, layer, dir)` rotating the layer's cubies and their sticker vectors. The front face maps to the viewport (cell = W/3 × H/3); cubie depth follows the coming turn's axis (about y: depth = cell width; about x: depth = cell height) so the incoming face's stickers are exactly the right size when they arrive, which is the stretch idea applied to a cuboid. Objects are rebuilt from state after each sequence; during a sequence each turning layer hangs under a pivot at the cube's centre and rolls with the site cube's weighted turn response. Then the laser weld (1.6 s now). Versions (`CUBE_VERSIONS`, the tab's `screen` row): **c1 row by row** (U, E, D the same way: the right face comes to the front one row at a time), **c2 two and one** (u wide then D), **c3 whole cube** (a y rotation in one move), **c4 columns** (L', M', R: the top face comes down one column at a time). Verified landscape and portrait, `shots/sheet-solve-c1..c4-land/port.png`; the whole change runs 3.7 s (timed by polling `busy()`, since screenshot timestamps drift by up to a second). Six projects are placeholders in `PROJECTS`; up / down projects come in rotated after a mix of x and y sequences, exactly as on the puzzle.

## a1–a3: solving algorithms, and hidden faces printed with the next project (05:00, 2026-09-10)

Aaron: "yes that's the idea"; c4 sometimes lands the page upside down; the weld can wait; now "an algorithm that fixes each square one at a time like actively solving a side… 3 different algorithms that look cool"; and mid-build: "for each pass populate the unseen faces so they get rotated in… more than 6 projects per section". Both in one mechanism: before a pass the sequence is simulated on a copy of the state; every sticker that will end on the front gets printed with the next project's fragment for its final cell, oriented so it lands upright (the in-plane offset is read from the simulation's final up vector), at the first moment it is hidden (at once if it starts hidden, else on the landing of the move that hides it). The cube stays legal, pages always arrive the right way up (that also fixes c4), and the project list is unbounded. Moves now run one after another with a rebuild on every landing, the depth following the next move's axis, so sequences can mix rows and columns. F, S and B are excluded: a face turn on a stretched cube would put a W/3 × H/3 sticker into a H/3 × W/3 slot. The three algorithms were found by searching random six- to nine-move sequences over U D E R L M for ones where every final front sticker leaves the front at some point (so it can be printed unseen) and the count of front cells already holding their final sticker rises gradually to nine (the "solving" look): **a1 rows** `U E D R E D` (2 · 2 · 2 · 3 · 6 · 9), **a2 columns** `R M U M E L` (1 · 1 · 2 · 4 · 6 · 9), **a3 slices** `L E M D R D` (1 · 2 · 4 · 4 · 6 · 9). Famous algorithms (Sune, T perm, H perm) fail the first test: the front centre never leaves without a slice turn. Verified landscape and portrait (`shots/sheet-solve-a1..a3-land/port.png`), and c4's second pass lands upright (`N=2` on `solve-shoot.mjs`).

## Transition tab: v2 is its own version (05:15, 2026-09-10)

Aaron: "you didnt actually make it into v2, everything right now is just stuffed in v1". The version row is the idea level: v1 = the flight with the tile and cube screens (s1–s6, c1–c4) under it; v2 = the solving idea with a1–a3 under it (`TransitionVersion.screens`; `?tv=v2`). Switching version lands on its first screen.

## Cube screen turns = the site cube's turns (05:30, 2026-09-10)

Aaron: "make the turns the same speed as the main cube and the same recoil, so when we change the values for one perspective of the cube it matches". The cube screen now drives every layer turn exactly as `RubikMask` does: a proxy tween with `ease: 'none'` over `FEEL.turn.duration`, the layer angle = `FEEL.turn.f(t)`, and the rest of the cube under a body pivot leaning against the layer by `recoil · speed / peak` (reset on landing). `CubeVersion.flip` is gone; `FEEL.turn` in `src/RubikMask.tsx` is the single knob for both. An a-pass now runs ~5.3 s (timed by polling `busy()`).
