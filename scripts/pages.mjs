// Screenshot a section's pages: land on it, then next through `count` pages: node scripts/pages.mjs [section] [count] [w h] -> shots/pages-<section>-<n>.png + sheet
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
const sec = +(process.argv[2] ?? 3), count = +(process.argv[3] ?? 3), w = +(process.argv[4] ?? 1440), h = +(process.argv[5] ?? 900)
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: w, height: h } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__aarNav && document.querySelector('canvas')?.width > 300)
await page.waitForTimeout(2500)
await page.evaluate((i) => { window.__aarNav.go(i) }, sec)
await page.waitForTimeout(4000)
await page.waitForFunction(() => !window.__aarNav.busy(), null, { timeout: 20000 })
const files = []
for (let i = 0; i < count; i++) {
  if (i) { await page.evaluate(() => { window.__aarNav.next() }); await page.waitForTimeout(1000); await page.waitForFunction(() => !window.__aarNav.busy(), null, { timeout: 20000 }) }
  await page.waitForTimeout(900)
  const path = `shots/pages-${sec}-${w}x${h}-${i}.png`
  await page.screenshot({ path })
  files.push(`page${i}=${path}`)
}
await browser.close()
execSync(`node scripts/sheet.mjs shots/sheet-pages-${sec}-${w}x${h}.png ${files.join(' ')} --cols ${count > 3 ? 4 : count} --w ${w > h ? 2400 : 1600}`, { stdio: 'inherit' })
