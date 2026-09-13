// Screenshot the home page at a viewport, stepping through the sections: node scripts/home.mjs [w h] -> shots/home-<w>x<h>-<n>.png + sheet
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
const w = +(process.argv[2] ?? 420), h = +(process.argv[3] ?? 820)
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: w, height: h } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__aarNav && document.querySelector('canvas')?.width > 300)
await page.waitForTimeout(2500)
const files = []
for (let i = 0; i < 4; i++) {
  if (i) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(900) }
  const path = `shots/home-${w}x${h}-${i}.png`
  await page.screenshot({ path })
  files.push(`section${i}=${path}`)
}
await browser.close()
execSync(`node scripts/sheet.mjs shots/sheet-home-${w}x${h}.png ${files.join(' ')} --cols 4 --w ${w > h ? 2400 : 1600}`, { stdio: 'inherit' })
