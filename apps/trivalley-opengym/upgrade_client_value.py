#!/usr/bin/env python3
"""Program briefs, real weekly records and a non-overlapping mobile app shell."""
from pathlib import Path
import shutil,sys
front=Path(sys.argv[1]).resolve(); assets=Path(__file__).resolve().parent
def edit(path,old,new):
 p=front/path;s=p.read_text()
 if s.count(old)!=1:raise RuntimeError(f'{path}: expected one client-value anchor: {old[:100]}')
 p.write_text(s.replace(old,new,1))
for name in ['WeeklyProgress.jsx','ProgramBrief.jsx']:
 shutil.copyfile(assets/name,front/'src/components'/name)
(front/'src/lib/tv-weekly-progress.js').write_text((assets/'tv-weekly-progress.mjs').read_text().replace(".mjs'",".js'"))
shutil.copyfile(assets/'client-value.css',front/'src/client-value.css')
edit('src/main.jsx',"import './navigation-layout.css'","import './navigation-layout.css'\nimport './client-value.css'")
print('Program briefs and real weekly progress applied on the reconciled navigation layout')
