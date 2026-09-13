// Screenshot the deployed site: home, then a section page: node scripts/live.mjs [url]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const url = process.argv[2] ?? 'https://aarosunn.github.io/'
mkdirSync('shots', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && console.error('console', m.text().slice(0, 200)))
const t0 = Date.now()
await page.goto(url)
await page.waitForFunction(() => window.__aarNav && document.querySelector('canvas')?.width > 300)
console.log('ready in', Date.now() - t0, 'ms')
await page.waitForTimeout(3000)
await page.screenshot({ path: 'shots/live-home.png' })
await page.evaluate(() => { window.__aarNav.go(1) })
await page.waitForTimeout(4000)
await page.waitForFunction(() => !window.__aarNav.busy(), null, { timeout: 20000 })
await page.screenshot({ path: 'shots/live-page.png' })
await browser.close()
console.log('shots/live-home.png shots/live-page.png')
