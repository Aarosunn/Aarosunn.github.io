# aarcube

A portfolio whose menu is a Rubik's cube. paper.design's liquid metal runs over a cube of 27 rounded cubies; four
sections sit around it; choosing one flies the cube into the camera until a face fills the screen, and that face
becomes the section's page. Inside a section the page is still a cube: the next project arrives by legal layer
turns.

## Run

```
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/
```

## Content

Everything the site says is in `src/content.ts`.

**Add a project:** append an entry to `PROJECTS`:

```ts
{ section: 'hardware', title: 'synth voice', year: 2025, blurb: 'a wavetable voice on an FPGA.', stack: 'verilog · a hot chip', link: { label: 'source', href: 'https://…' } }
```

`section` puts it in that corner's list on the home page (click a title for the detail panel: `detail` if given, else
the blurb, then `stack` and `link`) and makes it a page inside the section, in the order written. `blurb` is what the
page shows under the title, so keep it to a sentence or two.

**Sections** are the four corners (`SECTIONS`): id, title, a one-line blurb, and for About a few `notes` lines instead
of projects. **The site's name and intro** are `SITE`.

## Keys

Home: arrows, 1–4, wheel or a swipe step the deck (each step turns a layer); Enter or a click on the active section
flies in; a double click or double tap on the cube runs the next of T perm, U perm and Sune. In a section: n or → is
the next project, Escape or the wordmark flies home. Drag orbits the cube.

## Look

`src/theme.ts` the colours. `src/cube.ts` the cube (paper's liquid metal parameters, the ascii outline).
`src/florals.ts` the three blooms at the base and their poses. The transition's timings are the constants at the top
of `src/Site.tsx`; the page's tile geometry (gap, corner radii) at the top of `src/ScreenCube.tsx`.

## Structure

- `Site.tsx` the page and the section transition
- `PaperCube.tsx` the cube's material: the mask render, the Poisson field, paper's fragment, the ascii outline
- `RubikMask.tsx` the 27 cubies and their turns
- `ScreenCube.tsx` the section page as a cube: tiles of the captured material, the turns that bring the next page
- `page.ts` a project painted as a page texture
- `XrayFlower3D.tsx` / `xrayMesh.ts` the florals
- `Ascii.tsx` the portrait placeholder

## Verify

`scripts/` drive the site in headless Chromium (Playwright) and build contact sheets under `shots/`:
`site-go.mjs` (fly in, next, home), `next-watch.mjs` (a turn every ~100 ms), `zoom.mjs` (pixel crops),
`scanline.mjs` (luminance along a row), `sheet.mjs`.

The lab this grew from (every version of the cube, florals and transition, with their tabs) is tagged `lab-final`.
