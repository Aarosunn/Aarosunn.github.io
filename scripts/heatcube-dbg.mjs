// Debug shoot for the heat cube: fresh-mount each version, then debug channel views.
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && console.error('console', m.text().slice(0, 300)))
const shot = async (name, ms = 300) => { await page.waitForTimeout(ms); await page.screenshot({ path: `shots/heatcube/dbg-${name}.png` }) }
for (const v of process.argv.slice(2).length ? process.argv.slice(2) : ['v1', 'v2']) {
  await page.goto('http://localhost:5173/')
  await page.waitForFunction(() => window.__aar)
  await page.evaluate((v) => { window.__aar.setTab('heatcube'); window.__aar.setHeatVersion(v) }, v)
  await shot(`${v}-fresh`, 1200)
  await shot(`${v}-fresh2`, 1500)
  for (const d of ['mask', 'combined']) { await page.evaluate((d) => window.__aar.setHeatDebug(d), d); await shot(`${v}-${d}`) }
  await page.evaluate(() => window.__aar.setHeatDebug('off'))
  await shot(`${v}-back`, 500)
}
await browser.close()
