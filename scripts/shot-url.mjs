// Screenshot an external page for a project picture: node scripts/shot-url.mjs <url> <out.jpg> [w h]
import { chromium } from 'playwright'
const [url, out, w = '1440', h = '900'] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chromium' })
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: out, type: 'jpeg', quality: 84 })
await browser.close()
console.log(out)
