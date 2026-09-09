/**
 * aarcube's own presets for the paper shaders, listed after paper's site presets in the preset row.
 * Palettes follow the schemes: the cube emits the hue, the UI stays grey.
 */
import type { PaperShader } from './paperVersions'

export type PaperPreset = { name: string; params: Record<string, unknown> }

const heat = (name: string, colors: string[], extra: Record<string, unknown> = {}): PaperPreset => ({
  name,
  params: { colors, colorBack: '#000000', contour: 0.5, angle: 0, noise: 0, innerGlow: 0.5, outerGlow: 0.5, speed: 1, scale: 0.75, ...extra },
})

export const PAPER_PRESETS: Record<PaperShader, PaperPreset[]> = {
  heat: [
    // icemint: navy -> ice -> mint -> white
    heat('icemint', ['#070c22', '#132a63', '#2f62c9', '#8fb8ff', '#c4eefb', '#9de8d4', '#f4fffb']),
    heat('ember', ['#12060a', '#3a0d1f', '#7a1533', '#d43d3a', '#ff8a3d', '#ffd08a', '#fff3d6']),
    heat('graphite', ['#050608', '#15181f', '#2a2f3a', '#4a5262', '#8b95a8', '#c9d2d8', '#f2f5f7']),
    heat('icemint slow', ['#070c22', '#132a63', '#2f62c9', '#8fb8ff', '#c4eefb', '#9de8d4', '#f4fffb'], { speed: 0.55 }),
  ],
  liquid: [
    { name: 'ice', params: { colorBack: '#07090c', colorTint: '#bfe0ff', softness: 0.2, repetition: 2, shiftRed: 0.3, shiftBlue: 0.3, distortion: 0.07, contour: 0.4, angle: 70, speed: 0.6, scale: 0.6 } },
    { name: 'noir slow', params: { colorBack: '#000000', colorTint: '#a0a0a4', softness: 0.35, repetition: 1.5, shiftRed: 0, shiftBlue: 0, distortion: 0, contour: 0, angle: 90, speed: 0.45, scale: 0.6 } },
    { name: 'mint', params: { colorBack: '#07090c', colorTint: '#9de8d4', softness: 0.15, repetition: 2.5, shiftRed: 0.2, shiftBlue: 0.4, distortion: 0.05, contour: 0.5, angle: 60, speed: 0.6, scale: 0.6 } },
  ],
  smoke: [
    { name: 'icemint', params: { colors: ['#0b1a2a', '#8fb8ff', '#9de8d4'], colorBack: '#07090c', colorInner: '#0e1216', innerDistortion: 0.8, outerDistortion: 0.6, outerGlow: 0.55, innerGlow: 1, offset: 0, angle: 0, size: 0.8, speed: 0.7, scale: 0.6 } },
    { name: 'ember', params: { colors: ['#2a0a06', '#d43d3a', '#ffd08a'], colorBack: '#07090c', colorInner: '#0e1216', innerDistortion: 0.8, outerDistortion: 0.6, outerGlow: 0.55, innerGlow: 1, offset: 0, angle: 0, size: 0.8, speed: 0.7, scale: 0.6 } },
    { name: 'graphite', params: { colors: ['#15181f', '#8b95a8', '#f2f5f7'], colorBack: '#07090c', colorInner: '#0e1216', innerDistortion: 0.8, outerDistortion: 0.6, outerGlow: 0.45, innerGlow: 1, offset: 0, angle: 0, size: 0.8, speed: 0.6, scale: 0.6 } },
  ],
}
