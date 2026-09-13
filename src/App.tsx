import { useEffect } from 'react'
import { Site } from './Site'
import { THEME } from './theme'

export default function App() {
  // the theme as CSS variables
  useEffect(() => {
    const r = document.documentElement.style
    for (const [k, v] of Object.entries(THEME)) r.setProperty(`--${k}`, v)
  }, [])
  return <Site />
}
