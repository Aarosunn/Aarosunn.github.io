/**
 * AsciiPortrait: placeholder for a future webcam ASCII portrait. Procedurally shades a
 * breathing "bust" silhouette and renders it as monospace glyphs on a canvas (cheaper
 * than a DOM text grid).
 */
import { useEffect, useRef } from 'react'

type Props = {
  cols?: number
  rows?: number
  cell?: number
  color?: string
  seed?: number
  className?: string
}

const RAMP = ' .:-=+*#%@'

// mulberry32 seeded PRNG -> [0,1)
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Luminance 0..1 at a normalized cell center (u,v in [0,1]) for the bust silhouette,
// lit from a drifting upper-left light, plus seeded noise.
function luminanceAt(u: number, v: number, t: number, noise: () => number): number {
  const cx = 0.5
  const headCy = 0.32
  const headRx = 0.16
  const headRy = 0.2
  const shoulderCy = 0.82
  const shoulderRx = 0.42
  const shoulderRy = 0.34
  const shoulderTop = 0.52

  const dxH = (u - cx) / headRx
  const dyH = (v - headCy) / headRy
  const inHead = dxH * dxH + dyH * dyH <= 1
  const dxS = (u - cx) / shoulderRx
  const dyS = (v - shoulderCy) / shoulderRy
  const inShoulders = v >= shoulderTop && dxS * dxS + dyS * dyS <= 1

  if (!inHead && !inShoulders) return 0

  // slow light-direction drift around the upper-left
  const lightAngle = Math.PI * 1.25 + Math.sin(t * 0.05) * 0.3
  const lx = Math.cos(lightAngle)
  const ly = Math.sin(lightAngle)
  // approximate surface normal from distance-to-center within whichever shape we're in
  const nx = inHead ? dxH : dxS
  const ny = inHead ? dyH : dyS
  const len = Math.hypot(nx, ny) || 1
  const lum = Math.max(0, (nx / len) * lx + (ny / len) * ly) * 0.7 + 0.3
  const grain = (noise() - 0.5) * 0.15
  return Math.min(1, Math.max(0, lum + grain))
}

export function AsciiPortrait({
  cols = 40,
  rows = 26,
  cell = 6,
  color = 'currentColor',
  seed = 3,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const glyphW = cell
    const glyphH = cell * 1.6
    const dpr = window.devicePixelRatio || 1
    const cssW = cols * glyphW
    const cssH = rows * glyphH
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.scale(dpr, dpr)

    const resolvedColor = getComputedStyle(canvas).color || color
    ctx.font = `${glyphH}px "Geist Mono", ui-monospace, monospace`
    ctx.textBaseline = 'top'

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let lastFrame = 0

    const draw = (tSeconds: number) => {
      const rand = mulberry32(seed) // deterministic noise per frame, same field each pass
      // slow breathing scale: ±2% over ~5s
      const breath = 1 + 0.02 * Math.sin((tSeconds * Math.PI * 2) / 5)
      ctx.clearRect(0, 0, cssW, cssH)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const u = (c + 0.5) / cols
          const v = ((r + 0.5) / rows - 0.5) / breath + 0.5
          const lum = luminanceAt(u, v, tSeconds, rand)
          if (lum <= 0) continue
          const glyphIdx = Math.min(RAMP.length - 1, Math.floor(lum * RAMP.length))
          const glyph = RAMP[glyphIdx]
          if (glyph === ' ') continue
          ctx.globalAlpha = 0.25 + 0.75 * lum
          ctx.fillStyle = resolvedColor
          ctx.fillText(glyph, c * glyphW, r * glyphH)
        }
      }
      ctx.globalAlpha = 1
    }

    draw(0)
    if (reduceMotion) return

    const start = performance.now()
    const frameMs = 1000 / 15
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (document.hidden) return
      if (now - lastFrame < frameMs) return
      lastFrame = now
      draw((now - start) / 1000)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [cols, rows, cell, color, seed])

  return <canvas ref={canvasRef} className={className} />
}
