// The site with ?floral=<v> -> shots/floral/site-<v>.png. Usage: node scripts/site-floral.mjs v14
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const v = process.argv[2] ?? 'v14'
mkdirSync('shots/floral', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.goto(`http://localhost:5173/?floral=${v}`)
await page.waitForFunction(() => window.__aar)
await page.waitForTimeout(2500)
await page.screenshot({ path: `shots/floral/site-${v}.png` })
console.log(`shots/floral/site-${v}.png`)
await browser.close()
