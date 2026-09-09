// Contact sheet: node scripts/sheet.mjs out.png label=path label=path ... [--cols 4] [--w 1600]
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const args = process.argv.slice(2)
const out = args.shift()
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d }
const cols = +opt('--cols', 4), W = +opt('--w', 1600)
const tiles = args.map((a) => { const [label, path] = a.includes('=') ? a.split('=') : [a.replace(/^.*\//, '').replace(/\.png$/, ''), a]; return { label, src: 'data:image/png;base64,' + readFileSync(resolve(path)).toString('base64') } })
const html = `<style>body{margin:0;background:#111;font:12px monospace;color:#ccc}.g{display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;padding:4px}.t img{width:100%;display:block}.t span{display:block;padding:2px 4px}</style><div class="g">${tiles.map((t) => `<div class="t"><img src="${t.src}"><span>${t.label}</span></div>`).join('')}</div>`
const browser = await chromium.launch({ channel: 'chromium' })
const page = await browser.newPage({ viewport: { width: W, height: 800 } })
await page.setContent(html)
await page.screenshot({ path: out, fullPage: true })
await browser.close()
console.log(out)
