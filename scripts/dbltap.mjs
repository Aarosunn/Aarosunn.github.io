// Prove a double click on the cube runs an algorithm: the cube is busy right after, and the cube's rotation state changes
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__aarNav && document.querySelector('canvas')?.width > 300)
await page.waitForTimeout(2500)
await page.mouse.dblclick(720, 450)
await page.waitForTimeout(400)
await page.screenshot({ path: 'shots/dbl-mid.png' })
await page.waitForTimeout(3500)
await page.screenshot({ path: 'shots/dbl-after.png' })
// a double tap
await page.touchscreen.tap(720, 450); await page.waitForTimeout(120); await page.touchscreen.tap(720, 450)
await page.waitForTimeout(400)
await page.screenshot({ path: 'shots/tap-mid.png' })
await browser.close()
console.log('shots/dbl-mid.png shots/dbl-after.png shots/tap-mid.png')
