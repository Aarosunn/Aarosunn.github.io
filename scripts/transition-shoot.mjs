// Transition tab: play the flight and grab frames along it -> shots/transition/<v>-<ms>.png + a sheet.
// Usage: node scripts/transition-shoot.mjs [v1]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
const v = process.argv[2] ?? 'v1'
mkdirSync('shots/transition', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('console', m.text().slice(0, 300)))
await page.goto('http://localhost:5173/?tab=transition')
await page.waitForFunction(() => window.__aarTransition)
// the canvas starts at 300×150 until R3F's resize observer lands (up to ~1 s in headless); play only once it is full size
await page.waitForFunction(() => document.querySelector('.transition-tab canvas')?.width > 300)
await page.waitForTimeout(400)
const files = []
const t0 = Date.now()
await page.evaluate(() => window.__aarTransition.play())
for (const ms of [0, 600, 1200, 1700, 2000, 2200, 2600, 3200]) {
  const wait = ms - (Date.now() - t0)
  if (wait > 0) await page.waitForTimeout(wait)
  const path = `shots/transition/${v}-${String(ms).padStart(4, '0')}.png`
  await page.screenshot({ path })
  files.push(`${ms}ms=${path}`)
}
await browser.close()
execSync(`node scripts/sheet.mjs shots/sheet-transition-${v}.png ${files.join(' ')} --cols 4 --w 2400`, { stdio: 'inherit' })
