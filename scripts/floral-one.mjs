// One floral version, one shot of the tab stage -> shots/flowers/<v>.png. Usage: node scripts/floral-one.mjs v14 [seed]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const v = process.argv[2] ?? 'v14', seed = +(process.argv[3] ?? 3)
mkdirSync('shots/flowers', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('console', m.text().slice(0, 300)))
await page.goto('http://localhost:5173/?tab=floral')
await page.waitForFunction(() => window.__aar)
await page.evaluate(([v, s]) => { window.__aar.setFloralVersion(v); window.__aar.setFloralSeed(s) }, [v, seed])
await page.waitForTimeout(2200)
await (await page.$('.floral-stage')).screenshot({ path: `shots/flowers/${v}.png` })
console.log(`shots/flowers/${v}.png`)
await browser.close()
