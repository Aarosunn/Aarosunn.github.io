// land s4 once, then stills of alpha/tint variants of the faded liquid -> shots/site-go/ghost-<n>.png + a sheet
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.goto('http://localhost:5173/?sv=s4')
await page.waitForFunction(() => window.__aarNav && document.querySelector('canvas')?.width > 300)
await page.waitForTimeout(2500)
await page.evaluate(() => { window.__aarNav.go(1) })
await page.waitForTimeout(4000)
await page.waitForFunction(() => !window.__aarNav.busy(), null, { timeout: 20000 })
const variants = [[0.2, '#9de8d4'], [0.12, '#9de8d4'], [0.3, '#9de8d4'], [0.2, '#5fb8a4'], [0.12, '#ffffff'], [0.25, '#3d9a84']]
const files = []
for (const [a, t] of variants) {
  await page.evaluate(([a, t]) => window.__aarNav.alpha(a, t), [a, t])
  await page.waitForTimeout(400)
  const path = `shots/site-go/ghost-${a}-${t.slice(1)}.png`
  await page.screenshot({ path })
  files.push(`a${a}_${t}=${path}`)
}
await browser.close()
execSync(`node scripts/sheet.mjs shots/sheet-ghost-variants.png ${files.join(' ')} --cols 3 --w 2400`, { stdio: 'inherit' })
