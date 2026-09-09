// Flower asset gallery: every flower type for one look version -> shots/flowers/<v>-<flower>.png + a contact sheet.
// Usage: node scripts/flower-sheet.mjs [v10] [seed]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
const v = process.argv[2] ?? 'v10', seed = +(process.argv[3] ?? 3)
mkdirSync('shots/flowers', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('console', m.text().slice(0, 300)))
await page.goto('http://localhost:5173/?tab=floral')
await page.waitForFunction(() => window.__aar)
await page.evaluate(([v, s]) => { window.__aar.setFloralVersion(v); window.__aar.setFloralSeed(s) }, [v, seed])
await page.waitForTimeout(600)
const flowers = await page.evaluate(() => [...document.querySelectorAll('.floral-tab .row')].find((r) => r.textContent.startsWith('flower')).querySelectorAll('button').length ? [...[...document.querySelectorAll('.floral-tab .row')].find((r) => r.textContent.startsWith('flower')).querySelectorAll('button')].map((b) => b.textContent) : [])
const files = []
for (const fl of flowers) {
  await page.evaluate((fl) => window.__aar.setFloralFlower(fl), fl)
  await page.waitForTimeout(700)
  const el = await page.$('.floral-stage')
  const path = `shots/flowers/${v}-${fl}.png`
  await el.screenshot({ path })
  files.push(`${fl}=${path}`)
}
await browser.close()
execSync(`node scripts/sheet.mjs shots/sheet-flowers-${v}.png ${files.join(' ')} --cols 5 --w 3000`, { stdio: 'inherit' })
