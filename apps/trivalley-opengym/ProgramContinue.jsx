import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { startFlow } from '../sheets.jsx'
import { MUSCLE_SPLIT, PROGRAM_COVERS, programPosition } from '../lib/tv-programs.js'
import { durationRange } from '../lib/tv-training-insights.js'

export function ProgramCover({ dayKey, title, index, hero = false }) {
  const src = PROGRAM_COVERS[dayKey]
  if (!src) return null
  return <div className={'tv-program-art' + (hero ? ' tv-program-art-hero' : '')} aria-hidden="true">
    <img className="tv-program-art-photo" src={src} alt="" width="1200" height="800"
      loading={hero ? 'eager' : 'lazy'} decoding="async" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
    <div className="tv-program-art-caption"><img src="./trivalley-triquetra.png" alt="" width="26" height="26" />
      <span>DAY {String(index + 1).padStart(2, '0')}</span><strong>{title}</strong></div>
  </div>
}

export default function ProgramContinue() {
  const S = useStore(s => s.S), nav = useNavigate(), position = programPosition(S)
  if (!position) return null
  const active = S.active
  const tag = active?.tvTemplate || S.routines.find(r => r.id === active?.routineId)?.tvTemplate
  const artKey = active ? tag?.day : position.day.key
  const artIndex = active ? MUSCLE_SPLIT.days.findIndex(day => day.key === artKey) : position.index
  const routine = active ? null : position.routine
  const estimate = routine ? durationRange(S, routine) : null
  const title = active?.name || routine?.name || 'Restore your next workout'
  const start = () => {
    const current = useStore.getState().S
    if (current.active) { nav('/workout'); return }
    const next = programPosition(current)
    if (!next?.routine) { nav('/plan'); return }
    startFlow(next.routine.id)
  }
  return <section className="card tv-continue-card" data-testid="tv-today-hero" aria-label="Continue your program">
    {artKey && <ProgramCover dayKey={artKey} title={title} index={Math.max(0, artIndex)} hero />}
    <div className="tv-eyebrow">{active ? 'YOUR SESSION IS IN PROGRESS' : position.missing ? 'PROGRAM DAY MISSING' : `UP NEXT · DAY ${position.index + 1} OF 3`}</div>
    <h2 data-testid="tv-program-next-name">{title}</h2>
    {active ? <p className="muted small">Pick up your current session. Your device status above shows whether your latest edits were saved.</p>
      : position.missing ? <p className="muted small">Add the missing {position.day.name} routine in Programs to keep your sequence intact.</p>
      : <p className="muted small">{routine.ex.length} exercises · {estimate.min}–{estimate.max} min estimated. {position.last ? 'Continues after your last finished program session.' : 'Your first program session is ready.'}</p>}
    <button type="button" className="btn primary tv-primary-action" data-testid="tv-start-primary" onClick={start}>
      {active ? 'Resume workout' : position.missing ? 'Restore program day' : 'Continue my program'}
    </button>
    <div className="tv-continue-actions">
      {!active && routine && <button type="button" className="tv-text-action" onClick={() => nav('/workout?poster=' + encodeURIComponent(routine.id))}>Preview workout</button>}
      <button type="button" className="tv-text-action" onClick={() => nav('/plan')}>Choose another day</button>
    </div>
    {!active && !position.missing && <p className="tv-continue-note">Your place is remembered across missed days. Follow your planned rest and recovery days; starting is your choice.</p>}
  </section>
}
