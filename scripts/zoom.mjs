// Zoom crops of a screenshot: node scripts/zoom.mjs in.png out.png x,y[,size[,scale]] ...
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const [inp, out, ...pts] = process.argv.slice(2)
const b64 = readFileSync(inp).toString('base64')
const browser = await chromium.launch({ channel: 'chromium' })
const page = await browser.newPage({ viewport: { width: 1600, height: 500 } })
const crops = pts.map((p) => { const [x, y, size = 80, scale = 5] = p.split(',').map(Number); return { x, y, size, scale } })
await page.setContent(`<body style="margin:0;background:#222;display:flex;gap:10px">${crops.map((c) => `<div style="width:${c.size * c.scale}px;height:${c.size * c.scale}px;overflow:hidden;position:relative"><img src="data:image/png;base64,${b64}" style="position:absolute;left:${-(c.x - c.size / 2) * c.scale}px;top:${-(c.y - c.size / 2) * c.scale}px;transform-origin:0 0;transform:scale(${c.scale});image-rendering:pixelated"></div>`).join('')}</body>`)
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: crops.reduce((a, c) => a + c.size * c.scale + 10, 0), height: Math.max(...crops.map((c) => c.size * c.scale)) } })
await browser.close()
console.log(out)
