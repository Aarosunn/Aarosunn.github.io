// Screenshot the paper shaders tab over time (dev server must be running).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots/paper', { recursive: true })
const browser = await chromium.launch({
  channel: 'chromium',
  env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' },
  args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && console.error('console', m.text().slice(0, 200)))
await page.goto(process.argv[2] ?? 'http://localhost:5173/')
await page.waitForFunction(() => window.__aar)
await page.evaluate(() => window.__aar.setTab('paper'))
await page.waitForTimeout(1500)
for (let i = 0; i < 4; i++) {
  await page.screenshot({ path: `shots/paper/mine-${i}.png` })
  await page.waitForTimeout(700)
}
await browser.close()
