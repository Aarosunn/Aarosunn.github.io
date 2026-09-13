/**
 * The icon lab (dev only, `?tab=icons`): the GitHub and LinkedIn marks in the cube's material, one row per version,
 * to iterate on before one goes on the site. Additive: never edit a version, append.
 */
import { useState } from 'react'
import { GITHUB, LINKEDIN, LiquidIcon, SITE_ICON, type IconLook } from './LiquidIcon'

const base = { scale: SITE_ICON.scale, speed: SITE_ICON.speed, hoverSpeed: SITE_ICON.hoverSpeed, soften: 0 }
export const ICON_LOOKS: IconLook[] = [
  { ...base, name: 'v1 pillow', field: 'pillow', ascii: false, note: 'the cube\'s chrome pillow over the mark: the Poisson field high at the edge, deep in the middle' },
  { ...base, name: 'v2 flat', field: 'flat', ascii: false, note: 'no field: paper\'s stripes alone inside the silhouette' },
  { ...base, name: 'v3 pillow ascii', field: 'pillow', ascii: true, note: 'v1 with the ascii trail off the silhouette, as on the cube' },
  { ...base, name: 'v4 soft pillow', field: 'pillow', ascii: false, soften: 3, note: 'v1 with the silhouette\'s edge softened three texels, so the pillow rounds off' },
]

export function IconLab() {
  const [px, setPx] = useState(96)
  return (
    <div className="lab">
      <header className="lab-head">
        <div className="wordmark">aarcube</div>
        <span className="lab-k">icon lab · dev only</span>
        <span className="lab-k">size</span>
        {[48, 72, 96, 160].map((n) => <button key={n} className={n === px ? 'on' : ''} onClick={() => setPx(n)}>{n}</button>)}
      </header>
      {ICON_LOOKS.map((look) => (
        <section key={look.name} className="lab-row">
          <div className="lab-meta">
            <h2>{look.name}</h2>
            <p>{look.note}</p>
          </div>
          <div className="lab-icons">
            <LiquidIcon path={GITHUB.path} box={GITHUB.box} href="https://github.com/Aarosunn" label="GitHub" look={look} px={px} />
            <LiquidIcon path={LINKEDIN.path} box={LINKEDIN.box} fit={LINKEDIN.fit} href="https://linkedin.com/in/aasunn" label="LinkedIn" look={look} px={px} />
          </div>
        </section>
      ))}
    </div>
  )
}
