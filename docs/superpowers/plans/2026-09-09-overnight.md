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
- [ ] v5 silhouette family: heat / liquid / smoke
- [ ] seams from cubie edges, turn continuity before/mid/after, 12-turn integrity

## P3 mock site tab
- [ ] xray floral SVG bottom, 4 section placeholders, deck-step nav stub, cube centre
- [ ] 3 viewports screenshot

## P4 wrap
- [ ] contact sheet of all versions, spec, memory, cron deleted, summary

## Log
- 02:50 start
- 03:58 commit: PaperCube v3-v9, all three shaders on 3D at 61fps. Next: Rubik's mask (P2)
