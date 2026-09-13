/** A project drawn as a page at the viewport's size: the text the section page's tiles carry. */
import * as THREE from 'three'
import type { Project } from './content'
import { THEME } from './theme'

/** the page's text colours over the dark ground; mute lifted a little for the dark mint */
const COLORS = { text: THEME.text, bright: THEME.bright, mute: '#8fb3ab' }

export function pageTexture(p: Project, w: number, h: number) {
  const c = document.createElement('canvas')
  // 2× on a retina screen, 1× otherwise: a page texture is the whole viewport, so this is most of the GPU memory used
  const s = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)))
  c.width = w * s
  c.height = h * s
  paintPage(c, p, w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  return tex
}

export function paintPage(c: HTMLCanvasElement, p: Project, w: number, h: number) {
  const s = c.width / w
  const g = c.getContext('2d')!
  g.setTransform(s, 0, 0, s, 0, 0)
  g.clearRect(0, 0, w, h)
  const portrait = h > w
  const left = w * 0.08
  const top = portrait ? h * 0.14 : h * 0.3
  g.fillStyle = COLORS.mute
  g.font = `400 ${portrait ? 12 : 13}px "Geist Mono", ui-monospace, monospace`
  g.fillText(`${p.section} · ${p.year}`, left, top)
  g.fillStyle = COLORS.bright
  g.font = `300 ${portrait ? 40 : 64}px Unbounded, sans-serif`
  g.fillText(p.title, left - 2, top + (portrait ? 54 : 84))
  g.fillStyle = COLORS.text
  g.font = `400 ${portrait ? 13 : 15}px "Geist Mono", ui-monospace, monospace`
  const words = p.blurb.split(' ')
  const maxW = portrait ? w * 0.84 : w * 0.36
  let line = ''
  let y = top + (portrait ? 92 : 130)
  for (const wd of words) {
    const q = line ? `${line} ${wd}` : wd
    if (g.measureText(q).width > maxW) { g.fillText(line, left, y); line = wd; y += 22 } else line = q
  }
  g.fillText(line, left, y)
}
