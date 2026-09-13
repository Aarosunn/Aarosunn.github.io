/** A project drawn as a page at the viewport's size: the text the section page's tiles carry. */
import * as THREE from 'three'
import type { Project } from './content'
import { THEME } from './theme'

/** the page's text colours over the dark ground; mute lifted a little for the dark mint */
const COLORS = { text: THEME.text, bright: THEME.bright, mute: '#8fb3ab' }

/** pictures load once and stay */
const cache = new Map<string, Promise<HTMLImageElement>>()
const load = (src: string) => {
  let p = cache.get(src)
  if (!p) { p = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src }); cache.set(src, p) }
  return p
}

export type Rect = { x: number; y: number; w: number; h: number }

/** the texture paints at once with the text; when the project's pictures have loaded it paints again and reports where each
 *  picture went (css px on the page), so a link can be laid over it */
export function pageTexture(p: Project, w: number, h: number, onRects?: (rects: Rect[]) => void) {
  const c = document.createElement('canvas')
  // 2× on a retina screen, 1× otherwise: a page texture is the whole viewport, so this is most of the GPU memory used
  const s = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)))
  c.width = w * s
  c.height = h * s
  paintPage(c, p, w, h, [])
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  if (p.images?.length) Promise.all(p.images.map(load)).then((ims) => { const rects = paintPage(c, p, w, h, ims); tex.needsUpdate = true; onRects?.(rects) }).catch(() => {})
  return tex
}

export function paintPage(c: HTMLCanvasElement, p: Project, w: number, h: number, images: HTMLImageElement[]): Rect[] {
  const s = c.width / w
  const g = c.getContext('2d')!
  g.setTransform(s, 0, 0, s, 0, 0)
  g.clearRect(0, 0, w, h)
  const portrait = h > w
  const withPics = images.length > 0
  const left = w * 0.08
  // with pictures the text sits at the top and the pictures take the right (landscape) or the rest of the height (portrait)
  const top = portrait ? h * 0.12 : withPics ? h * 0.14 : h * 0.3
  // type scales with the width: 64 / 13 / 15 px at 1440 wide, down to 36 / 11 / 12 on a phone
  const clamp = (lo: number, v: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, v)))
  const title = clamp(36, w * 0.0444, 72), meta = clamp(11, w * 0.009, 14), body = clamp(12, w * 0.0104, 16)
  g.fillStyle = COLORS.mute
  g.font = `400 ${meta}px "Geist Mono", ui-monospace, monospace`
  g.fillText(p.year ? `${p.section} · ${p.year}` : p.section, left, top)
  g.fillStyle = COLORS.bright
  g.font = `300 ${title}px Unbounded, sans-serif`
  g.fillText(p.title, left - 2, top + title * 1.3)
  g.fillStyle = COLORS.text
  g.font = `400 ${body}px "Geist Mono", ui-monospace, monospace`
  const words = (p.blurb ?? '').split(' ')
  const maxW = portrait ? w * 0.84 : withPics ? w * 0.3 : w * 0.36
  let line = ''
  let y = top + title * 1.3 + body * 3
  for (const wd of words) {
    const q = line ? `${line} ${wd}` : wd
    if (g.measureText(q).width > maxW) { g.fillText(line, left, y); line = wd; y += body * 1.5 } else line = q
  }
  g.fillText(line, left, y)
  const rects: Rect[] = []
  if (!withPics) return rects
  // the pictures, in justified rows: every picture in a row is scaled to the row's height so the row fills the width exactly
  // (like a gallery wall), three to a row on a wide page, two on a tall one; if the rows outgrow the area they shrink together
  // the tall page keeps clear of the hint buttons along the bottom (they sit in the last 9 %)
  const area = portrait ? { x: w * 0.08, y: y + body * 2.5, w: w * 0.84, h: h * 0.86 - (y + body * 2.5) } : { x: w * 0.44, y: h * 0.1, w: w * 0.5, h: h * 0.8 }
  const n = images.length
  const per = portrait ? (n === 1 ? 1 : 2) : n <= 2 ? n : n <= 4 ? 2 : 3
  const gap = Math.round(Math.min(w, h) * 0.014)
  const rows: HTMLImageElement[][] = []
  for (let i = 0; i < n; i += per) rows.push(images.slice(i, i + per))
  const aspect = (im: HTMLImageElement) => im.naturalWidth / im.naturalHeight
  const heights = rows.map((r) => (area.w - gap * (r.length - 1)) / r.reduce((a, im) => a + aspect(im), 0))
  const total = heights.reduce((a, b) => a + b, 0) + gap * (rows.length - 1)
  const k = Math.min(1, area.h / total)
  let ry = area.y + (area.h - total * k) / 2
  rows.forEach((r, ri) => {
    const rh = heights[ri] * k
    const rw = r.reduce((a, im) => a + aspect(im) * rh, 0) + gap * (r.length - 1)
    let rx = area.x + (area.w - rw) / 2
    r.forEach((im) => {
      const dw = aspect(im) * rh
      // corners rounded like a cubie's plate
      const rad = Math.round(Math.min(dw, rh) * 0.045)
      g.save()
      g.beginPath(); g.roundRect(rx, ry, dw, rh, rad); g.clip()
      g.drawImage(im, rx, ry, dw, rh)
      g.restore()
      g.strokeStyle = 'rgba(242, 245, 247, 0.16)'
      g.lineWidth = 1
      g.beginPath(); g.roundRect(rx + 0.5, ry + 0.5, dw - 1, rh - 1, rad); g.stroke()
      rects.push({ x: rx, y: ry, w: dw, h: rh })
      rx += dw + gap
    })
    ry += rh + gap
  })
  return rects
}
