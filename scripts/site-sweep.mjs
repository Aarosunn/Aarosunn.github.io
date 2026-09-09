// Site cube mid-turn sweep: for each site theme, every axis x layer x direction, frames during the turn.
// Usage: node scripts/site-sweep.mjs [--themes 0,1,2] [--tilt] [--out shots/site-sweep]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d }
const themes = opt('--themes', '0,1,2').split(',').map(Number)
const out = opt('--out', 'shots/site-sweep')
const tilt = args.includes('--tilt')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('console', m.text().slice(0, 300)))
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__aar && window.__aarSite?.current)
await page.waitForTimeout(2500)
if (tilt) { await page.mouse.move(720, 450); await page.mouse.down(); await page.mouse.move(720, 560, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(300) }
const clip = { x: 370, y: 100, width: 700, height: 700 }
const names = ['ice', 'mint', 'icemint']
for (const ti of themes) {
  await page.click(`.site-theme button:nth-child(${ti + 1})`)
  await page.waitForTimeout(1200)
  // wait out any auto turn in flight
  await page.waitForFunction(() => !window.__aarSite.current.busy())
  for (const ax of ['x', 'y', 'z']) for (const ly of [-1, 0, 1]) for (const d of [1, -1]) {
    await page.waitForFunction(() => !window.__aarSite.current.busy())
    const t0 = Date.now()
    const pr = page.evaluate(([a, l, d]) => window.__aarSite.current.turn(a, l, d), [ax, ly, d])
    const tag = `${names[ti]}-${ax}${ly < 0 ? 'm' : ly}${d > 0 ? 'p' : 'n'}`
    for (const t of [130, 260, 390]) {
      const wait = t - (Date.now() - t0)
      if (wait > 0) await page.waitForTimeout(wait)
      await page.screenshot({ path: `${out}/${tag}-${t}.png`, clip })
    }
    await pr
  }
  await page.waitForTimeout(300)
  await page.waitForFunction(() => !window.__aarSite.current.busy())
  await page.screenshot({ path: `${out}/${names[ti]}-rest.png`, clip })
  const errs = await page.evaluate(() => [window.__aarSite.current.placementError(), window.__aarSite.current.orientationError()])
  console.log(names[ti], 'placement / orientation error', errs)
}
await browser.close()
