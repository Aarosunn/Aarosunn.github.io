// Capture paper.design's three logo-animation pages over time for reference.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots/paper', { recursive: true })
const browser = await chromium.launch({
  channel: 'chromium',
  env: { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' },
  args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
for (const name of ['heatmap', 'liquid-metal', 'gem-smoke']) {
  await page.goto(`https://shaders.paper.design/${name}`, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(2500)
  console.log(name, page.url(), await page.title())
  for (let i = 0; i < 6; i++) {
    await page.screenshot({ path: `shots/paper/${name}-${i}.png` })
    await page.waitForTimeout(700)
  }
}
await browser.close()
