"""Explicit exercise substitutions, load conventions and user-reviewed feedback drafts."""
from pathlib import Path
import shutil,sys
front=Path(sys.argv[1]).resolve();assets=Path(__file__).resolve().parent
def edit(path,old,new):
 p=front/path;s=p.read_text()
 if s.count(old)!=1:raise RuntimeError(f'{path}: expected one workout-tools anchor: {old[:100]}')
 p.write_text(s.replace(old,new,1))
for name,target in [('WorkoutTools.jsx','src/components/WorkoutTools.jsx'),('AppFeedback.jsx','src/views/AppFeedback.jsx'),('tv-workout-tools.mjs','src/lib/tv-workout-tools.js'),('workout-tools.css','src/workout-tools.css')]:shutil.copyfile(assets/name,front/target)
edit('src/main.jsx',"import './calculators.css'","import './calculators.css'\nimport './workout-tools.css'")
edit('src/App.jsx',"import FitnessCalculators from './views/FitnessCalculators.jsx'","import FitnessCalculators from './views/FitnessCalculators.jsx'\nimport AppFeedback from './views/AppFeedback.jsx'")
edit('src/App.jsx','              <Route path="/calculators" element={<FitnessCalculators />} />','              <Route path="/calculators" element={<FitnessCalculators />} />\n              <Route path="/feedback" element={<AppFeedback />} />')
edit('src/components/ClientHeader.jsx',"          <button type=\"button\" onClick={()=>{close();nav('/calculators')}}>","          <button type=\"button\" onClick={()=>{close();nav('/feedback?screen='+encodeURIComponent(location.hash.split('?')[0].slice(1)||'/home'))}}>Report a problem or idea</button>\n          <button type=\"button\" onClick={()=>{close();nav('/calculators')}}>")
edit('src/components/WorkoutPoster.jsx',"import { restForEntry }", "import { WeightGuidance, ExerciseSwap } from './WorkoutTools.jsx'\nimport { restForEntry }")
edit('src/components/WorkoutPoster.jsx','onField, working })','onField, working, routineId, activeId })')
edit('src/components/WorkoutPoster.jsx','    {entry.sg && <p', '    <WeightGuidance ex={ex} plan={entry.plan} target={entry.target} unit={unit} />\n    {entry.sg && <p')
edit('src/components/WorkoutPoster.jsx','    <MovementIllustration ex={ex} poster />','    <ExerciseSwap entry={entry} index={index} routineId={routineId} activeId={activeId} />\n    <MovementIllustration ex={ex} poster />')
edit('src/components/WorkoutPoster.jsx',"    sets: applyPrescription(buildSets(S, cfg), nextPrescription(S, cfg, routine))", "    plan: nextPrescription(S, cfg, routine), sets: applyPrescription(buildSets(S, cfg), nextPrescription(S, cfg, routine))")
edit('src/components/WorkoutPoster.jsx','unit={S.unit} preview />','unit={S.unit} routineId={S.routines.some(r=>r.id===routine.id)?routine.id:null} preview />')
edit('src/components/WorkoutPoster.jsx','onField={onField} working={working} />','onField={onField} working={working} activeId={A.id} routineId={A.routineId} />')
edit('src/views/Workout.jsx', "import WorkoutChooser from '../components/WorkoutChooser.jsx'", "import WorkoutChooser from '../components/WorkoutChooser.jsx'\nimport { WeightGuidance, ExerciseSwap } from '../components/WorkoutTools.jsx'\nimport MovementIllustration from '../components/MovementIllustration.jsx'")
edit('src/views/Workout.jsx','    <details className="tv-focus-reference">','    <WeightGuidance ex={ex} plan={entry.plan} target={entry.target} unit={S.active?.unit||S.unit} />\n    <ExerciseSwap entry={entry} index={entryIdx} activeId={S.active.id} routineId={S.active.routineId} />\n    <MovementIllustration ex={ex} poster />\n    <details className="tv-focus-reference">')
print('Safe explicit substitutions, weight conventions, next-step guidance and private feedback drafts integrated')

edit('src/lib/history.js', "import {", "import { freshSwapLoad } from './tv-workout-tools.js'\nimport {") if False else None
p=front/'src/lib/history.js';s=p.read_text();s="import { freshSwapLoad } from './tv-workout-tools.js'\n"+s
s=s.replace('export function buildSets(S, cfg) {','export function buildSets(S, cfg) {\n  if (freshSwapLoad(S,cfg)) return Array.from({length:Math.max(1,cfg.sets||1)},()=>({w:0,r:cfg.reps||10,done:false}))',1)
p.write_text(s)

shutil.copyfile(assets/'RecordedDemo.jsx',front/'src/components/RecordedDemo.jsx')
edit('src/components/WorkoutPoster.jsx', "import CoachNotes from './CoachNotes.jsx'", "import CoachNotes from './CoachNotes.jsx'\nimport RecordedDemo from './RecordedDemo.jsx'")
edit('src/components/WorkoutPoster.jsx', '    <MovementIllustration ex={ex} poster />', '    <RecordedDemo ex={ex} />\n    <MovementIllustration ex={ex} poster />')
edit('src/components/CoachNotes.jsx', "import { coachNotesFor }", "import RecordedDemo from './RecordedDemo.jsx'\nimport { coachNotesFor }")
edit('src/components/CoachNotes.jsx','    <p className="tv-eyebrow">MY COACHING NOTES</p>','    <p className="tv-eyebrow">MY COACHING NOTES</p>\n    <RecordedDemo ex={ex} />')
