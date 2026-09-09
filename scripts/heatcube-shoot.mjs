// Screenshot the heat cube tab: a few frames spinning, then fixed orbit angles (dev server must be running).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots/heatcube', { recursive: true })
const browser = await chromium.launch({
  channel: 'chromium',
  env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' },
  args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && console.error('console', m.text().slice(0, 300)))
await page.goto(process.argv[2] ?? 'http://localhost:5173/')
await page.waitForFunction(() => window.__aar)
await page.evaluate(() => window.__aar.setTab('heatcube'))
await page.waitForTimeout(1500)
for (let i = 0; i < 5; i++) {
  await page.screenshot({ path: `shots/heatcube/spin-${i}.png` })
  await page.waitForTimeout(600)
}
// drag to orbit: three drags, screenshot after each
const drags = [[200, 0], [0, 160], [-350, -80]]
for (let i = 0; i < drags.length; i++) {
  await page.mouse.move(720, 450)
  await page.mouse.down()
  await page.mouse.move(720 + drags[i][0], 450 + drags[i][1], { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `shots/heatcube/orbit-${i}.png` })
}
await page.evaluate(() => window.__aar.setHeatHollow(true))
await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/heatcube/hollow.png' })
await browser.close()
