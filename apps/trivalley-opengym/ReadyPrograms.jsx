import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { uid, DAYN } from '../lib/format.js'
import { startFlow } from '../sheets.jsx'
import { MUSCLE_SPLIT, installedDays, addMuscleSplit } from '../lib/tv-programs.js'

export default function ReadyPrograms() {
  const S = useStore(s => s.S), update = useStore(s => s.update), nav = useNavigate()
  const toast = useUI(s => s.toast)
  const [schedule, setSchedule] = useState('none')
  const [receipt, setReceipt] = useState('')
  const days = installedDays(S), complete = days.every(Boolean)
  const add = () => {
    try {
      let result
      update(draft => { result = addMuscleSplit(draft, { makeId: uid, schedule }) })
      const saved = useStore.getState().storageStatus?.ok
      const message = `${result.added ? 'Added ' + result.added + ' ready-to-train routines.' : 'Your program is already added.'}${result.assigned.length ? ' Scheduled on ' + result.assigned.map(d => DAYN[d]).join(', ') + '.' : ''}${result.kept.length ? ' Kept existing assignments on ' + result.kept.map(d => DAYN[d]).join(', ') + '.' : ''}${saved === false ? ' Changes are only in memory: export a backup before closing.' : ''}`
      setReceipt(message); toast(message)
    } catch (error) { setReceipt(error.message) }
  }
  return <section className="card tv-ready-programs" data-testid="tv-ready-programs" aria-label="Ready-made workout programs">
    <div className="tv-eyebrow">READY-MADE PROGRAM</div>
    <h2>{MUSCLE_SPLIT.name}</h2>
    <p className="muted small">Back & Biceps → Chest & Triceps → Legs. Complete routines with rep ranges, exercise rest timers and editable progression.</p>
    <p className="small muted">{MUSCLE_SPLIT.equipment}.</p>
    <details className="tv-program-preview" data-testid="tv-program-preview">
      <summary>Preview all three workouts</summary>
      <p className="small"><strong>Warm-up:</strong> {MUSCLE_SPLIT.warmup}</p>
      {MUSCLE_SPLIT.days.map((day, index) => <article key={day.key} className="tv-program-day">
        <h3>Day {index + 1} · {day.name}</h3>
        {day.note && <p className="muted small">{day.note}</p>}
        <ol>{day.exercises.map(([id, name, sets, low, high, rest]) => <li key={id}>
          <strong>{name}</strong><span>{sets} × {low}–{high} reps · {rest}s rest</span>
        </li>)}</ol>
      </article>)}
      <p className="small"><strong>Choose your load:</strong> {MUSCLE_SPLIT.effort} For dumbbells, log the weight of one dumbbell consistently.</p>
      <p className="small"><strong>Progression:</strong> {MUSCLE_SPLIT.progression}</p>
      <p className="muted small">{MUSCLE_SPLIT.frequency} This is a general gym template, not an individual assessment.</p>
      <a className="small" href={MUSCLE_SPLIT.source} target="_blank" rel="noopener noreferrer">Read ACSM’s training principles</a>
    </details>
    <label className="tv-program-schedule">Choose a schedule
      <select data-testid="tv-program-schedule" value={schedule} onChange={e => setSchedule(e.target.value)}>
        <option value="none">Routines only — choose days later</option>
        <option value="mwf">Monday / Wednesday / Friday</option>
        <option value="tts">Tuesday / Thursday / Saturday</option>
      </select>
    </label>
    <p className="small muted">Adds routines alongside yours. Scheduling fills empty selected days and keeps existing assignments. Your current workout and logs stay in place.</p>
    <button type="button" className="btn primary" data-testid="tv-add-program" disabled={complete && schedule === 'none'} onClick={add}>
      {complete ? schedule === 'none' ? 'Program added' : 'Apply selected schedule' : 'Add this program'}
    </button>
    {receipt && <p className="small tv-program-receipt" role="status" data-testid="tv-program-receipt">{receipt}</p>}
    {complete && <div className="tv-program-launchers" data-testid="tv-program-launchers">
      {S.active && <p className="small">A workout is in progress. <button type="button" className="tv-text-action" onClick={() => nav('/workout')}>Resume current workout</button></p>}
      {days.map((routine, index) => <div key={routine.id} className="tv-program-launcher">
        <span><strong>Day {index + 1} · {routine.name}</strong><span className="small muted">{routine.ex.length} exercises</span></span>
        <div><button type="button" className="btn" onClick={() => nav('/plan/r/' + routine.id)}>Edit</button>
          <button type="button" className="btn primary" data-testid={'tv-start-program-' + index} disabled={!!S.active} onClick={() => {
            if (useStore.getState().S.active) { nav('/workout'); return }
            startFlow(routine.id)
          }}>Start</button></div>
      </div>)}
    </div>}
  </section>
}
