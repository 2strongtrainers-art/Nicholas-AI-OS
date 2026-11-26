#!/usr/bin/env python3
"""Owner-approved covers and continuation over the existing program/workout engine."""
from pathlib import Path
import shutil
import sys

front = Path(sys.argv[1]).resolve()
assets = Path(__file__).resolve().parent
def edit(path, old, new):
    p = front / path
    content = p.read_text()
    if content.count(old) != 1:
        raise RuntimeError(f'{path}: expected one anchor: {old[:90]}')
    p.write_text(content.replace(old, new, 1))

shutil.copyfile(assets / 'ProgramContinue.jsx', front / 'src/components/ProgramContinue.jsx')
shutil.copyfile(assets / 'program-visuals.css', front / 'src/program-visuals.css')
edit('src/main.jsx', "import './ready-programs.css'", "import './ready-programs.css'\nimport './program-visuals.css'")
edit('src/views/Home.jsx', "import DailyVerseCard", "import ProgramContinue from '../components/ProgramContinue.jsx'\nimport { programPosition } from '../lib/tv-programs.js'\nimport DailyVerseCard")
edit('src/views/Home.jsx', '  const coachOn = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE })', '  const program = programPosition(S)\n  const coachOn = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE })')
edit('src/views/Home.jsx', '    <section className="card tv-today-hero"', '    {program ? <ProgramContinue /> : <section className="card tv-today-hero"')
edit('src/views/Home.jsx', '    </section>\n    <TrainingBrief />', '    </section>}\n    {(!program || program.routine) && <TrainingBrief routineOverride={program?.routine} />}')
edit('src/components/TrainingCompanion.jsx', 'export function TrainingBrief() {', 'export function TrainingBrief({ routineOverride = null }) {')
edit('src/components/TrainingCompanion.jsx', '  const next = nextSession(S, todayISO())', '  const next = routineOverride ? { routine: routineOverride, program: true, offset: 0 } : nextSession(S, todayISO())')
edit('src/components/TrainingCompanion.jsx', "{next.offset ? 'NEXT SCHEDULED SESSION' : 'YOUR SESSION GUIDE'}", "{next.program ? 'YOUR NEXT PROGRAM SESSION' : next.offset ? 'NEXT SCHEDULED SESSION' : 'YOUR SESSION GUIDE'}")
edit('src/components/TrainingCompanion.jsx', "{next.offset ? `${dateLabel(next.day)} · Today has no scheduled session.` : 'Scheduled for today.'}", "{next.program ? 'Next in your program sequence.' : next.offset ? `${dateLabel(next.day)} · Today has no scheduled session.` : 'Scheduled for today.'}")
edit('src/sheets.jsx', 's.active = { tvWarmup: r?.tvWarmup,', 's.active = { tvTemplate: r?.tvTemplate ? { ...r.tvTemplate } : null, tvWarmup: r?.tvWarmup,')
edit('src/sheets.jsx', 'id: A.id, d: A.d, unit: A.unit || null,', 'id: A.id, d: A.d, tvTemplate: A.tvTemplate || null, unit: A.unit || null,')
print('Approved program covers and persistent history-based continuation applied')
