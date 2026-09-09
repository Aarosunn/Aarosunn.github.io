// Floral tab review: every version (seed 3, plus seeds 1 and 5 for v2), then the site base with ?floral=. -> shots/floral/
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots/floral', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('console', m.text().slice(0, 300)))
await page.goto('http://localhost:5173/?tab=floral')
await page.waitForFunction(() => window.__aar)
await page.waitForTimeout(800)
const versions = ['v1', 'v2', 'v3', 'v4', 'v5']
for (const v of versions) for (const seed of v === 'v2' ? [3, 1, 5] : [3]) {
  await page.evaluate(([v, s]) => { window.__aar.setFloralVersion(v); window.__aar.setFloralSeed(s) }, [v, seed])
  await page.waitForTimeout(400)
  const el = await page.$('.floral-stage')
  await el.screenshot({ path: `shots/floral/${v}-s${seed}.png` })
}
for (const v of ['v2', 'v5']) {
  await page.goto(`http://localhost:5173/?floral=${v}`)
  await page.waitForFunction(() => window.__aar)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `shots/floral/site-${v}.png` })
}
await browser.close()
