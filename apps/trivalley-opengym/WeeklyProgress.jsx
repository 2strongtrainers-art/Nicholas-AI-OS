import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { todayISO, fmtNum } from '../lib/format.js'
import { EXIDX } from '../lib/exercises.js'
import { weeklyProgress } from '../lib/tv-weekly-progress.js'

const date = day => new Date(day + 'T12:00:00')
const shortDate = day => date(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
export default function WeeklyProgress() {
  const S = useStore(s => s.S), nav = useNavigate(), [today, setToday] = useState(todayISO)
  useEffect(() => {
    const refresh = () => setToday(todayISO()), timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])
  const progress = weeklyProgress(S, today), gain = progress.improvement
  const trained = progress.trainedDays > 0
  return <section className="card tv-weekly-progress" data-testid="tv-progress-summary" aria-labelledby="tv-weekly-heading">
    <div className="tv-weekly-heading"><div><div className="tv-eyebrow">YOUR LAST SEVEN DAYS</div>
      <h2 id="tv-weekly-heading">{trained ? 'Every session counts' : 'Your first win starts here'}</h2></div>
      <span className="tv-weekly-range">{shortDate(progress.start)}–{shortDate(progress.end)}</span></div>
    <div className="tv-progress-grid">
      <div><strong data-testid="tv-summary-sessions">{progress.sessions}</strong><span>Completed workouts</span></div>
      <div><strong data-testid="tv-summary-sets">{progress.sets}</strong><span>Sets logged</span></div>
      <div><strong data-testid="tv-summary-days">{progress.trainedDays}</strong><span>Days trained</span></div>
    </div>
    <ol className="tv-weekly-days" aria-label="Training activity for the last seven days">
      {progress.days.map(day => <li key={day.day} className={day.full ? 'trained' : day.partial ? 'partial' : ''}
        aria-label={`${date(day.day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}: ${day.full} completed workouts, ${day.partial} partial workouts`}>
        <span aria-hidden="true">{date(day.day).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
        <b aria-hidden="true">{day.full ? '✓' : day.partial ? '◐' : '–'}</b>
        <small aria-hidden="true">{date(day.day).getDate()}</small>
      </li>)}
    </ol>
    <p className="small muted">{trained ? `${progress.sessions} completed ${progress.sessions === 1 ? 'workout' : 'workouts'}, compared with ${progress.previousSessions} in the previous seven days.` : 'Finish a workout to begin your record. Your activity will appear here.'}
      {progress.partial > 0 && ` ${progress.partial} partial ${progress.partial === 1 ? 'workout is' : 'workouts are'} shown separately; their performed sets count.`}</p>
    {gain && <p className="tv-progress-gain" data-testid="tv-weekly-improvement"><strong>A recorded improvement</strong><br />{EXIDX[gain.id]?.n || 'Exercise'}: {gain.gain} more {gain.gain === 1 ? 'rep' : 'reps'} {gain.weight > 0 ? `at ${fmtNum(gain.weight)} ${gain.unit}` : 'with bodyweight'} on {shortDate(gain.day)}.</p>}
    <div className="tv-weekly-footer"><button type="button" className="tv-text-action" onClick={() => nav('/history')}>View training history</button>
      <details><summary>How it counts</summary><p className="small muted">Seven local calendar days ending today. Only saved workout history with performed sets counts; active workouts, empty entries, duplicates and future records are excluded. Partial sessions count toward days and sets, separately from complete workouts. Rep improvements compare the same exercise, mode, load and recorded unit with the previous logged top set. This card does not measure muscle growth or calories.</p></details></div>
  </section>
}
