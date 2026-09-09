// Screenshot every scheme x material and verify layer turns keep the cube solid.
// Usage: node scripts/shoot.mjs [url]   (dev server must be running)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const url = process.argv[2] ?? 'http://localhost:5173/'
const out = 'shots'
mkdirSync(out, { recursive: true })

// Full Chromium (new headless) so the real GPU renders; the headless shell falls back to SwiftShader at ~2 fps.
const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-gl=angle', '--use-angle=gl'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.goto(url)
await page.waitForFunction(() => window.__aar && window.__aar.positions().length === 27)
await page.waitForTimeout(2200) // entrance
const fps = await page.evaluate(() => document.querySelector('.readout span:nth-child(4)')?.textContent)
const gpu = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2')
  const ext = gl?.getExtension('WEBGL_debug_renderer_info')
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'
})
console.log(`renderer: ${gpu}\n${fps}`)

const schemes = ['icemint', 'ice', 'aura', 'ember', 'graphite', 'mint', 'paper']
const variants = ['heat', 'chrome', 'smoke']
for (const v of variants) {
  await page.evaluate((v) => window.__aar.setVariant(v), v)
  for (const s of schemes) {
    await page.evaluate((s) => window.__aar.setScheme(s), s)
    await page.waitForTimeout(800)
    const on = await page.$$eval('button.on', (b) => b.map((x) => x.textContent))
    if (!on.includes(s) || !on.includes(v)) console.error(`state mismatch: want ${s}/${v}, DOM says ${on}`)
    await page.screenshot({ path: `${out}/${v}-${s}.png` })
  }
}

// Turn check: mid-turn frames + integrity after 12 turns.
await page.evaluate(() => {
  window.__aar.setScheme('icemint')
  window.__aar.setVariant('chrome')
})
await page.waitForTimeout(600)
page.evaluate(() => window.__aar.turn('y', 1, 1))
await page.waitForTimeout(180)
await page.screenshot({ path: `${out}/turn-mid-1.png` })
await page.waitForTimeout(180)
await page.screenshot({ path: `${out}/turn-mid-2.png` })
await page.waitForFunction(() => !window.__aar.busy())

for (let i = 0; i < 12; i++) await page.evaluate(() => window.__aar.turn())
const pos = await page.evaluate(() => window.__aar.positions())
const keys = new Set(pos.map((p) => p.join(',')))
const ints = pos.every((p) => p.every((n) => Number.isInteger(n) && Math.abs(n) <= 1))
console.log(`after 12 turns: ${keys.size} unique cells, all ints=${ints}`)
if (keys.size !== 27 || !ints) {
  console.error('CUBE INTEGRITY FAILED', pos)
  process.exitCode = 1
}
await page.screenshot({ path: `${out}/after-turns.png` })
await browser.close()
