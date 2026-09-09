// Shoot the site mock at three viewports, stepping the deck.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots/site', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
for (const [w, h] of [[1440, 900], [1024, 700], [420, 820]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('console', m.text().slice(0, 400)))
  await page.goto('http://localhost:5173/')
  await page.waitForFunction(() => window.__aar)
  await page.evaluate(() => window.__aar.setTab('site'))
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `shots/site/${w}-0.png` })
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(280)
  await page.screenshot({ path: `shots/site/${w}-1mid.png` })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `shots/site/${w}-1.png` })
  await page.keyboard.press('3')
  await page.waitForTimeout(900)
  await page.screenshot({ path: `shots/site/${w}-2.png` })
  if (w === 1440) { await page.keyboard.press('l'); await page.waitForTimeout(900); await page.screenshot({ path: `shots/site/${w}-deck.png` }); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(900); await page.screenshot({ path: `shots/site/${w}-deck2.png` }); await page.keyboard.press('l'); await page.waitForTimeout(500) }
  if (w === 1440) for (const [i, n] of [[0, 'ice'], [1, 'mint'], [2, 'icemint']]) { await page.click(`.site-theme button:nth-child(${i + 1})`); await page.waitForTimeout(700); await page.screenshot({ path: `shots/site/${w}-theme-${n}.png` }) }
  await page.click('.sec.on li')
  await page.waitForTimeout(900)
  await page.screenshot({ path: `shots/site/${w}-panel.png` })
  await page.keyboard.press('Escape')
  if (w === 1440) for (let i = 1; i < 4; i++) { await page.keyboard.press('c'); await page.waitForTimeout(1200); await page.screenshot({ path: `shots/site/${w}-scheme${i}.png` }) }
  if (w === 1440) for (let i = 1; i < 8; i++) { await page.keyboard.press('v'); await page.waitForTimeout(1500); await page.screenshot({ path: `shots/site/${w}-ver${i}.png` }) }
  await page.close()
}
await browser.close()
