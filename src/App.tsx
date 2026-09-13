import { lazy, Suspense, useEffect } from 'react'
import { Site } from './Site'
import { THEME } from './theme'

// the icon lab is dev only: `?tab=icons`, never in the build
const IconLab = import.meta.env.DEV ? lazy(() => import('./IconLab').then((m) => ({ default: m.IconLab }))) : null

export default function App() {
  // the theme as CSS variables
  useEffect(() => {
    const r = document.documentElement.style
    for (const [k, v] of Object.entries(THEME)) r.setProperty(`--${k}`, v)
  }, [])
  if (IconLab && new URLSearchParams(window.location.search).get('tab') === 'icons') return <Suspense fallback={null}><IconLab /></Suspense>
  return <Site />
}
