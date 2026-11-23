"""Curated original lessons and bodyweight posters; explicit append-only installation."""
from pathlib import Path
import shutil,sys
front=Path(sys.argv[1]).resolve();assets=Path(__file__).resolve().parent
def edit(path,old,new):
 p=front/path;s=p.read_text()
 if s.count(old)!=1:raise RuntimeError(f'{path}: expected one learning anchor: {old[:100]}')
 p.write_text(s.replace(old,new,1))
for name,target in [('Learn.jsx','src/views/Learn.jsx'),('WorkoutPosters.jsx','src/views/WorkoutPosters.jsx'),('PosterSketch.jsx','src/components/PosterSketch.jsx'),('tv-learning.mjs','src/lib/tv-learning.js'),('tv-illustrated-presets.mjs','src/lib/tv-illustrated-presets.mjs'),('tv-bodyweight-art.mjs','src/lib/tv-bodyweight-art.mjs'),('learning.css','src/learning.css')]:shutil.copyfile(assets/name,front/target)
edit('src/main.jsx',"import './first-use.css'","import './first-use.css'\nimport './learning.css'")
edit('src/App.jsx',"import StartGuide from './views/StartGuide.jsx'","import StartGuide from './views/StartGuide.jsx'\nimport Learn from './views/Learn.jsx'\nimport WorkoutPosters from './views/WorkoutPosters.jsx'")
edit('src/App.jsx','              <Route path="/start" element={<StartGuide />} />','              <Route path="/start" element={<StartGuide />} />\n              <Route path="/learn" element={<Learn />} />\n              <Route path="/learn/:slug" element={<Learn />} />\n              <Route path="/posters" element={<WorkoutPosters />} />\n              <Route path="/posters/:slug" element={<WorkoutPosters />} />')
edit('src/views/Library.jsx',"import { ESSENTIAL_IDS }","import { LibraryLearningLinks } from './Learn.jsx'\nimport { ESSENTIAL_IDS }")
edit('src/views/Library.jsx','    <button type="button" className="btn" style={{marginBottom:12,minHeight:44}}','    <LibraryLearningLinks />\n    <button type="button" className="btn" style={{marginBottom:12,minHeight:44}}')
edit('src/components/ClientHeader.jsx',"          <button type=\"button\" onClick={()=>{close();nav('/feedback?screen='","          <button type=\"button\" onClick={()=>{close();nav('/learn')}}>Learn & protein portions</button>\n          <button type=\"button\" onClick={()=>{close();nav('/posters')}}>Workout posters</button>\n          <button type=\"button\" onClick={()=>{close();nav('/feedback?screen='")
edit('src/components/TabBar.jsx',"(cur === 'calculators' && k === 'library')","(['calculators','learn','posters'].includes(cur) && k === 'library')")
edit('src/views/FitnessCalculators.jsx','    <p className="small">Rounded for display.','    <button type="button" className="tv-text-action" onClick={()=>nav(\'/learn/protein-portions\')}>Use a food label · protein portion guide</button>\n    <p className="small">Rounded for display.')
edit('src/components/WorkoutPoster.jsx',"import { WeightGuidance, ExerciseSwap }", "import PosterSketch from './PosterSketch.jsx'\nimport { WeightGuidance, ExerciseSwap }")
edit('src/components/WorkoutPoster.jsx','const ex = exOr(entry.id), mode =','const ex = entry.exercise || exOr(entry.id), mode =')
edit('src/components/WorkoutPoster.jsx',"const label = set => preview && entry.target?.repsMin", "const label = set => entry.target?.tvPoster && entry.sg && mode==='time' ? `${posterClock(set.sec)} movement · ${set.w>0?set.w+' '+unit:'no added load'}` : preview && entry.target?.repsMin")
edit('src/components/WorkoutPoster.jsx','    {entry.target?.restSec != null &&','    {preview && <PosterSketch ex={ex} />}\n    {ex.tvPosterVersion===1 && ex.easier && <p className="tv-poster-easier"><strong>Easier option: </strong>{ex.easier}</p>}\n    {entry.target?.restSec != null &&')
edit('src/components/WorkoutPoster.jsx',"    {entry.sg && <p className=\"small muted\">Superset group {entry.sg}: follow your plan's exercise order.</p>}","    {entry.sg && <p className=\"small muted\">{entry.target?.tvPoster?'Circuit: use set 1 on each card for round 1, then set 2 on each card for round 2.':<>Superset group {entry.sg}: follow your plan’s exercise order.</>}</p>}")
edit('src/components/WorkoutPoster.jsx','    <ExerciseSwap entry={entry}', '    {!preview && <PosterSketch ex={ex} collapsible />}\n    <ExerciseSwap entry={entry}')
edit('src/components/WorkoutPoster.jsx','startDisabled = false })','startDisabled = false, exerciseResolver = exOr })')
edit('src/components/WorkoutPoster.jsx','const entries = routine.ex.map(cfg => ({ id: cfg.id, sg: cfg.sg, target: cfg,','const entries = routine.ex.map(cfg => ({ id: cfg.id, sg: cfg.sg, target: cfg, exercise: exerciseResolver(cfg.id) || exOr(cfg.id),')
edit('src/components/WorkoutPoster.jsx','<p>Build reps within the planned range. When every set reaches the top with controlled technique, increase the load by the smallest suitable amount.</p>',"<p>{routine.tvTemplate?.id==='trivalley-quick-posters'?'Automatic increases are off. Adjust duration, repetitions or variation deliberately, keeping controlled technique.':'Build reps within the planned range. When every set reaches the top with controlled technique, increase the load by the smallest suitable amount.'}</p>")
edit('src/components/WorkoutTools.jsx','{nextSessionMessage(plan,target,unit)}',"{target?.tvPoster?(target.loadRequired?'Choose a comfortable working load and log one dumbbell’s weight. Automatic increases are off.':'Start with bodyweight only. Adjust repetitions or seconds to your ability; stop before technique changes. Automatic increases are off.'):nextSessionMessage(plan,target,unit)}")
edit('src/views/Workout.jsx',"import WorkoutChooser from '../components/WorkoutChooser.jsx'","import WorkoutChooser from '../components/WorkoutChooser.jsx'\nimport { PosterSessionGuide } from '../components/PosterSketch.jsx'")
edit('src/views/Workout.jsx','    <div className="wprog">','    <PosterSessionGuide template={A.tvTemplate} />\n    <div className="wprog">')
edit('src/views/Workout.jsx',"if (m === 'reps' && !e.asked)","if (m === 'reps' && !e.asked && !(e.target?.tvPoster && !e.target.loadRequired && e.sets.every(s=>!(s.w>0))))")
edit('src/views/Workout.jsx',"    useUI.getState().startWork(e.sets[i].sec || 45, exOr(e.id).n, elapsed => {",'''    const seconds=Number(e.sets[i].sec)
    if(!Number.isFinite(seconds)||seconds<=0){useUI.getState().toast('Enter a duration greater than zero before starting the set.');return}
    useUI.getState().startWork(seconds, exOr(e.id).n, elapsed => {''')
