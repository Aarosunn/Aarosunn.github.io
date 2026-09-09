// Record the site cube per theme while it turns (auto + arrow keys), then split to frames.
// Usage: node scripts/site-rec.mjs [--secs 20] [--themes 0,1,2]
import { chromium } from 'playwright'
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d }
const secs = +opt('--secs', 20)
const themes = opt('--themes', '0,1,2').split(',').map(Number)
const names = ['ice', 'mint', 'icemint']
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
for (const ti of themes) {
  const dir = `shots/site-rec/${names[ti]}`
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir, size: { width: 1440, height: 900 } } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/')
  await page.waitForFunction(() => window.__aar && window.__aarSite?.current)
  await page.click(`.site-theme button:nth-child(${ti + 1})`)
  await page.waitForTimeout(1500)
  const t0 = Date.now()
  while (Date.now() - t0 < secs * 1000) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(2500) }
  await ctx.close()
  const f = readdirSync(dir).find((x) => x.endsWith('.webm'))
  renameSync(`${dir}/${f}`, `${dir}/rec.webm`)
  execSync(`ffmpeg -loglevel error -y -i ${dir}/rec.webm -vf "crop=700:700:370:100" ${dir}/f%04d.png`)
  console.log(names[ti], readdirSync(dir).filter((x) => x.endsWith('.png')).length, 'frames')
}
await browser.close()
