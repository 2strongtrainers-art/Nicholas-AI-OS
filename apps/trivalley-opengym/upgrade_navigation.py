#!/usr/bin/env python3
"""One reviewed setup path and a physically separate navigation/timer dock."""
from pathlib import Path
import shutil,sys
front=Path(sys.argv[1]).resolve();assets=Path(__file__).resolve().parent
def edit(path,old,new):
 p=front/path;s=p.read_text()
 if s.count(old)!=1:raise RuntimeError(f'{path}: expected one navigation anchor: {old[:90]}')
 p.write_text(s.replace(old,new,1))
for source,target in [('TrainingDock.jsx','src/components/TrainingDock.jsx'),('tv-navigation.mjs','src/lib/tv-navigation.js'),('navigation-layout.css','src/navigation-layout.css')]:shutil.copyfile(assets/source,front/target)
edit('src/main.jsx',"import './client-interface.css'","import './client-interface.css'\nimport './navigation-layout.css'")
edit('src/App.jsx',"import TabBar from './components/TabBar.jsx'","import TrainingDock from './components/TrainingDock.jsx'")
edit('src/App.jsx',"import RestTimer from './components/RestTimer.jsx'",'')
edit('src/App.jsx',"      <TabBar onStart={startFlow} />\n      <RestTimer />","      <TrainingDock onStart={startFlow} />")
edit('src/App.jsx',"window.scrollTo(0, 0)","document.getElementById('app')?.scrollTo(0, 0)")
edit('src/App.jsx', '[loc.pathname])', '[loc.pathname, loc.search])')
shutil.copyfile(assets/'TrainingTabBar.jsx', front/'src/components/TabBar.jsx')
edit('src/views/Plan.jsx',"import { useNavigate }", "import { useNavigate, useSearchParams }")
edit('src/views/Plan.jsx','  const nav = useNavigate()',"  const nav = useNavigate()\n  const [params] = useSearchParams()\n  const focused = params.has('day') || params.get('setup') === '1'")
edit('src/views/Plan.jsx','    <div className="cols"><div>','    {!focused && <details className="tv-calendar-tools"><summary>Calendar & my routines</summary><div className="cols"><div>')
edit('src/views/Plan.jsx','    </div></div>','    </div></div></details>}')
edit('src/views/Home.jsx', ": startFlow(null)}", ": nav('/plan')}")
edit('src/views/Home.jsx', ": 'Start a workout now'}", ": 'Choose a workout'}")
edit('src/views/Home.jsx', 'Start a freestyle session now, or build a plan you can reuse. No account required.', 'Choose a ready-made workout or build your own plan. No account required.')
edit('src/views/Home.jsx', '      <button type="button" className="tv-text-action" data-testid="tv-browse-programs" onClick={() => nav(\'/plan\')}>Browse ready-made workouts</button>', '')
edit('src/views/Home.jsx', 'Return to your workout where you left off. Check the device status above to confirm your latest save.', 'Resume the session you already started. Your workout stays on this device.')
print('Unified setup and reserved content/navigation layout applied')

shutil.copyfile(assets/'WorkoutChooser.jsx', front/'src/components/WorkoutChooser.jsx')
edit('src/views/Workout.jsx', "import { bwSheet, startFlow,", "import WorkoutChooser from '../components/WorkoutChooser.jsx'\nimport { bwSheet, startFlow,")
p=front/'src/views/Workout.jsx';s=p.read_text()
a=s.index('function StartChooser() {');b=s.index('/* ---------- elapsed clock',a)
p.write_text(s[:a]+"function StartChooser() { return <WorkoutChooser /> }\n\n"+s[b:])