edit('src/sheets.jsx','This does not mark the program day complete. Repeat the day when ready.',"{w.tvTemplate?.id==='trivalley-quick-posters'?'Only the sets you performed are recorded. Adjust the next session to your ability.':'This does not mark the program day complete. Repeat the day when ready.'}")
edit('src/components/Media.jsx',"import CoachNotes from './CoachNotes.jsx'","import CoachNotes from './CoachNotes.jsx'\nimport PosterSketch from './PosterSketch.jsx'\nimport { posterExercise } from '../lib/tv-learning.js'")
edit('src/components/Media.jsx','  if (movementReferenceFor(ex)) return', '''  if (posterExercise(ex.id) && ex.tvPosterVersion===1 && posterExercise(ex.id).n===ex.n) return <div id={id} className="exmedia tv-exercise-media">
    <PosterSketch ex={ex} />
    {instructions && <><ol className="tv-steps">{ex.st.map((step,i)=><li key={i}>{step}</li>)}</ol><p className="small">Easier option: {ex.easier}</p></>}
  </div>
  if (movementReferenceFor(ex)) return''')
edit('src/views/AppFeedback.jsx',"version:'5.15.0'","version:'5.20.1'")
print('Five original lessons, protein label arithmetic and seven explicit short-session posters integrated; existing data and navigation preserved')
