import { coachNotesFor } from '../lib/tv-coach-notes.js'

export default function CoachNotes({ ex }) {
  const notes = coachNotesFor(ex)
  if (!notes) return null
  return <section className="tv-coach-notes" data-testid="tv-coach-notes" aria-label={ex.n + ' coaching notes'}>
    <p className="tv-eyebrow">MY COACHING NOTES</p>
    <dl>{['Setup', 'Do this', 'Avoid', 'Make it easier'].map((label, index) => <div key={label}><dt>{label}</dt><dd>{notes[index]}</dd></div>)}</dl>
    <p className="small muted">I want you moving with control. Stop if a movement hurts; ask me for help before continuing. These notes are general guidance, not live form feedback.</p>
  </section>
}
