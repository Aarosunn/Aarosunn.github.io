import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => (m.type() === 'error' && !m.text().includes('404') || m.text().startsWith('site')) && console.error('console', m.text().slice(0, 300)))
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__aar)
await page.waitForTimeout(2500)
for (let i = 0; i < 5; i++) {
  await page.keyboard.press('v')
  await page.waitForTimeout(1500)
  console.log(i, await page.evaluate(() => document.querySelector('.site-ver')?.textContent), await page.evaluate(() => document.querySelectorAll('canvas').length))
  await page.screenshot({ path: `shots/site/dbg-ver${i}.png` })
}
await page.screenshot({ path: 'shots/site/floral.png', clip: { x: 380, y: 690, width: 680, height: 160 } })
await browser.close()
