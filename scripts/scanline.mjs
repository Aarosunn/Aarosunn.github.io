// Luminance along a horizontal scanline of a screenshot: node scripts/scanline.mjs in.png y x0 x1
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const [inp, y, x0, x1] = process.argv.slice(2)
const b64 = readFileSync(inp).toString('base64')
const browser = await chromium.launch({ channel: 'chromium' })
const page = await browser.newPage()
const out = await page.evaluate(async ([b64, y, x0, x1]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const g = c.getContext('2d'); g.drawImage(img, 0, 0)
  const d = g.getImageData(+x0, +y, +x1 - +x0, 1).data
  const row = []
  for (let i = 0; i < d.length; i += 4) row.push(Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]))
  return row
}, [b64, y, x0, x1])
await browser.close()
console.log(out.map((v, i) => `${+x0 + i}:${v}`).join(' '))
