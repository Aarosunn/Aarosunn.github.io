/** floral tab: the x-ray technical floral at review size, one version at a time, a few seeds */
import { useMemo, useState } from 'react'
import { XrayFloral, XF_H, XF_W } from './XrayFloral'
import { XrayFlower3D } from './XrayFlower3D'
import { FLORAL_VERSIONS, type FloralVersion, type Placed3 } from './floralVersions'
import { FLOWERS } from './xrayMesh'

const SEEDS = [1, 2, 3, 4, 5, 6]
const DEG = 180 / Math.PI
const r2 = (n: number) => Math.round(n * 100) / 100
/** the `place` entry as it would go into floralVersions.ts */
const placeLine = (p: Placed3) => `{ flower: '${p.flower}', at: [${p.at.map(r2).join(', ')}], scale: ${r2(p.scale)}${p.rot ? `, rot: [${p.rot.map(r2).join(', ')}]` : ''}${p.gain !== undefined ? `, gain: ${p.gain}` : ''}${p.wire !== undefined ? `, wire: ${p.wire}` : ''} }`
const Slider = ({ k, value, min, max, step, onChange }: { k: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) => (
  <label className="pose"><span className="k">{k}</span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} /><span className="val">{r2(value)}</span></label>
)
export function FloralTab({ v, seed, flower, scheme, setVersion, setSeed, setFlower }: { v: FloralVersion; seed: number; flower: string; scheme: string; setVersion: (n: string) => void; setSeed: (n: number) => void; setFlower: (n: string) => void }) {
  const mesh = v.kind === 'mesh'
  // pose: hand-adjust one placed flower with sliders; the readout prints the entry to paste into floralVersions.ts
  const [poseOf, setPoseOf] = useState<Record<string, Placed3>>({})
  const [posing, setPosing] = useState(0)
  const [zoom, setZoom] = useState(1.5) // tab-only: camera closer for posing
  const placed = v.scene?.place
  const shown: FloralVersion = useMemo(() => (placed ? { ...v, scene: { ...v.scene!, camDist: (v.scene!.camDist ?? 9.4) / zoom, place: placed.map((p) => poseOf[`${v.name}/${p.flower}`] ?? p) } } : v), [v, placed, poseOf, zoom])
  const cur = shown.scene?.place?.[posing]
  const setPose = (patch: Partial<Placed3>) => cur && setPoseOf((o) => ({ ...o, [`${v.name}/${cur.flower}`]: { ...cur, ...patch } }))
  const rot = cur?.rot ?? [0, 0, 0]
  return (
    <div className="floral-tab">
      <div className="controls">
        <div className="row">
          <span className="k">version</span>
          {FLORAL_VERSIONS.map((x) => (
            <button key={x.name} className={x.name === v.name ? 'on' : ''} onClick={() => setVersion(x.name)}>{x.name}</button>
          ))}
        </div>
        {mesh && !v.scene && (
          <div className="row">
            <span className="k">flower</span>
            {FLOWERS.map((f) => (
              <button key={f.name} className={f.name === flower ? 'on' : ''} onClick={() => setFlower(f.name)}>{f.name}</button>
            ))}
          </div>
        )}
        {placed && (
          <>
            <div className="row">
              <span className="k">pose</span>
              {placed.map((p, i) => (
                <button key={p.flower} className={i === posing ? 'on' : ''} onClick={() => setPosing(i)}>{p.flower}</button>
              ))}
              <button onClick={() => setPoseOf({})}>reset</button>
              <Slider k="zoom" value={zoom} min={0.6} max={3} step={0.01} onChange={setZoom} />
            </div>
            {cur && (
              <div className="row">
                {(['x', 'y', 'z'] as const).map((k, i) => <Slider key={k} k={k} value={cur.at[i]} min={-1.2} max={1.2} step={0.005} onChange={(n) => { const at = [...cur.at] as Placed3['at']; at[i] = n; setPose({ at }) }} />)}
                {(['rx', 'ry', 'rz'] as const).map((k, i) => <Slider key={k} k={k} value={rot[i] * DEG} min={-180} max={180} step={0.5} onChange={(n) => { const r = [...rot] as [number, number, number]; r[i] = n / DEG; setPose({ rot: r }) }} />)}
                <Slider k="scale" value={cur.scale} min={0.2} max={1.5} step={0.005} onChange={(n) => setPose({ scale: n })} />
              </div>
            )}
          </>
        )}
        {!placed && <div className="row">
          <span className="k">seed</span>
          {SEEDS.map((s) => (
            <button key={s} className={s === seed ? 'on' : ''} onClick={() => setSeed(s)}>{s}</button>
          ))}
        </div>}
      </div>
      <div className={`floral-stage ${v.placement === 'bottom' ? 'floral-stage-page' : ''} ${placed ? 'floral-stage-pose' : ''}`}>
        {v.placement === 'bottom' ? (
          // as on the site: a page-wide strip along the bottom
          <XrayFlower3D key={`${v.name}-${seed}`} v={v} seed={seed} width={1360} height={240} scheme={scheme} upright />
        ) : mesh ? <XrayFlower3D key={`${v.name}-${flower}-${seed}`} v={shown} flower={flower} seed={seed} width={v.scene ? 1200 : 960} height={v.scene ? 520 : 600} scheme={scheme} upright /> : <XrayFloral v={v} seed={seed} width={XF_W * 2} height={XF_H * 2} scheme={scheme} />}
      </div>
      {!mesh && (
        <div className="floral-stage floral-stage-site">
          <XrayFloral v={v} seed={seed} width={XF_W} height={XF_H} scheme={scheme} className="floral xray" />
        </div>
      )}
      <div className="readout">
        <span className="note">{v.note}</span>
        {cur && <code className="place">{placeLine(cur)} <button onClick={() => navigator.clipboard.writeText(placeLine(cur))}>copy</button></code>}
        {cur && <span>click a slider, then arrow keys step it (page up / down for a tenth of the range); zoom is the tab's only</span>}
        <span>{v.scene?.place ? `/?floral=${v.name} shows it on the site` : mesh ? `/?floral=${v.name}&flower=${flower}&seed=${seed} shows it on the site` : `at 2× above, at the site's size below · /?floral=${v.name}&seed=${seed} shows it on the site`}</span>
      </div>
    </div>
  )
}
