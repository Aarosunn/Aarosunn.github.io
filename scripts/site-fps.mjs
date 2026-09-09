// fps of the site tab (default cube) on the RTX and on the integrated GPU, at two viewports
import { chromium } from 'playwright'
const fps = async (igpu, w, h, v = 'v1') => {
  const b = await chromium.launch({ channel: 'chromium', env: igpu ? { ...process.env } : { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' }, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'] })
  const p = await b.newPage({ viewport: { width: w, height: h } })
  await p.goto(`http://localhost:5173/?v=${v}`); await p.waitForFunction(() => window.__aar); await p.waitForTimeout(2500)
  const n = await p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2) }; requestAnimationFrame(f) }))
  await b.close(); return n
}
for (const [w, h] of [[1440, 900], [420, 820]]) for (const v of ['v1', 'v8', 'v6']) console.log(`${w}x${h} ${v}: rtx ${await fps(false, w, h, v)} fps, igpu ${await fps(true, w, h, v)} fps`)
