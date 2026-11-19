#!/usr/bin/env python3
"""Add the owner-requested ready-made split after the native v5 improvements."""
from pathlib import Path
import shutil
import sys

front = Path(sys.argv[1]).resolve()
assets = Path(__file__).resolve().parent
def edit(path, old, new):
    p = front / path
    value = p.read_text()
    if value.count(old) != 1:
        raise RuntimeError(f'{path}: expected one anchor: {old[:90]}')
    p.write_text(value.replace(old, new, 1))

shutil.copyfile(assets / 'tv-programs.mjs', front / 'src/lib/tv-programs.js')
shutil.copyfile(assets / 'ReadyPrograms.jsx', front / 'src/components/ReadyPrograms.jsx')
shutil.copyfile(assets / 'ready-programs.css', front / 'src/ready-programs.css')
shutil.copyfile(assets / 'tv-range-progression.test.mjs', front / 'src/lib/tv-range-progression.test.js')
edit('src/lib/progression.js', "import { modeOf }", "import { repRangeStalls } from './tv-programs.js'\nimport { modeOf }")
edit('src/lib/progression.js', "  if (policy === 'double') {\n    const top", "  if (policy === 'double') {\n    const rangeStalls = repRangeStalls(sessions)\n    const top")
edit('src/lib/progression.js', "    if (stalls >= deloadAt) {\n      const dw = deloadTo(w, inc)\n      return { policy, kind: 'deload', weight: dw, reps: bottom, why: ['Stalled {0} sessions — deload to {1} {2}.', stalls, dw, unit] }", "    if (rangeStalls >= deloadAt) {\n      const dw = deloadTo(w, inc)\n      return { policy, kind: 'deload', weight: dw, reps: bottom, why: ['Stalled {0} sessions — deload to {1} {2}.', rangeStalls, dw, unit] }")
edit('src/main.jsx', "import './premium-training.css'", "import './premium-training.css'\nimport './ready-programs.css'")
edit('src/views/Plan.jsx', "import { useNavigate } from 'react-router-dom'", "import { useNavigate } from 'react-router-dom'\nimport ReadyPrograms from '../components/ReadyPrograms.jsx'")
edit('src/views/Plan.jsx', '    <div className="cols"><div>', '    <ReadyPrograms />\n    <div className="cols"><div>')
edit('src/views/Workout.jsx', "import { useStore }", "import { restForEntry, needsWorkingLoad } from '../lib/tv-programs.js'\nimport { useStore }")
edit('src/views/Workout.jsx', '  const toggle = (idx, i) => {', """  const toggle = (idx, i) => {
    if (!A.entries[idx].sets[i].done && needsWorkingLoad(A.entries[idx], i)) {
      useUI.getState().toast('Choose your working weight before completing this set.')
      return
    }
""")
edit('src/views/Workout.jsx', 'if (isLastExInUnit && !unitDone) startRest(S.restSec)', 'if (isLastExInUnit && !unitDone) startRest(restForEntry(e, S.restSec))')
edit('src/views/Workout.jsx', '    if (v == null) delete e.sets[i][field]; else e.sets[i][field] = v', """    if (v == null) delete e.sets[i][field]; else e.sets[i][field] = v
    if (e.target?.loadRequired && i === 0 && field === 'w' && v > 0) {
      e.sets.slice(1).forEach(set => { if (!set.done && !(set.w > 0)) set.w = v })
    }""")
edit('src/views/Workout.jsx', '    if (v == null) delete e.sets[i][field]; else e.sets[i][field] = v', '    const previous = e.sets[i][field]\n    if (v == null) delete e.sets[i][field]; else e.sets[i][field] = v')
edit('src/views/Workout.jsx', "if (!set.done && !(set.w > 0)) set.w = v", "if (!set.done && (!(set.w > 0) || set.w === previous)) set.w = v")
edit('src/sheets.jsx', 's.active = { unit: s.unit, id: uid(),', 's.active = { tvWarmup: r?.tvWarmup, tvEffort: r?.tvEffort, unit: s.unit, id: uid(),')
edit('src/views/Workout.jsx', '    <div className="wprog">', '''    {A.tvWarmup && <details className="card tv-workout-prep" data-testid="tv-workout-prep"><summary>Warm-up & session guidance</summary><p>{A.tvWarmup}</p><p>{A.tvEffort}</p></details>}
    <div className="wprog">''')
edit('src/views/Workout.jsx', '    <Media ex={ex} key={entry.id} compact={compact} minimizable />', '''    <Media ex={ex} key={entry.id} compact={compact} minimizable />
    {entry.target?.loadRequired && <div className="tv-load-note" data-testid="tv-working-load-note">Working target: {entry.target.sets} × {entry.target.repsMin}–{entry.target.reps} reps · {restForEntry(entry, S.restSec)}s rest. Choose your own working load; the initial zero is not a prescribed weight. Keep 2–3 good reps in reserve. For dumbbells, log one dumbbell’s weight consistently.</div>}''')
edit('src/components/TrainingCompanion.jsx', "  const mode = modeOf(cfg), n = sets.length", "  const mode = modeOf(cfg), n = sets.length\n  if (cfg.loadRequired && sets.every(s => !(s.w > 0))) return `${n} × ${cfg.repsMin || cfg.reps}–${cfg.reps} reps · choose a working load`")
edit('src/views/Home.jsx', '      <span className="tv-today-quiet">', '''      <button type="button" className="tv-text-action" data-testid="tv-browse-programs" onClick={() => nav('/plan')}>Browse ready-made workouts</button>
      <span className="tv-today-quiet">''')
print('Ready-made muscle split integrated; current routines, schedule conflicts and active sessions preserved')
