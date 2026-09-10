/** transition tab: a plain grey Rubik's cube (no shaders) spins and flies into the camera; the next page fades in over it */
import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { TRANSITION_VERSIONS, type TransitionVersion } from './transitionVersions'

const FOV = 35
const CAM_Z = 9
const HALF = 1.5 // three cubies of 1 with gaps: the cube's half size
/** the classic three-quarter view the cube rests in */
const REST = new THREE.Euler(0.55, -0.7, 0)

function GreyCube({ group }: { group: React.RefObject<THREE.Group | null> }) {
  const cubies: [number, number, number][] = []
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) cubies.push([x, y, z])
  return (
    <group ref={group} rotation={REST}>
      {cubies.map((p) => (
        <RoundedBox key={p.join()} args={[0.94, 0.94, 0.94]} radius={0.07} smoothness={3} position={p}>
          <meshStandardMaterial color="#8d9299" roughness={0.55} metalness={0.05} />
        </RoundedBox>
      ))}
    </group>
  )
}

/** the flight: spin to face-on while flying to a distance where the face overfills the viewport */
function Flight({ v, group, playing, onDone, onProgress }: { v: TransitionVersion; group: React.RefObject<THREE.Group | null>; playing: number; onDone: () => void; onProgress: (t: number) => void }) {
  // the callbacks change every render; the timeline must not restart with them
  const cb = useRef({ onDone, onProgress })
  cb.current = { onDone, onProgress }
  useEffect(() => {
    const g = group.current
    if (!g || !playing) return
    // the face fills the viewport at this distance from the camera; overshoot flies closer
    const fill = HALF / Math.tan((FOV * Math.PI) / 360)
    const z = CAM_Z - fill / v.overshoot
    const tl = gsap.timeline({ onComplete: () => cb.current.onDone(), onUpdate: () => cb.current.onProgress(tl.progress()) })
    tl.fromTo(g.rotation, { x: REST.x, y: REST.y, z: 0 }, { x: Math.PI * 2 * v.spin[0], y: Math.PI * 2 * v.spin[1], z: 0, duration: v.duration, ease: v.spinEase }, 0)
    tl.fromTo(g.position, { z: 0 }, { z, duration: v.duration, ease: v.approachEase }, 0)
    return () => { tl.kill() }
  }, [playing, v, group])
  return null
}

export function TransitionTab({ v, setVersion }: { v: TransitionVersion; setVersion: (n: string) => void }) {
  const group = useRef<THREE.Group | null>(null)
  const [playing, setPlaying] = useState(0)
  const [page, setPage] = useState(0) // the next page's opacity
  const [done, setDone] = useState(false)
  const play = () => { setDone(false); setPage(0); setPlaying((n) => n + 1) }
  const reset = () => { setPlaying(0); setPage(0); setDone(false); if (group.current) { group.current.position.z = 0; group.current.rotation.copy(REST) } }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === ' ') { e.preventDefault(); play() } if (e.key === 'r') reset() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const onProgress = (t: number) => setPage(Math.min(1, Math.max(0, (t - v.fadeAt) / (1 - v.fadeAt))))
  const onDone = () => { setPage(1); setDone(true) }
  useEffect(() => { window.__aarTransition = { play, reset } }, [v])
  return (
    <div className="transition-tab">
      <div className="controls">
        <div className="row">
          <span className="k">version</span>
          {TRANSITION_VERSIONS.map((x) => (
            <button key={x.name} className={x.name === v.name ? 'on' : ''} onClick={() => setVersion(x.name)}>{x.name}</button>
          ))}
        </div>
        <div className="row">
          <button onClick={play}>{playing ? 'replay' : 'play'} (space)</button>
          <button onClick={reset}>reset (r)</button>
        </div>
      </div>
      <Canvas className="transition-canvas" dpr={[1, 2]} camera={{ position: [0, 0, CAM_Z], fov: FOV }} gl={{ antialias: true }}>
        <hemisphereLight args={['#e8ecf2', '#20242a', 1.1]} />
        <directionalLight position={[4, 6, 8]} intensity={1.6} />
        <directionalLight position={[-6, -2, 3]} intensity={0.4} />
        <GreyCube group={group} />
        <Flight v={v} group={group} playing={playing} onDone={onDone} onProgress={onProgress} />
      </Canvas>
      {/* the next page: a placeholder that fades in over the filled screen */}
      <div className="next-page" style={{ opacity: page, pointerEvents: done ? 'auto' : 'none' }}>
        <div className="wordmark">aarcube</div>
        <h1>next page</h1>
        <p>placeholder: whatever the cube opens onto. click to go back.</p>
        <button onClick={reset}>back</button>
      </div>
      <div className="readout">
        <span className="note">{v.note}</span>
        <span>{`spin ${v.spin[0]}×/${v.spin[1]}× · ${v.duration}s · ${v.approachEase} · fills ×${v.overshoot} · page fades from ${Math.round(v.fadeAt * 100)}% over ${v.fade}s`}</span>
      </div>
    </div>
  )
}
