// Blank-frame detector: reads the WebGL canvas back every frame (after R3F's own rAF) and logs frames whose
// centre region is dark, with what the script was doing. Usage: node scripts/blank-frames.mjs [--secs 30]
import { chromium } from 'playwright'
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d }
const secs = +opt('--secs', 30)
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('console', m.text().slice(0, 300)))
const install = () => page.evaluate(() => {
  const c = document.querySelector('canvas')
  const probe = document.createElement('canvas'); probe.width = 32; probe.height = 32
  const x = probe.getContext('2d', { willReadFrequently: true })
  window.__blank = { frames: 0, blanks: [], phase: 'start' }
  const tick = () => {
    window.__blank.frames++
    try {
      x.drawImage(c, c.width * 0.3, c.height * 0.2, c.width * 0.4, c.height * 0.6, 0, 0, 32, 32)
      const d = x.getImageData(0, 0, 32, 32).data
      let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]
      const mean = s / (d.length / 4) / 3
      if (mean < 8) window.__blank.blanks.push({ f: window.__blank.frames, t: Math.round(performance.now()), mean: +mean.toFixed(1), phase: window.__blank.phase })
    } catch (e) { window.__blank.blanks.push({ f: window.__blank.frames, err: String(e) }) }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
const report = async (label) => { const b = await page.evaluate(() => window.__blank); console.log(label, 'frames', b.frames, 'blank', b.blanks.length, JSON.stringify(b.blanks.slice(0, 12))) }
// site: driven turns
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__aar && window.__aarSite?.current)
await page.waitForTimeout(2000)
await install()
let t0 = Date.now()
while (Date.now() - t0 < secs * 1000) {
  await page.evaluate(() => { window.__blank.phase = 'turn'; window.__aarSite.current.turn() })
  await page.waitForTimeout(900)
  await page.evaluate(() => { window.__blank.phase = 'step' })
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(900)
}
await report('site')
// lab: wind / preset / outline switches
await page.goto('http://localhost:5173/?tab=shader')
await page.waitForFunction(() => window.__aar)
await page.evaluate(() => window.__aar.setShaderVersion('v15'))
await page.waitForTimeout(2000)
await install()
t0 = Date.now()
const winds = ['tight', 'breeze', 'gale', 'storm', 'version']
let i = 0
while (Date.now() - t0 < secs * 1000) {
  const w = winds[i++ % winds.length]
  await page.evaluate((w) => { window.__blank.phase = 'wind ' + w; window.__aar.setShaderWind(w) }, w)
  await page.waitForTimeout(500)
  await page.evaluate((i) => { window.__blank.phase = 'preset'; window.__aar.setShaderPreset(i % 5) }, i)
  await page.waitForTimeout(500)
  await page.evaluate(() => { window.__blank.phase = 'turn'; window.__aar.paperTurn() })
  await page.waitForTimeout(700)
}
await report('lab')
await browser.close()
