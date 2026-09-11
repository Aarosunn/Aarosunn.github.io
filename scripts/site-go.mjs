// The site's section transition: fly the cube into a section, one next project, then home -> frames + sheets.
// Usage: [SV=s1] node scripts/site-go.mjs [section index, default 1 = code]   (SV = the site version, ?sv=)
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
  await page.goto('http://localhost:5173/' + (process.env.SV ? '?sv=' + process.env.SV : ''))
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
  await page.evaluate((i) => { window.__aarNav.go(i) }, sec)
  await shoot('go', t0, [0, 1000, 2000, 2600, 2750, 3000, 3300, 3600, 4200, 5000, 6000, 6800])
  await page.waitForFunction(() => !window.__aarNav.busy(), null, { timeout: 20000 })
  console.log(name, 'landed, section', await page.evaluate(() => window.__aarNav.section()))
  t0 = Date.now()
  await page.evaluate(() => { window.__aarNav.next() })
  await shoot('next', t0, [200, 700, 1500, 2600])
  await page.waitForFunction(() => !window.__aarNav.busy(), null, { timeout: 20000 })
  t0 = Date.now()
  await page.evaluate(() => { window.__aarNav.home() })
  await shoot('home', t0, [0, 500, 1200, 2000, 2400, 2700, 3000, 3600, 4400, 5200, 6000])
  await page.waitForFunction(() => !window.__aarNav.busy(), null, { timeout: 20000 })
  await page.waitForTimeout(300)
  console.log(name, 'home, section', await page.evaluate(() => window.__aarNav.section()))
  await page.close()
  execSync(`node scripts/sheet.mjs shots/sheet-site-go-${process.env.SV ?? 's1'}-${name}.png ${files.join(' ')} --cols 4 --w ${name === 'land' ? 2400 : 1600}`, { stdio: 'inherit' })
}
await browser.close()
