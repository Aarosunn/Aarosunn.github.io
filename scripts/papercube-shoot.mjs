// Shoot the shader-cube tab: every PaperCube version fresh-mounted, spinning frames, orbit drags,
// debug channels. Usage: node scripts/papercube-shoot.mjs [v3 v5 ...] [--presets] [--shapes]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const only = args.filter((a) => !a.startsWith('--'))
import { mkdirSync as mk } from 'node:fs'
mk('shots/papercube', { recursive: true })
const igpu = flags.has('--igpu') // integrated GPU: what a laptop on battery sees
const browser = await chromium.launch({ channel: 'chromium', env: igpu ? { ...process.env } : { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('console', m.text().slice(0, 400)))
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__aar)
await page.evaluate(() => window.__aar.setTab('heatcube'))
const versions = only.length ? only : await page.evaluate(() => [...document.querySelectorAll('.controls .row')][0] && [...document.querySelectorAll('.controls .row button')].map((b) => b.textContent).filter((t) => /^v\d+$/.test(t)).filter((t) => t !== 'v1' && t !== 'v2'))
const shot = async (name, ms = 300) => { await page.waitForTimeout(ms); await page.screenshot({ path: `shots/papercube/${name}.png` }) }
for (const v of versions) {
  await page.evaluate((v) => { window.__aar.setHeatVersion(v); window.__aar.setHeatShape(null); window.__aar.setHeatDebug('off') }, v)
  await shot(`${v}-0`, 1200)
  await shot(`${v}-1`, 700)
  await shot(`${v}-2`, 700)
  for (const [i, d] of [[220, 40], [-300, 140]].entries()) {
    await page.mouse.move(720, 450); await page.mouse.down()
    await page.mouse.move(720 + d[0], 450 + d[1], { steps: 12 }); await page.mouse.up()
    await shot(`${v}-orbit${i}`, 400)
  }
  for (const d of ['mask', 'combined']) { await page.evaluate((d) => window.__aar.setHeatDebug(d), d); await shot(`${v}-${d}`) }
  await page.evaluate(() => window.__aar.setHeatDebug('off'))
  if (flags.has('--presets')) {
    const n = await page.evaluate(() => [...document.querySelectorAll('.controls .row')][1].querySelectorAll('button').length)
    for (let i = 1; i < n; i++) { await page.evaluate((i) => window.__aar.setHeatPreset(i), i); await shot(`${v}-preset${i}`, 600) }
    await page.evaluate(() => window.__aar.setHeatPreset(0))
  }
  if (flags.has('--shapes')) {
    for (const s of ['rounded', 'octa', 'cage']) { await page.evaluate((s) => window.__aar.setHeatShape(s), s); await shot(`${v}-${s}`, 600) }
    await page.evaluate(() => window.__aar.setHeatShape(null))
  }
  // rubik: turn continuity + integrity
  if (await page.evaluate(() => window.__aar.paperPositions().length === 27)) {
    await page.evaluate(() => window.__aar.setHeatDebug('off'))
    await shot(`${v}-turn0before`, 300)
    const p = page.evaluate(() => window.__aar.paperTurn('y', 1, 1))
    await shot(`${v}-turn1mid`, 260)
    await p
    await shot(`${v}-turn2after`, 200)
    for (let i = 0; i < 12; i++) await page.evaluate(() => window.__aar.paperTurn())
    const pos = await page.evaluate(() => window.__aar.paperPositions())
    const ok = new Set(pos.map((p) => p.join(','))).size === 27 && pos.every((p) => p.every((c) => Number.isInteger(c) && Math.abs(c) <= 1))
    console.log(v, 'integrity after 12 turns:', ok ? 'ok' : 'BROKEN ' + JSON.stringify(pos))
    await shot(`${v}-turn3later`, 200)
  }
  const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n) }; requestAnimationFrame(f) }))
  console.log(v, 'fps', fps)
}
await browser.close()
