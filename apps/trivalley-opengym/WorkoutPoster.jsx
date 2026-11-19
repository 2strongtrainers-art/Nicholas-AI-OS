import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { buildSets, modeOf } from '../lib/history.js'
import { nextPrescription, applyPrescription } from '../lib/progression.js'
import { elapsedSeconds, posterClock, posterSetLabel } from '../lib/tv-poster.js'

const timestamp = value => Number.isFinite(value) && value > 0
  ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }) : 'Not recorded'

export function SessionTiming({ workout, live = false }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!live) return undefined
    const tick = () => setNow(Date.now())
    tick()
    const interval = setInterval(tick, 1000)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(interval); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick) }
  }, [live, workout?.start])
  return <dl className="tv-session-times" aria-label="Session timing" data-testid="tv-session-times">
    <div><dt>Started</dt><dd data-testid="tv-started-at">{timestamp(workout?.start)}</dd></div>
    <div><dt>Finished</dt><dd data-testid="tv-finished-at">{live ? 'In progress' : timestamp(workout?.end)}</dd></div>
    <div><dt>Elapsed, including rests</dt><dd data-testid="tv-elapsed">{posterClock(elapsedSeconds(workout?.start, live ? null : (workout?.end ?? NaN), now))}</dd></div>
  </dl>
}

function PosterHeading({ name, preview }) {
  return <header className="tv-poster-heading">
    <div><p className="tv-eyebrow">TRIVALLEY.FIT · {preview ? 'WORKOUT PREVIEW' : 'INTERACTIVE WORKOUT'}</p>
      <h2>{name}</h2><p>Your plan. One clear view.</p></div>
    <img src="./assets/tv-coach-portrait.webp" width="68" height="68" alt="Nick Kaplan, TriValley.fit coach" />
  </header>
}

function Movement({ entry, index, unit, preview, onToggle, onTimed, onEdit, onDetails, working }) {
  const ex = exOr(entry.id), mode = modeOf({ ...(entry.target || {}), id: entry.id })
  const steps = Array.isArray(ex.st) ? ex.st.filter(Boolean) : []
  const completed = entry.sets.filter(s => s.done).length
  return <article className="tv-poster-movement" aria-labelledby={'tv-poster-ex-' + index} data-testid="tv-poster-movement">
    <div className="tv-poster-ex-heading"><span className="tv-poster-number">{String(index + 1).padStart(2, '0')}</span><div>
      <h3 id={'tv-poster-ex-' + index}>{ex.n}</h3><p>{[ex.eq, ex.tg || ex.bp].filter(Boolean).join(' · ') || 'Custom exercise'}</p>
    </div></div>
    {entry.sg && <p className="small muted">Superset group {entry.sg}: follow your plan's exercise order.</p>}
    <ul className="tv-poster-sets" aria-label={ex.n + ' sets'}>
      {entry.sets.map((set, i) => <li key={i}>
        {preview ? <span className="tv-poster-target">Set {i + 1}<strong>{posterSetLabel(mode, set, unit)}</strong></span>
          : <button type="button" aria-pressed={!!set.done} disabled={!!working}
              aria-label={`${ex.n}, set ${i + 1}: ${posterSetLabel(mode, set, unit)}. ${set.done ? 'Completed; mark incomplete' : 'Mark complete'}`}
              onClick={() => onToggle(index, i)} data-testid="tv-poster-set">
              <span>Set {i + 1}<strong>{posterSetLabel(mode, set, unit)}</strong></span><b>{set.done ? 'Done' : 'Log set'}</b>
            </button>}
        {!preview && mode === 'time' && <button type="button" className="tv-poster-hold" disabled={set.done || !!working} onClick={() => onTimed(index, i)}>Time set {i + 1}</button>}
      </li>)}
    </ul>
    {!preview && <p className="small muted">{completed}/{entry.sets.length} sets completed. Tap a set after performing it.</p>}
    <details className="tv-poster-cues"><summary>Technique instructions</summary>
      {steps.length ? <ol>{steps.map((step, i) => <li key={i}>{step}</li>)}</ol> : <p>No exercise-specific instructions are saved. Ask your coach for a demonstration.</p>}
      <p className="small muted">Written reference only; this is not a personal form assessment.</p>
    </details>
    {!preview && <div className="tv-poster-card-actions"><button type="button" onClick={() => onEdit(index)}>Edit load or reps</button><button type="button" onClick={() => onDetails(ex)}>Exercise details</button></div>}
  </article>
}

export function RoutinePosterPreview({ routine, onStart, onClose }) {
  const S = useStore(s => s.S)
  const entries = routine.ex.map(cfg => ({ id: cfg.id, sg: cfg.sg, target: cfg,
    sets: applyPrescription(buildSets(S, cfg), nextPrescription(S, cfg, routine)) }))
  return <section className="tv-workout-poster" data-testid="tv-poster-preview" aria-label="Workout poster preview">
    <button type="button" className="tv-text-action" onClick={onClose}>Back to workout choices</button>
    <PosterHeading name={routine.name} preview />
    <p className="muted">Review your planned targets before starting. The clock starts after you confirm Start. Your actual completed sets are recorded separately.</p>
    <button type="button" className="btn primary" onClick={onStart} data-testid="tv-poster-start">Start this workout</button>
    <p className="small muted">Rest setting: {S.restSec} seconds. Targets follow your current routine and progression policy.</p>
    <div className="tv-poster-grid">{entries.map((entry, i) => <Movement key={entry.id + '-' + i} entry={entry} index={i} unit={S.unit} preview />)}</div>
  </section>
}

export function ActiveWorkoutPoster({ onToggle, onTimed, onEdit, onDetails }) {
  const S = useStore(s => s.S), update = useStore(s => s.update)
  const timer = useUI(s => s.timer), working = useUI(s => s.work)
  const A = S.active
  if (!A) return null
  return <section className="tv-workout-poster" data-testid="tv-poster-active" aria-label="Interactive workout poster">
    <PosterHeading name={A.name} />
    <SessionTiming workout={A} live />
    <div className="tv-poster-rest" aria-label="Rest timer controls">
      <span>{working ? 'Timed set running' : timer ? 'Rest: ' + posterClock(timer.left) : 'Ready for your next set'}</span>
      <button type="button" disabled={!!working} onClick={() => useUI.getState().startRest(S.restSec)} data-testid="tv-poster-rest">Start {S.restSec}s rest</button>
      <span className="small muted">Rest adjustment and Skip appear in the timer bar.</span>
    </div>
    {A.entries.length ? <div className="tv-poster-grid">{A.entries.map((entry, i) => <Movement key={entry.id + '-' + i} entry={entry} index={i}
      unit={A.unit || S.unit} onToggle={onToggle} onTimed={onTimed} onEdit={onEdit} onDetails={onDetails} working={working} />)}</div>
      : <p className="muted">Add your first exercise below to build this session's poster.</p>}
    <label className="tv-poster-notes">Session notes <span className="small muted">Optional · saved on this device with this session</span>
      <textarea maxLength={300} rows={3} value={A.note || ''} placeholder="What would help you next time?"
        onChange={e => { const note = e.target.value; update(s => { if (s.active?.id === A.id) s.active.note = note.slice(0, 300) }) }} />
    </label>
  </section>
}
