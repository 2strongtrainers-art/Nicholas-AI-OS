"""Exact-ID coaching notes and honest catalogue coverage; no saved-state migration."""
from pathlib import Path
import shutil, sys
front = Path(sys.argv[1]).resolve(); assets = Path(__file__).resolve().parent

def edit(path, old, new):
    p = front / path; s = p.read_text()
    if s.count(old) != 1: raise RuntimeError(f'{path}: expected one coaching anchor: {old[:80]}')
    p.write_text(s.replace(old, new, 1))

shutil.copyfile(assets / 'CoachNotes.jsx', front / 'src/components/CoachNotes.jsx')
shutil.copyfile(assets / 'tv-coach-notes.mjs', front / 'src/lib/tv-coach-notes.js')
shutil.copyfile(assets / 'coach-notes.css', front / 'src/coach-notes.css')
edit('src/main.jsx', "import './client-value.css'", "import './client-value.css'\nimport './coach-notes.css'")
edit('src/lib/exercises.js', "import { EXDB }", "import { normalizeExerciseNames } from './tv-coach-notes.js'\nimport { EXDB }")
edit('src/lib/exercises.js', 'export const EXIDX = {}', 'normalizeExerciseNames(EXDB)\nexport const EXIDX = {}')
edit('src/components/Media.jsx', "import Icon from './Icon.jsx'", "import Icon from './Icon.jsx'\nimport CoachNotes from './CoachNotes.jsx'")
edit('src/components/Media.jsx', '{instructions && <ol className="tv-steps">{movementReferenceFor(ex).steps.map((step,i) => <li key={i}>{step}</li>)}</ol>}', '{instructions && <CoachNotes ex={ex} />}')
edit('src/sheets.jsx', "import { useEffect, useRef, useState", "import { coachNotesFor } from './lib/tv-coach-notes.js'\nimport CoachNotes from './components/CoachNotes.jsx'\nimport { useEffect, useRef, useState")
edit('src/sheets.jsx', "    {instrFor(ex).length > 0 &&<>", "    {coachNotesFor(ex) && <CoachNotes ex={ex} />}\n    {!coachNotesFor(ex) && instrFor(ex).length > 0 &&<>")
edit('src/components/WorkoutPoster.jsx', "import MovementIllustration from './MovementIllustration.jsx'", "import MovementIllustration from './MovementIllustration.jsx'\nimport CoachNotes from './CoachNotes.jsx'\nimport { coachNotesFor } from '../lib/tv-coach-notes.js'")
edit('src/components/WorkoutPoster.jsx', '{steps.length ? <ol>{steps.map((step, i) => <li key={i}>{step}</li>)}</ol> :', '{coachNotesFor(ex) ? <CoachNotes ex={ex} /> : steps.length ? <ol>{steps.map((step, i) => <li key={i}>{step}</li>)}</ol> :')
edit('src/views/Library.jsx', "import {useEffect, useRef, useState}", "import { ESSENTIAL_IDS } from '../lib/tv-coach-notes.js'\nimport {useEffect, useRef, useState}")
edit('src/views/Library.jsx', '    all: fullLibrary.length,', "    all: fullLibrary.length,\n    essentials: fullLibrary.filter(ex => ESSENTIAL_IDS.includes(ex.id)).length,")
edit('src/views/Library.jsx', "    mode === 'all' ||", "    mode === 'all' || (mode === 'essentials' && ESSENTIAL_IDS.includes(ex.id)) ||")
edit('src/views/Library.jsx', "['all', 'Explore'], ['favorites', 'Saved']", "['all', 'Explore'], ['essentials', 'Main 16'], ['favorites', 'Saved']")
edit('src/views/Library.jsx', '    <div className="tv-library-search">', '''    <section className="tv-library-start" aria-label="Where to start">
      <strong>Not sure where to start?</strong>
      <p>I’ve grouped the 16 movements from the 3-Day Muscle Split so you can learn one at a time. Each has an illustration and my setup, movement and easier-option notes.</p>
      <button type="button" className="btn" onClick={() => changeMode('essentials')}>Show the main 16 movements</button>
      <p className="small muted">The full catalogue contains 1,324 written exercise references. Only these 16 have generated likeness illustrations; they are not recorded demonstrations.</p>
    </section>
    <div className="tv-library-search">''')
# Clarify this schedule's limitation without silently replacing anyone's chosen plan.
edit('src/components/ProgramBrief.jsx', 'A repeatable gym plan with a clear next step', 'Here’s how I want you to use this plan')
edit('src/components/ProgramBrief.jsx', 'Build strength and muscle through consistent, recorded training.', 'I want you to build consistency, record your work and progress with control.')
edit('src/components/ProgramBrief.jsx', '<h4>Make it your own</h4>', '<p className="small muted">At three sessions per week, each main muscle group has one dedicated day. For general fitness, consider a plan that trains all major groups at least twice weekly; ask me to help you choose the right schedule. This split is one option, not a complete individualized prescription.</p>\n      <h4>Make it your own</h4>')
print('Coaching notes, main-16 discovery and catalogue display corrections applied; stored data unchanged')
