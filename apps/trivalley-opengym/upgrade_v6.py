#!/usr/bin/env python3
"""Add an original interactive poster over the existing workout/state engine."""
from pathlib import Path
import shutil
import sys

front = Path(sys.argv[1]).resolve()
assets = Path(__file__).resolve().parent

def edit(path, old, new):
    target = front / path
    text = target.read_text()
    if text.count(old) != 1:
        raise RuntimeError(f'{path}: expected one anchor: {old[:90]}')
    target.write_text(text.replace(old, new, 1))

shutil.copyfile(assets / 'WorkoutPoster.jsx', front / 'src/components/WorkoutPoster.jsx')
shutil.copyfile(assets / 'tv-poster.mjs', front / 'src/lib/tv-poster.js')
shutil.copyfile(assets / 'workout-poster.css', front / 'src/workout-poster.css')
edit('src/main.jsx', "import './premium-training.css'", "import './premium-training.css'\nimport './workout-poster.css'")
edit('src/views/Workout.jsx', "import { useNavigate } from 'react-router-dom'", "import { useNavigate, useLocation } from 'react-router-dom'")
edit('src/views/Workout.jsx', "import Media from '../components/Media.jsx'", "import Media from '../components/Media.jsx'\nimport { ActiveWorkoutPoster, RoutinePosterPreview } from '../components/WorkoutPoster.jsx'")
edit('src/views/Workout.jsx', "function StartChooser() {\n  const nav = useNavigate()", "function StartChooser() {\n  const nav = useNavigate()\n  const loc = useLocation()\n  const [posterId, setPosterId] = useState(() => new URLSearchParams(loc.search).get('poster'))")
edit('src/views/Workout.jsx', '  const todayR = effectiveRoutine(S, todayISO())', '''  const poster = S.routines.find(r => r.id === posterId)
  if (poster) return <div className="narrow tv-poster-page"><RoutinePosterPreview routine={poster}
    onClose={() => setPosterId(null)} onStart={() => {
      useStore.getState().update(s => { s.tvWorkoutView = 'poster' })
      startFlow(poster.id)
    }} /></div>
  const todayR = effectiveRoutine(S, todayISO())''')
edit('src/views/Workout.jsx', '    <div style={{ height: 14 }} />', '''    {S.routines.length > 0 && <section className="card" aria-label="Workout posters"><h2>Preview a workout poster</h2>
      <p className="small muted">See all exercises and targets together before starting the clock.</p>
      {S.routines.map(r => <button type="button" className="tv-text-action" key={r.id} onClick={() => setPosterId(r.id)}>Preview {r.name}</button>)}
    </section>}
    <div style={{ height: 14 }} />''')
edit('src/views/Workout.jsx', '  const A = S.active', "  const A = S.active\n  const view = S.tvWorkoutView === 'focus' ? 'focus' : 'poster'\n  const setView = value => { update(s => { s.tvWorkoutView = value }); window.scrollTo({ top: 0 }) }")
# A poster can log any card, so rest/superset context must belong to that card.
edit('src/views/Workout.jsx', '  const toggle = (idx, i) => {\n    const m = modeAt(idx)', '  const toggle = (idx, i) => {\n    const unit = unitOf(units, idx)\n    const unitIdx = units.findIndex(u => u === unit)\n    const m = modeAt(idx)')
edit('src/views/Workout.jsx', '      if (!useStore.getState().S.active.entries[idx].sets[i].done) toggle(idx, i)', "      if (useStore.getState().S.active?.id === A.id && !useStore.getState().S.active.entries[idx]?.sets[i]?.done) toggle(idx, i)")
edit('src/views/Workout.jsx', '  return <div className="narrow">\n    <div className="hdr">\n      <button', '  return <div className={"narrow" + (view === "poster" ? " tv-poster-page" : "")}>\n    <div className="hdr">\n      <button')
edit('src/views/Workout.jsx', '    {A.entries.length ? <>', '''    <div className="tv-workout-view-switch" aria-label="Workout display">
      <button type="button" aria-pressed={view === 'poster'} onClick={() => setView('poster')}>All exercises</button>
      <button type="button" aria-pressed={view === 'focus'} onClick={() => setView('focus')}>One exercise</button>
    </div>
    {view === 'poster' ? <ActiveWorkoutPoster onToggle={toggle} onTimed={startTimed} onDetails={exerciseDetailSheet} onField={setField}
      onEdit={idx => { update(s => { s.active.cur = idx; s.tvWorkoutView = 'focus' }) }} /> : <>
    {A.entries.length ? <>''')
edit('src/views/Workout.jsx', '    <div style={{ height: 10 }} />\n    <Button onClick={() => exercisePicker', '    </>}\n    <div style={{ height: 10 }} />\n    <Button onClick={() => exercisePicker')
edit('src/sheets.jsx', "import { useEffect", "import { SessionTiming } from './components/WorkoutPoster.jsx'\nimport { useEffect") if "import { useEffect" in (front/'src/sheets.jsx').read_text() else None
# The upstream import order is stable but starts with useState on some pinned builds.
if "import { SessionTiming }" not in (front/'src/sheets.jsx').read_text():
    target = front/'src/sheets.jsx'
    target.write_text("import { SessionTiming } from './components/WorkoutPoster.jsx'\n" + target.read_text())
edit('src/sheets.jsx', '  const r = routineId ? st.routines.find(x => x.id === routineId) : null', "  if (st.active) { nav('/workout'); return }\n  const r = routineId ? st.routines.find(x => x.id === routineId) : null")
edit('src/sheets.jsx', '  if (!A) return\n  const done = setsDoneActive(A)', "  if (!A) return\n  if (useUI.getState().work) { toast('Finish or cancel your timed set first.'); return }\n  const done = setsDoneActive(A)")
edit('src/sheets.jsx', 'routineId: A.routineId, name: A.name, bw: A.bw,', "routineId: A.routineId, name: A.name, bw: A.bw,\n    ...(A.note?.trim() ? { note: A.note.trim().slice(0, 300) } : {}),")
edit('src/sheets.jsx', "  const [note, setNote] = useState('')", "  const [note, setNote] = useState(w.note || '')")
edit('src/sheets.jsx', '    {w.entries.map((e, i) => {', '    <SessionTiming workout={w} />\n    {w.note && <p style={{ whiteSpace: \'pre-wrap\' }}><strong>Session notes:</strong> {w.note}</p>}\n    {w.entries.map((e, i) => {')
edit('src/sheets.jsx', '    <h4 className="sec" style={{ textAlign: \'left\' }}>{t(\'What you just trained\')}</h4>', '    <SessionTiming workout={w} />\n    <h4 className="sec" style={{ textAlign: \'left\' }}>{t(\'What you just trained\')}</h4>')
edit('src/components/TrainingCompanion.jsx', '    <button className="tv-text-action" onClick={() => nav(\'/plan\')}>Review or adjust my plan</button>', '''    <button className="tv-text-action" onClick={() => nav('/workout?poster=' + encodeURIComponent(next.routine.id))}>Open interactive workout poster</button>
    <button className="tv-text-action" onClick={() => nav('/plan')}>Review or adjust my plan</button>''')
print('Interactive workout poster applied over the existing engine')
