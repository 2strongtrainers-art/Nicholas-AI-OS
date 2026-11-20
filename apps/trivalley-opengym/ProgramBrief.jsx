import { MUSCLE_SPLIT, templateRoutine } from '../lib/tv-programs.js'
import { durationRange } from '../lib/tv-training-insights.js'
import { useStore } from '../store/useStore.js'

export function ProgramBrief() {
  return <details className="tv-program-brief" data-testid="tv-program-brief">
    <summary>Who this plan is for & how it works</summary>
    <div className="tv-brief-content"><h3>A repeatable gym plan with a clear next step</h3>
      <dl><div><dt>Goal</dt><dd>Build strength and muscle through consistent, recorded training.</dd></div>
        <div><dt>Best fit</dt><dd>Adults comfortable with basic gym movements who want three organized sessions.</dd></div>
        <div><dt>Equipment</dt><dd>{MUSCLE_SPLIT.equipment}.</dd></div>
        <div><dt>Format</dt><dd>Back & Biceps, Chest & Triceps, then Legs. Choose three training days or a flexible schedule.</dd></div></dl>
      <h4>How to make progress</h4><p>{MUSCLE_SPLIT.progression}</p>
      <p className="small muted">This is a reusable template, with no fixed course end date. Your calendar controls training days; the program remembers the next session in sequence. The brief describes the original plan; your edited routines can differ.</p>
      <h4>Make it your own</h4><p>{MUSCLE_SPLIT.effort} {MUSCLE_SPLIT.frequency}</p>
    </div>
  </details>
}
export function SessionBrief({ dayKey, routine }) {
  const S = useStore(s => s.S), day = MUSCLE_SPLIT.days.find(day => day.key === dayKey)
  if (!day) return null
  const estimate = durationRange(S, routine || templateRoutine(day))
  return <aside className="tv-session-program-brief" data-testid="tv-session-program-brief" aria-label={day.name + ' program brief'}>
    <span className="tv-eyebrow">YOUR SESSION BRIEF</span><p><strong>{day.focus}</strong> {day.brief}</p>
    <dl><div><dt>Plan</dt><dd>{routine?.ex.length || day.exercises.length} exercises · {estimate.min}–{estimate.max} min estimated</dd></div>
      <div><dt>Bring</dt><dd>{day.equipment}</dd></div></dl>
    <p className="small muted">Allow extra time to learn a movement or wait for equipment. Warm-up guidance and rep targets follow below.</p>
  </aside>
}
