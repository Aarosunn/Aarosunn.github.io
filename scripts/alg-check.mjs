// Algorithms: T perm x2, U perm x3, Sune x6 must return the cube to its starting state on the site (auto-turns
// running), keys j k l must run them, and a few mid-alg frames go to shots/alg/.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots/alg', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('console', m.text().slice(0, 300)))
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__aar && window.__aarSite?.current)
await page.waitForFunction(() => !window.__aarSite.current.busy())
await page.waitForTimeout(500)
for (const [name, times] of [['T perm', 2], ['U perm', 3], ['Sune', 6]]) {
  await page.waitForFunction(() => !window.__aarSite.current.busy())
  const r = await page.evaluate(async ([name, times]) => {
    const h = window.__aarSite.current
    // corners and edges only: T perm and U perm twist face centres (supercube state), which the cube shows nowhere
    const outer = (st) => JSON.stringify(JSON.parse(st).filter((c) => Math.abs(c[0]) + Math.abs(c[1]) + Math.abs(c[2]) >= 2))
    const before = outer(h.state())
    const t0 = performance.now()
    const algs = { 'T perm': "R U R' U' R' F R2 U' R' U' R U R' F'", 'U perm': "R U' R U R U R U' R' U' R2", Sune: "R U R' U R U2 R'" }
    for (let i = 0; i < times; i++) await h.run(algs[name])
    return { same: before === outer(h.state()), ms: Math.round((performance.now() - t0) / times), place: h.placementError(), orient: h.orientationError() }
  }, [name, times])
  console.log(name, 'x' + times, 'identity', r.same ? 'ok' : 'BROKEN', 'ms per alg', r.ms, 'placement', r.place, 'orientation', r.orient.toExponential(1))
}
// keys: j then frames during it
await page.waitForFunction(() => !window.__aarSite.current.busy())
await page.waitForTimeout(200)
const clip = { x: 370, y: 100, width: 700, height: 700 }
await page.keyboard.press('j')
for (let i = 0; i < 5; i++) { await page.waitForTimeout(150); await page.screenshot({ path: `shots/alg/j-${i}.png`, clip }) }
const busyAfterJ = await page.evaluate(() => window.__aarSite.current.busy())
await page.waitForFunction(() => !window.__aarSite.current.busy())
await page.screenshot({ path: `shots/alg/j-end.png`, clip })
console.log('key j started an algorithm:', busyAfterJ)
for (const k of ['k', 'l']) { await page.keyboard.press(k); await page.waitForTimeout(100); console.log('key', k, 'busy', await page.evaluate(() => window.__aarSite.current.busy())); await page.waitForFunction(() => !window.__aarSite.current.busy()) }
console.log('site placement after keys', await page.evaluate(() => window.__aarSite.current.placementError()))
// lab hook
await page.goto('http://localhost:5173/?tab=shader')
await page.waitForFunction(() => window.__aar)
await page.evaluate(() => window.__aar.setShaderVersion('v16'))
await page.waitForTimeout(1500)
const lab = await page.evaluate(async () => { const outer = (st) => JSON.stringify(JSON.parse(st).filter((c) => Math.abs(c[0]) + Math.abs(c[1]) + Math.abs(c[2]) >= 2)); const b = outer(window.__aar.paperState()); await window.__aar.paperRun("R U R' U' R' F R2 U' R' U' R U R' F'"); await window.__aar.paperRun("R U R' U' R' F R2 U' R' U' R U R' F'"); return b === outer(window.__aar.paperState()) })
console.log('lab T perm x2 identity', lab ? 'ok' : 'BROKEN')
await browser.close()
