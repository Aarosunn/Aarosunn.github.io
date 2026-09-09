/**
 * Ground truth and the plain-cube demos: paper.design's three logo animations with the site's own presets
 * (official @paper-design/shaders-react components, Apache 2.0; each panel mirrors https://shaders.paper.design/<name>),
 * then the same shaders on a plain cube through the PaperCube pipeline (whole-face plates; a layer turn reveals the cubies).
 */
import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  GemSmoke,
  Heatmap,
  LiquidMetal,
  gemSmokePresets,
  heatmapPresets,
  liquidMetalPresets,
} from '@paper-design/shaders-react'
import { PaperCube } from './PaperCube'
import { CUBE_DEMOS, type PaperVersion } from './paperVersions'
import { presetNamed } from './paperPresets'

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

function CubeDemo({ version }: { version: PaperVersion }) {
  return (
    <section className="paper-panel">
      <header>
        <h2>{version.name}</h2>
        <span>{version.note}</span>
      </header>
      <div className="paper-canvas">
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, version.camZ], fov: 30 }} gl={{ antialias: true }}>
          <PaperCube version={version} params={presetNamed(version.shader, version.preset).params} spin spinSpeed={0.2} auto autoInterval={4000} />
        </Canvas>
      </div>
    </section>
  )
}

export function Paper() {
  return (
    <>
      <div className="paper">
        {PANELS.map((p) => (
          <PaperPanel key={p.name} {...p} />
        ))}
      </div>
      <div className="paper paper-cubes">
        {CUBE_DEMOS.map((v) => (
          <CubeDemo key={v.name} version={v} />
        ))}
      </div>
    </>
  )
}
