/** floral tab: the x-ray technical floral at review size, one version at a time, a few seeds */
import { XrayFloral, XF_H, XF_W } from './XrayFloral'
import { XrayFlower3D } from './XrayFlower3D'
import { FLORAL_VERSIONS, type FloralVersion } from './floralVersions'
import { FLOWERS } from './xrayMesh'

const SEEDS = [1, 2, 3, 4, 5, 6]
export function FloralTab({ v, seed, flower, scheme, setVersion, setSeed, setFlower }: { v: FloralVersion; seed: number; flower: string; scheme: string; setVersion: (n: string) => void; setSeed: (n: number) => void; setFlower: (n: string) => void }) {
  const mesh = v.kind === 'mesh'
  return (
    <div className="floral-tab">
      <div className="controls">
        <div className="row">
          <span className="k">version</span>
          {FLORAL_VERSIONS.map((x) => (
            <button key={x.name} className={x.name === v.name ? 'on' : ''} onClick={() => setVersion(x.name)}>{x.name}</button>
          ))}
        </div>
        {mesh && (
          <div className="row">
            <span className="k">flower</span>
            {FLOWERS.map((f) => (
              <button key={f.name} className={f.name === flower ? 'on' : ''} onClick={() => setFlower(f.name)}>{f.name}</button>
            ))}
          </div>
        )}
        <div className="row">
          <span className="k">seed</span>
          {SEEDS.map((s) => (
            <button key={s} className={s === seed ? 'on' : ''} onClick={() => setSeed(s)}>{s}</button>
          ))}
        </div>
      </div>
      <div className="floral-stage">
        {mesh ? <XrayFlower3D key={`${v.name}-${flower}-${seed}`} v={v} flower={flower} seed={seed} width={960} height={600} scheme={scheme} upright /> : <XrayFloral v={v} seed={seed} width={XF_W * 2} height={XF_H * 2} scheme={scheme} />}
      </div>
      {!mesh && (
        <div className="floral-stage floral-stage-site">
          <XrayFloral v={v} seed={seed} width={XF_W} height={XF_H} scheme={scheme} className="floral xray" />
        </div>
      )}
      <div className="readout">
        <span className="note">{v.note}</span>
        <span>{mesh ? `/?floral=${v.name}&flower=${flower}&seed=${seed} shows it on the site` : `at 2× above, at the site's size below · /?floral=${v.name}&seed=${seed} shows it on the site`}</span>
      </div>
    </div>
  )
}
