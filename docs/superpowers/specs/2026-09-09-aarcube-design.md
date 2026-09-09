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
