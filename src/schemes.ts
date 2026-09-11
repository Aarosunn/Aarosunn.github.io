/**
 * Colour schemes. UI stays greyscale; hue is emitted by the cube.
 * `a` / `b` are the two scene colours fed to shaders and the aura wash.
 */
export type Scheme = {
  name: string
  bg: string
  bg2: string
  line: string
  mute: string
  text: string
  bright: string
  accent: string
  a: string
  b: string
}

/** the blank tile the site cube drains to as it lands, and the screen cube starts from (Site / CubeScreen): the cube's own
 *  dark teal plate tone (sampled from the site: its dark quartile is about 4,46,42), so the landing reads as the cube dimming to a screen */
export const TILE = '#0a2b28'

export const SCHEMES: Scheme[] = [
  {
    // ice top-left, mint glow bottom-right
    name: 'icemint',
    bg: '#07090c',
    bg2: '#0e1216',
    line: '#28303a',
    mute: '#6b7c85',
    text: '#c9d2d8',
    bright: '#f2f5f7',
    accent: '#8fb8ff',
    a: '#8fb8ff',
    b: '#9de8d4',
  },
  {
    name: 'ice',
    bg: '#07080c',
    bg2: '#0e1017',
    line: '#2a2e3a',
    mute: '#6b7185',
    text: '#c9cdd8',
    bright: '#f2f3f7',
    accent: '#8fb8ff',
    a: '#8fb8ff',
    b: '#3a4a9e',
  },
  {
    name: 'aura',
    bg: '#0a0710',
    bg2: '#140f1e',
    line: '#2e2740',
    mute: '#7a6f92',
    text: '#d2cbe0',
    bright: '#f5f2fa',
    accent: '#c4a7ff',
    a: '#c4a7ff',
    b: '#ff9ec6',
  },
  {
    name: 'ember',
    bg: '#0c0806',
    bg2: '#17100c',
    line: '#3a2c24',
    mute: '#8c7263',
    text: '#dccfc6',
    bright: '#faf4f0',
    accent: '#ffb072',
    a: '#ffb072',
    b: '#c4432c',
  },
  {
    name: 'graphite',
    bg: '#0a0a0a',
    bg2: '#141414',
    line: '#2c2c2c',
    mute: '#737373',
    text: '#cfcfcf',
    bright: '#f4f4f4',
    accent: '#e2e2e2',
    a: '#e2e2e2',
    b: '#5a5a5a',
  },
  {
    name: 'mint',
    bg: '#060b0b',
    bg2: '#0d1616',
    line: '#243434',
    mute: '#6a8a86',
    text: '#c8d8d5',
    bright: '#f0f7f6',
    accent: '#9de8d4',
    a: '#9de8d4',
    b: '#2d7f8a',
  },
  {
    name: 'paper',
    bg: '#edebe6',
    bg2: '#e2dfd8',
    line: '#c4c0b6',
    mute: '#8a877f',
    text: '#3a3934',
    bright: '#161613',
    accent: '#2b4a9a',
    a: '#2b4a9a',
    b: '#c9c4ff',
  },
]
