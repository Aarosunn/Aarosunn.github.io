// Pixel diff v11 vs v13 at rest for every theme (speed 0 so both sit on the same frame of the effect),
// then v13 after 12 turns vs its own rest frame (drift check), plus placement / orientation probes.
import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
const m = await b.newPage()
const diff = (a, c) => m.evaluate(async ([a, c]) => {
  const load = async (d) => { const img = new Image(); img.src = 'data:image/png;base64,' + d; await img.decode(); const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, cv.width, cv.height).data }
  const A = await load(a), B = await load(c)
  let sum = 0, n = 0, big = 0
  for (let i = 0; i < A.length; i += 4) { const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3; sum += d; n++; if (d > 24) big++ }
  return { mean: +(sum / n).toFixed(2), pctOver24: +((100 * big) / n).toFixed(2) }
}, [a.toString('base64'), c.toString('base64')])
const clip = { x: 370, y: 100, width: 700, height: 700 }
await p.goto('http://localhost:5173/?tab=shader'); await p.waitForFunction(() => window.__aar)
const shot = async (v, theme) => {
  await p.evaluate((v) => { window.__aar.setShaderVersion(v); window.__aar.setShaderSpin(false); window.__aar.setShaderOverride({ speed: 0 }) }, v)
  await p.waitForTimeout(2200)
  await p.evaluate((i) => window.__aar.setShaderPreset(i), theme); await p.waitForTimeout(900)
  return p.screenshot({ clip })
}
const themes = ['default', 'backdrop', 'heatmap', 'heatmap grain', 'ice', 'mint', 'icemint', 'icemint grain']
for (let t = 0; t < themes.length; t++) {
  const a = await shot('v11', t), c = await shot('v13', t)
  console.log(themes[t].padEnd(14), 'v11 vs v13 at rest:', JSON.stringify(await diff(a, c)))
}
// drift: v13 ice, rest vs after 12 turns (the cube is a different permutation, so compare only the outline/seam structure by eye + probes)
await shot('v13', 4)
await p.evaluate(async () => { for (let i = 0; i < 12; i++) await window.__aar.paperTurn() }); await p.waitForTimeout(300)
console.log('v13 after 12 turns: placement', await p.evaluate(() => window.__aar.paperPlacementError()), 'orientation', await p.evaluate(() => window.__aar.paperOrientationError()))
await p.screenshot({ path: 'shots/v11/diff-v13-12.png', clip })
await p.evaluate(() => window.__aar.setShaderDebug('mask')); await p.waitForTimeout(300); await p.screenshot({ path: 'shots/v11/diff-v13-12-mask.png', clip })
await p.evaluate(() => window.__aar.setShaderDebug('off'))
await b.close()
