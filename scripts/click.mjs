// Click a home-page title and screenshot what happens: node scripts/click.mjs "Conduit" -> shots/click-<title>.png
import { chromium } from 'playwright'
const title = process.argv[2] ?? 'Conduit'
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__aarNav && document.querySelector('canvas')?.width > 300)
await page.waitForTimeout(2500)
await page.locator('.sec li', { hasText: title }).first().click({ force: true })
await page.waitForTimeout(1200)
const path = `shots/click-${title.replace(/\W+/g, '-')}.png`
await page.screenshot({ path })
await browser.close()
console.log(path)
