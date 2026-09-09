// v11 review: every theme (still + mid-turn), then a brightness x opacity grid for two themes.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots/v11', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('console', m.text().slice(0, 300)))
await page.goto('http://localhost:5173/?tab=shader')
await page.waitForFunction(() => window.__aar)
await page.evaluate(() => { window.__aar.setShaderVersion('v11'); window.__aar.setShaderSpin(false) })
await page.waitForTimeout(2500)
const themes = await page.evaluate(() => [...document.querySelectorAll('.controls .row')][1].querySelectorAll('button').length)
const clip = { x: 370, y: 100, width: 700, height: 700 }
const shot = (n, ms = 300) => page.waitForTimeout(ms).then(() => page.screenshot({ path: `shots/v11/${n}.png`, clip }))
for (let i = 0; i < themes; i++) {
  await page.evaluate((i) => window.__aar.setShaderPreset(i), i)
  await page.waitForTimeout(i === 0 ? 800 : 2200) // heat/liquid switch remounts the canvas
  const name = await page.evaluate((i) => [...document.querySelectorAll('.controls .row')][1].querySelectorAll('button')[i].textContent.replace(/ /g, '_'), i)
  await shot(`${name}-still`)
  const pr = page.evaluate(() => window.__aar.paperTurn('y', 1, 1))
  await shot(`${name}-mid`, 250)
  await pr
  const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n) }; requestAnimationFrame(f) }))
  console.log(name, 'fps', fps, 'orientation error', await page.evaluate(() => window.__aar.paperOrientationError()))
}
for (const [ti, tname] of [[4, 'ice'], [2, 'heatmap']]) {
  await page.evaluate((i) => window.__aar.setShaderPreset(i), ti); await page.waitForTimeout(2200)
  for (const g of [0.7, 1, 1.4]) for (const a of [0.5, 0.85, 1]) { await page.evaluate(([g, a]) => window.__aar.setShaderLook(g, a), [g, a]); await shot(`${tname}-g${g}-a${a}`, 250) }
  await page.evaluate(() => window.__aar.setShaderLook(1, 1))
}
await browser.close()
