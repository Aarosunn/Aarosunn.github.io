# Overnight run: paper shaders → 3D → Rubik's → mock site

Start: 2026-09-09 02:50 EDT. Minimum end: 06:50 EDT. Models: sonnet for bounded ports/reviews, opus for judgement, no haiku.
Rules: every iteration = new version, nothing deleted; tsc → shoot → judge PNGs → commit → tick here.
Aaron's brief: "heat cube does not match the shaders at all, during the process it was closer; v1 is broken."

## P0 baseline
- [x] diagnose heatcube v1 break, fix, keep v1 exact
- [x] per-version config split (versions additive, like material sets)
- [x] reference frames: paper-ref.mjs for heatmap / liquid-metal / gem-smoke × presets
- [x] contact sheet script: reference vs cube side-by-side per version

## P1 shaders on a shape (heatcube tab)
- [x] heatmap v3+: re-match reference (mask polarity, radii, seams, shade)
- [x] liquid metal on shape
- [x] gem smoke on shape
- [x] shape variants (box / rounded / cage / octahedron), preset play

## P2 Rubik's cube as mask (cube tab)
- [x] v5 silhouette family: heat / liquid / smoke
- [x] seams from cubie edges, turn continuity before/mid/after, 12-turn integrity

## P3 mock site tab
- [x] xray floral SVG bottom, 4 section placeholders, deck-step nav stub, cube centre
- [x] 3 viewports screenshot

## P4 wrap
- [ ] contact sheet of all versions, spec, memory, cron deleted, summary

## Log
- 02:50 start
- 03:05 commit: PaperCube v3-v9, all three shaders on 3D at 61fps. Next: Rubik's mask (P2)
- 03:12 commit: v10-v15 Rubik's mask, v10 heat rubik is the hero. Next: mock site (P3)
- 03:20 commit: site mock. Next: polish versions v16+ (custom palettes, noir liquid, dark smoke, slower speeds), site version switcher, final sheet
- 03:36 commit: presets + v16-v19 + site cycler + review fixes. Next: more iteration rounds (box shapes with aarcube presets, cage variants, speed), then P4 wrap after 06:50
- 03:40 commits: v20-v26 (cage rubik, GPU Poisson, per-cubie Poisson), site critique pass, glass panel. 26 versions, all 61fps RTX. Next: second review, spin/contour tune, report doc, wrap after 06:50
- 03:50 commits: spin/contour, clickable items, wheel, scheme-driven palette, idle turns, cube slides for panel, portrait slot, v20/v24 in cycle, report draft. Waiting on second review; then hourly memory at ~04:40, wrap ≥06:50
- 04:00 commits: fusions v27-v29, review-2 fixes, swipe, old lab regression ok. Next: presets grain/diagonal, v30 smoke plume, v31 quarter-res big blur (iGPU), then wrap prep
- 04:10 commits: v30/v31, README, report, scheme bg fix (light schemes), mobile panel fix; 31 versions; third review running; tour video. Next: review-3 fixes, then wrap ≥06:50 (final sheet done)
