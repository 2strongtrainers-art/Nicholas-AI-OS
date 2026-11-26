import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { startFlow } from '../sheets.jsx'
import { RoutinePosterPreview } from './WorkoutPoster.jsx'

export default function WorkoutChooser() {
  const nav = useNavigate(), loc = useLocation(), S = useStore(s => s.S)
  const [posterId, setPosterId] = useState(() => new URLSearchParams(loc.search).get('poster'))
  const poster = S.routines.find(r => r.id === posterId)
  if (poster) return <div className="narrow tv-poster-page"><RoutinePosterPreview routine={poster} onClose={() => {setPosterId(null);nav('/workout')}} onStart={() => {useStore.getState().update(s => {s.tvWorkoutView='poster'});startFlow(poster.id)}} /></div>
  const today = effectiveRoutine(S, todayISO())
  return <div className="narrow" data-testid="tv-workout-choices">
    <div className="hdr"><div><h1>Start workout</h1><div className="sub">Choose a session. The clock starts after you select Start.</div></div></div>
    <button type="button" className="btn primary" onClick={() => nav('/plan')}>Browse Nick’s workouts</button>
    {S.routines.length > 0 && <section aria-label="My saved workouts"><h2>My workouts</h2>{S.routines.map(r => <article className="card" key={r.id}>
      {today?.id===r.id && <div className="tv-eyebrow">ON TODAY’S CALENDAR</div>}
      <h3>{r.name}</h3><p className="small muted">{r.ex.length} exercises</p>
      <div className="tv-program-card-buttons"><button type="button" className="btn" onClick={() => {setPosterId(r.id);document.getElementById('app')?.scrollTo(0,0)}}>Preview {r.name}</button><button type="button" className="btn primary" onClick={() => {useStore.getState().update(s => {s.tvWorkoutView='poster'});startFlow(r.id)}}>Start {r.name}</button></div>
    </article>)}</section>}
    <details className="tv-calendar-tools"><summary>Build a freestyle workout</summary><p className="small muted">Starts an empty session. Add your own exercises as you train.</p><button type="button" className="btn" onClick={() => startFlow(null)}>Freestyle workout (pick as you go)</button></details>
  </div>
}
