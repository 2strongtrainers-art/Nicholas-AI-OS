#!/usr/bin/env python3
"""Keep logging controls before optional reference material on small touchscreens."""
from pathlib import Path
import sys
front=Path(sys.argv[1]).resolve()
def edit(path,old,new):
 p=front/path;s=p.read_text()
 if s.count(old)!=1:raise RuntimeError(f'{path}: expected one anchor: {old[:90]}')
 p.write_text(s.replace(old,new,1))
edit('src/views/Workout.jsx',"import { startFlow,", "import { bwSheet, startFlow,")
edit('src/views/Workout.jsx','    <Media ex={ex} key={entry.id} compact={compact} minimizable />', '')
# Move both the illustration and its extra load note below the editable set table.
edit('src/views/Workout.jsx', '    {entry.target?.loadRequired && <div className="tv-load-note" data-testid="tv-working-load-note">Working target: {entry.target.sets} × {entry.target.repsMin}–{entry.target.reps} reps · {restForEntry(entry, S.restSec)}s rest. Choose your own working load; the initial zero is not a prescribed weight. Keep 2–3 good reps in reserve. For dumbbells, log one dumbbell’s weight consistently.</div>}', '')
edit('src/views/Workout.jsx','    <div className="card" style={{ marginTop: 10, marginBottom: 0 }}>','    <p className="small muted">Tap a number to enter your lifting weight or reps; check a set after performing it.</p>\n    <div className="card tv-focus-set-table" style={{ marginTop: 10, marginBottom: 0 }}>')
edit('src/views/Workout.jsx', '    </div>\n  </>\n}\n\n/* ---------- active workout ---------- */', '    </div>\n    <details className="tv-focus-reference"><summary>Illustration & technique instructions</summary><Media ex={ex} key={entry.id} compact={compact} /><p className="small muted" data-testid="tv-working-load-note">Use a controlled range and choose a load that leaves 2–3 good reps in reserve. For dumbbells, log one dumbbell’s weight consistently.</p></details>\n  </>\n}\n\n/* ---------- active workout ---------- */')
edit('src/views/Workout.jsx','    <div className="tv-workout-view-switch" aria-label="Workout display">','    <div className="tv-workout-quick-actions"><button type="button" onClick={() => bwSheet()}>Log body weight</button><span>Lifting weight goes in the set fields below.</span></div>\n    <div className="tv-workout-view-switch" aria-label="Workout display">')
edit('src/views/Home.jsx','    {program ? <ProgramContinue /> : <section','    <button type="button" className="btn tv-bodyweight-shortcut" data-testid="tv-log-bodyweight" onClick={() => bwSheet()}>Log body weight</button>\n    {program ? <ProgramContinue /> : <section')
edit('src/main.jsx',"import './movement-illustrations.css'", "import './movement-illustrations.css'\nimport './iphone-workout.css'")
import shutil
shutil.copyfile(Path(__file__).parent/'iphone-workout.css',front/'src/iphone-workout.css')
print('iPhone logging improvements applied without changing stored workout schema')
