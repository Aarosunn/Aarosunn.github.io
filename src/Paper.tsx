/**
 * Pure recreation of paper.design's three logo animations, no cube: the official
 * @paper-design/shaders-react components with the site's own presets (Apache 2.0).
 * Each panel mirrors the page at https://shaders.paper.design/<name>.
 */
import { useState } from 'react'
import {
  GemSmoke,
  Heatmap,
  LiquidMetal,
  gemSmokePresets,
  heatmapPresets,
  liquidMetalPresets,
} from '@paper-design/shaders-react'

type Panel = {
  name: string
  url: string
  presets: { name: string; params: object }[]
  Comp: React.FC<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  /** image-masked shaders need the site's diamond logo (vendored from shaders.paper.design/images/logos/diamond.svg) */
  image?: string
}

const PANELS: Panel[] = [
  { name: 'heatmap', url: 'https://shaders.paper.design/heatmap', presets: heatmapPresets, Comp: Heatmap, image: '/paper/diamond.svg' },
  { name: 'liquid metal', url: 'https://shaders.paper.design/liquid-metal', presets: liquidMetalPresets, Comp: LiquidMetal },
  { name: 'gem smoke', url: 'https://shaders.paper.design/gem-smoke', presets: gemSmokePresets, Comp: GemSmoke },
]

function PaperPanel({ name, url, presets, Comp, image }: Panel) {
  const [pi, setPi] = useState(0)
  const preset = presets[pi]
  return (
    <section className="paper-panel">
      <header>
        <h2>{name}</h2>
        <a href={url} target="_blank" rel="noreferrer">
          source
        </a>
      </header>
      <div className="paper-canvas">
        <Comp {...preset.params} image={image} width="100%" height="100%" />
      </div>
      <div className="row">
        {presets.map((p, i) => (
          <button key={p.name} className={i === pi ? 'on' : ''} onClick={() => setPi(i)}>
            {p.name.toLowerCase()}
          </button>
        ))}
      </div>
    </section>
  )
}

export function Paper() {
  return (
    <div className="paper">
      {PANELS.map((p) => (
        <PaperPanel key={p.name} {...p} />
      ))}
    </div>
  )
}
