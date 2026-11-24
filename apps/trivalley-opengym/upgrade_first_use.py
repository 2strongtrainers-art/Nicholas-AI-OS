"""Clear first-use route, question-led calculators and explicit device ownership."""
from pathlib import Path
import shutil,sys
front=Path(sys.argv[1]).resolve();assets=Path(__file__).resolve().parent
def edit(path,old,new):
 p=front/path;s=p.read_text()
 if s.count(old)!=1:raise RuntimeError(f'{path}: expected one first-use anchor: {old[:90]}')
 p.write_text(s.replace(old,new,1))
for name,target in [('StartGuide.jsx','src/views/StartGuide.jsx'),('CalculatorGuide.jsx','src/components/CalculatorGuide.jsx'),('first-use.css','src/first-use.css')]:shutil.copyfile(assets/name,front/target)
edit('src/main.jsx',"import './workout-tools.css'","import './workout-tools.css'\nimport './first-use.css'")
edit('src/App.jsx',"import AppFeedback from './views/AppFeedback.jsx'","import AppFeedback from './views/AppFeedback.jsx'\nimport StartGuide from './views/StartGuide.jsx'")
edit('src/App.jsx','              <Route path="/feedback" element={<AppFeedback />} />','              <Route path="/feedback" element={<AppFeedback />} />\n              <Route path="/start" element={<StartGuide />} />')
edit('src/components/ClientHeader.jsx',"          <button type=\"button\" onClick={()=>{close();nav('/feedback?screen='", "          <button type=\"button\" onClick={()=>{close();nav('/start')}}>Start here & app help</button>\n          <button type=\"button\" onClick={()=>{close();nav('/feedback?screen='")
edit('src/components/GettingStarted.jsx','return <section className="card tv-get-started" data-testid="tv-get-started" aria-label="Getting started">','return <details className="card tv-get-started tv-first-steps" data-testid="tv-get-started"><summary>First workout, step by step</summary>')
edit('src/components/GettingStarted.jsx','<div className="tv-eyebrow">START HERE</div><h2>A clear plan for your week</h2>','<h2>Here’s your first step</h2>')
edit('src/components/GettingStarted.jsx','className="btn primary" onClick={() => nav(\'/plan?setup=1\')}>Set up my training','className="tv-text-action" onClick={() => nav(\'/plan?setup=1\')}>Set up my training')
edit('src/components/GettingStarted.jsx','Reopen setup from Programs.</p>\n  </section>','Reopen setup from Programs.</p>\n    <button className="tv-text-action" onClick={()=>nav(\'/start\')}>Read my first-workout guide</button>\n  </details>')
edit('src/components/GettingStarted.jsx','Your workouts stay in this browser on this device. Before','Your workouts stay in this browser on this device. I do not automatically receive or monitor your logs. There is no account-based cloud sync or automatic server backup. Before')
edit('src/views/Plan.jsx','    <ReadyPrograms />','    <details className="tv-first-steps"><summary>New here? Start with my first-workout guide</summary><p>I’ll explain how to choose a workout, record a set and keep your records safe.</p><button className="btn tv-start-link" onClick={()=>nav(\'/start\')}>Open my first-workout guide</button></details>\n    <ReadyPrograms />')
edit('src/views/Library.jsx',"const [mode, setMode] = useState('all')","const [mode, setMode] = useState('essentials')")
edit('src/views/Library.jsx','onChange={event => { setQuery(event.target.value); setShown(40) }}','onChange={event => { setQuery(event.target.value); if(event.target.value.trim())setMode(\'all\'); setShown(40) }}')
edit('src/views/Library.jsx','    <div className="tv-library-search">','    <p className="tv-library-recommended">Start with the Main 16 from my included plan. Choose Explore or type a search to use the full catalogue. Nick likeness illustrations are available for 688 exercises; the remaining entries have written references.</p>\n    <div className="tv-library-search">')
edit('src/views/FitnessCalculators.jsx',"import { useNavigate }", "import CalculatorGuide, { CALCULATOR_QUESTIONS } from '../components/CalculatorGuide.jsx'\nimport { useNavigate }")
edit('src/views/FitnessCalculators.jsx','Choose your calculator<select aria-label="Choose your calculator"','What would you like to work out?<select aria-label="What would you like to work out?"')
edit('src/views/FitnessCalculators.jsx','value={item.id}>{item.name}</option>','value={item.id}>{CALCULATOR_QUESTIONS[item.id]||item.name}</option>')
edit('src/views/FitnessCalculators.jsx','    <p className="small">Rounded for display.','    <CalculatorGuide key={selected} result={result} onChoose={select} />\n    <p className="small">Rounded for display.')
edit('src/views/AppFeedback.jsx',"version:'5.14.0'","version:'5.15.0'")
print('First-use guide, question-led calculators, result interpretation and Main 16 default applied; training storage unchanged')
