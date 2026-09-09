import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__aar)
await page.evaluate(() => { window.__aar.setTab('heatcube'); window.__aar.setHeatVersion('v1') })
let t = 0
for (const ms of [300, 300, 300, 300, 400, 400, 500, 500]) {
  await page.waitForTimeout(ms); t += ms
  const b = await page.screenshot()
  console.log(t, 'ms', b.length)
}
await browser.close()
