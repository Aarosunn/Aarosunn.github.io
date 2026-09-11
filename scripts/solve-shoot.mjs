// Screen-as-cube solve: frames through one "next project" for a solve version, landscape and portrait -> sheets.
// Usage: node scripts/solve-shoot.mjs "s1 solve"
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
const v = process.argv[2] ?? 's1 solve'
const tag = v.split(' ')[0]
mkdirSync('shots/solve', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
for (const [w, h, name] of [[1440, 900, 'land'], [420, 820, 'port']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('console', m.text().slice(0, 300)))
  await page.goto(`http://localhost:5173/?tab=transition&tv=${tag[0] === 'a' ? 'v2' : tag[0] === 'w' ? 'v3' : 'v1'}&screen=${encodeURIComponent(v)}`)
  await page.waitForFunction(() => window.__aarTransition)
  await page.waitForFunction(() => document.querySelector('.transition-tab canvas')?.width > 300)
  await page.waitForTimeout(600)
  const files = []
  // N=2: run next() once to completion first, then frame the second run (checks the print on already-turned faces)
  for (let i = 1; i < +(process.env.N ?? 1); i++) { await page.evaluate(() => { window.__aarTransition.next() }); await page.waitForFunction(() => !window.__aarTransition.busy(), null, { timeout: 15000 }); await page.waitForTimeout(200) }
  const t0 = Date.now()
  await page.evaluate(() => { window.__aarTransition.next() })
  for (const ms of (process.env.MS ? process.env.MS.split(",").map(Number) : [0, 150, 350, 600, 850, 1100, 1400, 1900])) {
    const wait = ms - (Date.now() - t0)
    if (wait > 0) await page.waitForTimeout(wait)
    const path = `shots/solve/${tag}-${name}-${String(ms).padStart(4, '0')}.png`
    await page.screenshot({ path })
    files.push(`${ms}ms=${path}`)
  }
  await page.close()
  execSync(`node scripts/sheet.mjs shots/sheet-solve-${tag}-${name}.png ${files.join(' ')} --cols 4 --w ${name === 'land' ? 2400 : 1600}`, { stdio: 'inherit' })
}
await browser.close()
