import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { uid } from '../lib/format.js'
import { startFlow, confirmSheet } from '../sheets.jsx'
import { MUSCLE_SPLIT, installedDays, addMuscleSplit, programPosition, programPreviewRoutine, isEmptyFreestyle, closeEmptyFreestyle } from '../lib/tv-programs.js'
import { ProgramCover } from './ProgramContinue.jsx'
import { RoutinePosterPreview } from './WorkoutPoster.jsx'
import { ProgramSetup } from './GettingStarted.jsx'

function CurrentSessionNotice() {
  const active = useStore(s => s.S.active), update = useStore(s => s.update), nav = useNavigate()
  if (!active) return null
  const empty = isEmptyFreestyle(active)
  const closeEmpty = () => confirmSheet({
    title: 'Close empty Freestyle session?',
    message: 'This session has no exercises or notes. Close it without adding an empty workout to your history, then choose Start on the workout you want.',
    confirmText: 'Close empty session',
    onConfirm: () => {
      let closed = false
      update(s => { closed = closeEmptyFreestyle(s, active.id) })
      if (closed) { useUI.getState().stopRest(); useUI.getState().stopWork() }
      else useUI.getState().toast('Your session changed. Resume it to review your work.')
    }
  })
  return <aside className="tv-current-session" data-testid="tv-current-session">
    <strong>{empty ? 'An empty Freestyle session is still open' : 'A workout is in progress'}</strong>
    <p>{empty ? 'It is blocking new workouts. Close the empty session below, then start your selected day.' : 'You can view every workout now. Resume and finish your current session before starting another.'}</p>
    {empty && <button type="button" className="btn" data-testid="tv-close-empty-session" onClick={closeEmpty}>Close empty Freestyle session</button>}
    <button type="button" className="tv-text-action" onClick={() => nav('/workout')}>Resume current workout</button>
  </aside>
}

export default function ReadyPrograms() {
  const S = useStore(s => s.S), update = useStore(s => s.update), nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const preview = programPreviewRoutine(S, params.get('day'))
  const days = installedDays(S), complete = days.every(Boolean), position = programPosition(S)
  const beginDay = key => {
    if (useStore.getState().S.active) return
    update(draft => { addMuscleSplit(draft, { makeId: uid }); draft.tvWorkoutView = 'poster' })
    const routine = programPreviewRoutine(useStore.getState().S, key)
    if (routine) startFlow(routine.id)
  }
  if (preview) return <section className="tv-program-detail" data-testid="tv-program-detail">
    <CurrentSessionNotice />
    <RoutinePosterPreview routine={preview} startDisabled={!!S.active}
      onClose={() => { const next = new URLSearchParams(params); next.delete('day'); setParams(next); document.getElementById('app')?.scrollTo(0, 0) }}
      onStart={() => beginDay(params.get('day'))} />
  </section>
  if (params.get('setup') === '1') return <section className="card tv-ready-programs tv-setting-up" data-testid="tv-ready-programs" aria-label="Set up training days">
    <h2>Training days</h2>
    <ProgramSetup onClose={() => {const next=new URLSearchParams(params);next.delete('setup');setParams(next)}} />
  </section>
  return <section className="card tv-ready-programs" data-testid="tv-ready-programs" aria-label="Ready-made workout programs">
    <div className="tv-eyebrow">TRAIN WITH NICK</div>
    <h2>{MUSCLE_SPLIT.name}</h2>
    <p className="muted small">Choose a workout below. Set up training days when you want to plan your week.</p>
    <button type="button" className="btn" data-testid="tv-open-setup" onClick={() => setParams({setup:'1'})}>{S.tvSetupDone ? 'Change training days' : 'Set up training days'}</button>
    {complete && <span className="tv-program-status" role="status">Your three workouts are ready.</span>}
    <CurrentSessionNotice />
    <div className="tv-program-covers" data-testid="tv-program-launchers">
      {MUSCLE_SPLIT.days.map((day, index) => {
        const routine = programPreviewRoutine(S, day.key)
        return <article key={day.key} className="tv-program-cover-card" data-testid="tv-program-cover-card">
          <ProgramCover dayKey={day.key} title={day.name} index={index} />
          <div className="tv-program-card-body">
            <div className="tv-program-card-kicker">DAY {index + 1}{routine && position?.routine?.id === routine.id && !S.active && <span>UP NEXT</span>}</div>
            <h3>{routine?.name || day.name}</h3>
            <p className="small muted">{routine?.ex.length ?? day.exercises.length} exercises{day.note ? ' · ' + day.note : ''}</p>
            <div className="tv-program-card-buttons">
              <button type="button" className="btn primary" data-testid={'tv-start-program-' + index} aria-label={'Start ' + (routine?.name || day.name)} disabled={!!S.active} onClick={() => beginDay(day.key)}>Start</button>
              <button type="button" className="btn" aria-label={'View ' + day.name + ' workout'} data-testid={'tv-preview-program-' + index} onClick={() => { setParams({ day: day.key }); document.getElementById('app')?.scrollTo(0, 0) }}>View workout</button>
              {days[index] && <button type="button" className="tv-text-action" aria-label={'Edit ' + routine.name} onClick={() => nav('/plan/r/' + routine.id)}>Edit</button>}
            </div>
          </div>
        </article>
      })}
    </div>
    <details className="tv-program-preview" data-testid="tv-program-preview">
      <summary>View all exercises and training guidance</summary>
      <p className="small muted">{MUSCLE_SPLIT.equipment}.</p>
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
  </section>
}

