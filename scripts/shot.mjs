// Screenshot any local page: node scripts/shot.mjs '?tab=icons' out.png [w h] [wait ms]
import { chromium } from 'playwright'
const [query = '', out = 'shots/shot.png', w = '1440', h = '900', wait = '3000'] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: +w, height: +h } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && console.error('console', m.text().slice(0, 300)))
await page.goto('http://localhost:5173/' + query)
await page.waitForTimeout(+wait)
await page.screenshot({ path: out })
await browser.close()
console.log(out)
