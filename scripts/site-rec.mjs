// Record the site cube while it turns (auto + arrow keys), then split to frames -> shots/site-rec/<name>/f%04d.png
// Usage: node scripts/site-rec.mjs [--secs 20] [--name site]  (key g cycles the cube theme if wanted: --g 1)
import { chromium } from 'playwright'
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d }
const secs = +opt('--secs', 20)
const name = opt('--name', 'site')
const g = +opt('--g', 0)
const browser = await chromium.launch({ channel: 'chromium', env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
{
  const dir = `shots/site-rec/${name}`
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir, size: { width: 1440, height: 900 } } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/')
  await page.waitForFunction(() => window.__aar && window.__aarSite?.current)
  for (let i = 0; i < g; i++) await page.keyboard.press('g')
  await page.waitForTimeout(1500)
  const t0 = Date.now()
  while (Date.now() - t0 < secs * 1000) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(2500) }
  await ctx.close()
  const f = readdirSync(dir).find((x) => x.endsWith('.webm'))
  renameSync(`${dir}/${f}`, `${dir}/rec.webm`)
  execSync(`ffmpeg -loglevel error -y -i ${dir}/rec.webm -vf "crop=700:700:370:100" ${dir}/f%04d.png`)
  console.log(name, readdirSync(dir).filter((x) => x.endsWith('.png')).length, 'frames')
}
await browser.close()
