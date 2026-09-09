// Record a short tour of the site: idle, deck steps, a panel, a version change. Output shots/site/tour.webm
import { chromium } from 'playwright'
import { mkdirSync, renameSync, readdirSync } from 'node:fs'
mkdirSync('shots/site/video', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: 'shots/site/video', size: { width: 1440, height: 900 } } })
const page = await ctx.newPage()
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__aar)
await page.waitForTimeout(4000)
for (const k of ['ArrowRight', 'ArrowRight']) { await page.keyboard.press(k); await page.waitForTimeout(1800) }
await page.click('.sec.on li'); await page.waitForTimeout(2600)
await page.keyboard.press('Escape'); await page.waitForTimeout(1200)
await page.keyboard.press('v'); await page.waitForTimeout(3000)
await page.keyboard.press('c'); await page.waitForTimeout(2500)
await page.mouse.move(720, 450); await page.mouse.wheel(0, 120); await page.waitForTimeout(2200)
await ctx.close()
await browser.close()
const f = readdirSync('shots/site/video').find((x) => x.endsWith('.webm'))
renameSync(`shots/site/video/${f}`, 'shots/site/tour.webm')
console.log('shots/site/tour.webm')
