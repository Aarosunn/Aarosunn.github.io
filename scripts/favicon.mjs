// Preview the favicon at the sizes a tab and a bookmark show it: node scripts/favicon.mjs -> shots/favicon-sheet.png
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const svg = readFileSync('public/favicon.svg', 'utf8')
const b64 = Buffer.from(svg).toString('base64')
const browser = await chromium.launch({ channel: 'chromium' })
const page = await browser.newPage({ viewport: { width: 900, height: 360 }, deviceScaleFactor: 2 })
const sizes = [16, 24, 32, 48, 64, 128, 256]
await page.setContent(`<body style="margin:0;background:#1e2126;display:flex;align-items:flex-end;gap:24px;padding:24px;font:12px monospace;color:#889">
  ${sizes.map((s) => `<div style="display:grid;justify-items:center;gap:6px"><img src="data:image/svg+xml;base64,${b64}" width="${s}" height="${s}"><span>${s}</span></div>`).join('')}
  <div style="display:grid;justify-items:center;gap:6px;background:#fff;padding:8px"><img src="data:image/svg+xml;base64,${b64}" width="32" height="32"><span style="color:#667">light tab</span></div>
</body>`)
await page.screenshot({ path: 'shots/favicon-sheet.png' })
await browser.close()
console.log('shots/favicon-sheet.png')
