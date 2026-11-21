"""Add original local-only calculators without touching saved training records."""
from pathlib import Path
import shutil,sys
front=Path(sys.argv[1]).resolve();assets=Path(__file__).resolve().parent
def edit(path,old,new):
 p=front/path;s=p.read_text()
 if s.count(old)!=1:raise RuntimeError(f'{path}: expected one calculator anchor: {old[:90]}')
 p.write_text(s.replace(old,new,1))
shutil.copyfile(assets/'FitnessCalculators.jsx',front/'src/views/FitnessCalculators.jsx')
shutil.copyfile(assets/'tv-calculators.mjs',front/'src/lib/tv-calculators.js')
shutil.copyfile(assets/'calculators.css',front/'src/calculators.css')
edit('src/main.jsx',"import './coach-notes.css'","import './coach-notes.css'\nimport './calculators.css'")
edit('src/App.jsx',"import Library from './views/Library.jsx'","import Library from './views/Library.jsx'\nimport FitnessCalculators from './views/FitnessCalculators.jsx'")
edit('src/App.jsx','              <Route path="/library" element={<Library />} />','              <Route path="/library" element={<Library />} />\n              <Route path="/calculators" element={<FitnessCalculators />} />')
edit('src/components/ClientHeader.jsx','          <button type="button" onClick={()=>{close();nav(\'/settings\')}}>','          <button type="button" onClick={()=>{close();nav(\'/calculators\')}}>Fitness calculators</button>\n          <button type="button" onClick={()=>{close();nav(\'/settings\')}}>')
edit('src/views/Library.jsx','    <details className="tv-library-start">','    <button type="button" className="btn" style={{marginBottom:12,minHeight:44}} onClick={()=>nav(\'/calculators\')}>Fitness calculators · nutrition & training</button>\n    <details className="tv-library-start">')
edit('src/components/TabBar.jsx', "const on = k => cur === k ||", "const on = k => cur === k || (cur === 'calculators' && k === 'library') ||")
print('13 original calculators and 4 external resources integrated; no storage migration or server writes')
