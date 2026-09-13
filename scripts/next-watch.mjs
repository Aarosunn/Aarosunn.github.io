// Watch a section page's `next` frame by frame: land (SV, default s5), then shoot every 100 ms for 4.8 s -> shots/next-watch/ + sheet
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
const sv = process.env.SV ?? 's5'
mkdirSync('shots/next-watch', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.goto('http://localhost:5173/?sv=' + sv)
await page.waitForFunction(() => window.__aarNav && document.querySelector('canvas')?.width > 300)
await page.waitForTimeout(2500)
await page.evaluate(() => { window.__aarNav.go(1) })
await page.waitForTimeout(4000)
await page.waitForFunction(() => !window.__aarNav.busy(), null, { timeout: 20000 })
await page.waitForTimeout(1000)
const files = []
const t0 = Date.now()
await page.evaluate(() => { window.__aarNav.next() })
for (let ms = 0; ms <= 4800; ms += 100) {
  const wait = ms - (Date.now() - t0)
  if (wait > 0) await page.waitForTimeout(wait)
  const path = `shots/next-watch/${sv}-${String(ms).padStart(4, '0')}.png`
  await page.screenshot({ path })
  files.push(`${ms}=${path}`)
}
await browser.close()
execSync(`node scripts/sheet.mjs shots/sheet-next-watch-${sv}.png ${files.join(' ')} --cols 7 --w 2800`, { stdio: 'inherit' })
