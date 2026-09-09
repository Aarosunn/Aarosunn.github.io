/**
 * Presets for the paper shaders: paper's own site presets first, then aarcube's.
 * Palettes follow the schemes: the cube emits the hue, the UI stays grey.
 */
import { gemSmokePresets, heatmapPresets, liquidMetalPresets } from '@paper-design/shaders-react'
import type { PaperShader } from './paperVersions'

export type PaperPreset = { name: string; params: Record<string, unknown> }

const ICEMINT = ['#070c22', '#132a63', '#2f62c9', '#8fb8ff', '#c4eefb', '#9de8d4', '#f4fffb']
/** same stops, the brightest toned down (v14's icemint grain) */
const ICEMINT_SOFT = ['#070c22', '#132a63', '#2f62c9', '#8fb8ff', '#c4eefb', '#9de8d4', '#d6ebe4']
const heat = (name: string, colors: string[], extra: Record<string, unknown> = {}): PaperPreset => ({
  name,
  params: { colors, colorBack: '#000000', contour: 0.5, angle: 0, noise: 0, innerGlow: 0.5, outerGlow: 0.5, speed: 1, scale: 0.75, ...extra },
})
const smoke = (name: string, colors: string[], extra: Record<string, unknown> = {}): PaperPreset => ({
  name,
  params: { colors, colorBack: '#07090c', colorInner: '#0e1216', innerDistortion: 0.8, outerDistortion: 0.6, outerGlow: 0.55, innerGlow: 1, offset: 0, angle: 0, size: 0.8, speed: 0.7, scale: 0.6, ...extra },
})

const PAPER_HEAT = heatmapPresets[0].params.colors as string[]
/** paper's default chrome, recoloured: the stripes' luminance through a palette */
const CHROME = liquidMetalPresets[0].params as Record<string, unknown>
const tinted = (name: string, ramp: string[], extra: Record<string, unknown> = {}): PaperPreset => ({ name, params: { ...CHROME, ramp, rampGamma: 1, ...extra } })

const OWN: Record<PaperShader, PaperPreset[]> = {
  heat: [
    heat('icemint', ICEMINT),
    heat('ember', ['#12060a', '#3a0d1f', '#7a1533', '#d43d3a', '#ff8a3d', '#ffd08a', '#fff3d6']),
    heat('graphite', ['#050608', '#15181f', '#2a2f3a', '#4a5262', '#8b95a8', '#c9d2d8', '#f2f5f7']),
    heat('icemint slow', ICEMINT, { speed: 0.55 }),
  ],
  liquid: [
    { name: 'ice', params: { colorBack: '#07090c', colorTint: '#bfe0ff', softness: 0.2, repetition: 2, shiftRed: 0.3, shiftBlue: 0.3, distortion: 0.07, contour: 0.4, angle: 70, speed: 0.6, scale: 0.6 } },
    { name: 'noir slow', params: { colorBack: '#000000', colorTint: '#a0a0a4', softness: 0.35, repetition: 1.5, shiftRed: 0, shiftBlue: 0, distortion: 0, contour: 0, angle: 90, speed: 0.45, scale: 0.6 } },
    { name: 'mint', params: { colorBack: '#07090c', colorTint: '#9de8d4', softness: 0.15, repetition: 2.5, shiftRed: 0.2, shiftBlue: 0.4, distortion: 0.05, contour: 0.5, angle: 60, speed: 0.6, scale: 0.6 } },
    { name: 'ice grain', params: { colorBack: '#07090c', colorTint: '#bfe0ff', softness: 0.2, repetition: 2, shiftRed: 0.3, shiftBlue: 0.3, distortion: 0.07, contour: 0.4, angle: 70, speed: 0.6, scale: 0.6, grain: 0.7 } },
    { name: 'mint grain', params: { colorBack: '#07090c', colorTint: '#9de8d4', softness: 0.15, repetition: 2.5, shiftRed: 0.2, shiftBlue: 0.4, distortion: 0.05, contour: 0.5, angle: 60, speed: 0.6, scale: 0.6, grain: 0.7 } },
    // rampFloor keeps the darkest chrome on a visible stop instead of the page colour
    tinted('heatmap', PAPER_HEAT, { rampGamma: 1.2, rampFloor: 0.12 }),
    tinted('heatmap grain', PAPER_HEAT, { rampGamma: 1.2, rampFloor: 0.12, grain: 0.3 }),
    tinted('icemint', ICEMINT, { rampFloor: 0.2 }),
    tinted('icemint grain', ICEMINT, { rampFloor: 0.2, grain: 0.3 }),
    tinted('icemint grain soft', ICEMINT_SOFT, { rampFloor: 0.2, grain: 0.3 }),
  ],
  smoke: [
    smoke('icemint', ['#0b1a2a', '#8fb8ff', '#9de8d4']),
    smoke('ember', ['#2a0a06', '#d43d3a', '#ffd08a']),
    smoke('graphite', ['#15181f', '#8b95a8', '#f2f5f7'], { outerGlow: 0.45, speed: 0.6 }),
  ],
}

const site = (ps: { name: string; params: object }[]): PaperPreset[] => ps.map((p) => ({ name: p.name, params: p.params as Record<string, unknown> }))

/** the preset row per shader: paper's site presets, then ours */
export const PRESETS_OF: Record<PaperShader, PaperPreset[]> = {
  heat: [...site(heatmapPresets), ...OWN.heat],
  liquid: [...site(liquidMetalPresets), ...OWN.liquid],
  smoke: [...site(gemSmokePresets), ...OWN.smoke],
}

export const presetNamed = (shader: PaperShader, name: string | undefined): PaperPreset =>
  PRESETS_OF[shader].find((p) => p.name.toLowerCase() === name) ?? PRESETS_OF[shader][0]
