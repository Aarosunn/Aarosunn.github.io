// v15 ascii outline review: the lab cube per wind preset, then the site. Output shots/ascii/
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots/ascii', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('console', m.text().slice(0, 600)))
await page.goto('http://localhost:5173/?tab=shader')
await page.waitForFunction(() => window.__aar)
await page.evaluate(() => { window.__aar.setShaderVersion('v15'); window.__aar.setShaderSpin(false) })
await page.waitForTimeout(2500)
const clip = { x: 270, y: 60, width: 900, height: 780 }
for (const w of ['version', 'tight', 'breeze', 'gale', 'storm']) {
  await page.evaluate((w) => window.__aar.setShaderWind(w), w)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `shots/ascii/lab-${w}.png`, clip })
}
const pr = page.evaluate(() => window.__aar.paperTurn('y', 1, 1))
await page.waitForTimeout(260)
await page.screenshot({ path: `shots/ascii/lab-storm-mid.png`, clip })
await pr
const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n) }; requestAnimationFrame(f) }))
console.log('lab v15 fps', fps)
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__aar && window.__aarSite?.current)
await page.waitForTimeout(3000)
await page.screenshot({ path: 'shots/ascii/site.png' })
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(260)
await page.screenshot({ path: 'shots/ascii/site-mid.png' })
console.log('site fps', await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n) }; requestAnimationFrame(f) })))
await browser.close()
