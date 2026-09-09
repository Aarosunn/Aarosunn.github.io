// Screenshot set x shape x material (on a few schemes) and verify layer turns keep the cube solid.
// Usage: node scripts/shoot.mjs [url]   (dev server must be running)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const url = process.argv[2] ?? 'http://localhost:5173/'
const out = 'shots'
mkdirSync(out, { recursive: true })

// Full Chromium (new headless) so the real GPU renders; the headless shell falls back to SwiftShader at ~2 fps.
// PRIME offload: render on the discrete GPU (the integrated Iris Xe is slow and noisy).
const browser = await chromium.launch({
  channel: 'chromium',
  env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' },
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-gl=angle', '--use-angle=gl'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && console.error('console', m.text()))
await page.goto(url)
await page.waitForFunction(() => window.__aar && window.__aar.positions().length === 27)
await page.waitForTimeout(2200) // entrance
const gpu = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2')
  const ext = gl?.getExtension('WEBGL_debug_renderer_info')
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'
})
console.log(`renderer: ${gpu}`)

const schemes = process.argv.includes('--all')
  ? ['icemint', 'ice', 'aura', 'ember', 'graphite', 'mint', 'paper']
  : ['icemint', 'paper']
const variants = ['heat', 'chrome', 'smoke']
const state = () => page.$$eval('button.on', (b) => b.map((x) => x.textContent))

for (const set of ['v1', 'v2']) {
  await page.evaluate((v) => window.__aar.setSet(v), set)
  for (const shape of ['classic', 'solid']) {
    await page.evaluate((v) => window.__aar.setShape(v), shape)
    for (const v of variants) {
      await page.evaluate((v) => window.__aar.setVariant(v), v)
      for (const s of schemes) {
        await page.evaluate((s) => window.__aar.setScheme(s), s)
        await page.waitForTimeout(700)
        const on = await state()
        for (const want of [set, shape, v, s]) if (!on.includes(want)) console.error(`state mismatch: want ${want}, DOM says ${on}`)
        await page.screenshot({ path: `${out}/${set}-${shape}-${v}-${s}.png` })
      }
    }
  }
}
const fps = await page.evaluate(() => document.querySelector('.readout span:nth-child(6)')?.textContent)
console.log(fps)

// Turn check per set: mid-turn frame + integrity after 12 turns.
for (const set of ['v1', 'v2']) {
  await page.evaluate((v) => {
    window.__aar.setSet(v)
    window.__aar.setShape('solid')
    window.__aar.setScheme('icemint')
    window.__aar.setVariant('chrome')
  }, set)
  await page.waitForTimeout(600)
  page.evaluate(() => window.__aar.turn('y', 1, 1))
  await page.waitForTimeout(220)
  await page.screenshot({ path: `${out}/turn-${set}-mid.png` })
  await page.waitForFunction(() => !window.__aar.busy())
  for (let i = 0; i < 12; i++) await page.evaluate(() => window.__aar.turn())
  const pos = await page.evaluate(() => window.__aar.positions())
  const keys = new Set(pos.map((p) => p.join(',')))
  const ints = pos.every((p) => p.every((n) => Number.isInteger(n) && Math.abs(n) <= 1))
  console.log(`${set}: after 12 turns, ${keys.size} unique cells, all ints=${ints}`)
  if (keys.size !== 27 || !ints) {
    console.error('CUBE INTEGRITY FAILED', pos)
    process.exitCode = 1
  }
  await page.screenshot({ path: `${out}/turn-${set}-after.png` })
}
await browser.close()
