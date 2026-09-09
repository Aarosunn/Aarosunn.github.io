import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (m) => (m.type() === 'warning' || m.type() === 'error') && console.log('console', m.text().slice(0, 160)))
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__aar && window.__aar.positions().length === 27)
await page.waitForTimeout(2500)
const fps = () => page.evaluate(() => document.querySelector('.readout span:nth-child(6)')?.textContent)
for (const [set, v] of [['v2','chrome'],['v2','heat'],['v2','smoke'],['v1','chrome'],['v1','smoke']]) {
  await page.evaluate(([s, v]) => { window.__aar.setSet(s); window.__aar.setVariant(v) }, [set, v])
  await page.waitForTimeout(2500)
  console.log(set, v, await fps())
}
await browser.close()
