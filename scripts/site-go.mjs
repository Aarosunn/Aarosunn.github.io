// The site's section transition: fly the cube into a section, one next project, then home -> frames + sheets.
// Usage: node scripts/site-go.mjs [section index, default 1 = code]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
const sec = +(process.argv[2] ?? 1)
mkdirSync('shots/site-go', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
for (const [w, h, name] of [[1440, 900, 'land'], [420, 820, 'port']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('console', m.text().slice(0, 300)))
  await page.goto('http://localhost:5173/')
  await page.waitForFunction(() => window.__aarNav && document.querySelector('canvas')?.width > 300)
  await page.waitForTimeout(2500)
  const files = []
  const shoot = async (tag, t0, list) => {
    for (const ms of list) {
      const wait = ms - (Date.now() - t0)
      if (wait > 0) await page.waitForTimeout(wait)
      const path = `shots/site-go/${name}-${tag}-${String(ms).padStart(4, '0')}.png`
      await page.screenshot({ path })
      files.push(`${tag}+${ms}=${path}`)
    }
  }
  let t0 = Date.now()
  await page.evaluate((i) => window.__aarNav.go(i), sec)
  await shoot('go', t0, [0, 200, 400, 700, 1000, 1500, 2200, 2700, 3200])
  await page.waitForFunction(() => !window.__aarNav.busy())
  console.log(name, 'landed, section', await page.evaluate(() => window.__aarNav.section()))
  t0 = Date.now()
  await page.evaluate(() => { window.__aarNav.next() })
  await shoot('next', t0, [200, 700, 1500, 2600])
  await page.waitForFunction(() => !window.__aarNav.busy())
  t0 = Date.now()
  await page.evaluate(() => window.__aarNav.home())
  await shoot('home', t0, [0, 600, 1500, 2200, 2500, 2800, 3200, 3800])
  await page.waitForFunction(() => !window.__aarNav.busy())
  await page.waitForTimeout(300)
  console.log(name, 'home, section', await page.evaluate(() => window.__aarNav.section()))
  await page.close()
  execSync(`node scripts/sheet.mjs shots/sheet-site-go-${name}.png ${files.join(' ')} --cols 4 --w ${name === 'land' ? 2400 : 1600}`, { stdio: 'inherit' })
}
await browser.close()
