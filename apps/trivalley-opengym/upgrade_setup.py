#!/usr/bin/env python3
"""Guided, reviewed program setup and installation help after the audited build."""
from pathlib import Path
import shutil,sys
front=Path(sys.argv[1]).resolve()
assets=Path(__file__).resolve().parent
def edit(path,old,new):
 p=front/path;s=p.read_text()
 if s.count(old)!=1:raise RuntimeError(f'{path}: expected one setup anchor: {old[:90]}')
 p.write_text(s.replace(old,new,1))
shutil.copyfile(assets/'GettingStarted.jsx',front/'src/components/GettingStarted.jsx')
shutil.copyfile(assets/'getting-started.css',front/'src/getting-started.css')
(front/'src/lib/tv-setup.js').write_text((assets/'tv-setup.mjs').read_text().replace(".mjs'",".js'"))
edit('src/main.jsx',"import './audit-fixes.css'","import './audit-fixes.css'\nimport './getting-started.css'")
edit('src/views/Home.jsx','import ProgramContinue',"import { GettingStarted } from '../components/GettingStarted.jsx'\nimport ProgramContinue")
edit('src/views/Home.jsx','    {program ? <ProgramContinue />','    <GettingStarted />\n    {program ? <ProgramContinue />')
edit('src/views/Settings.jsx',"import { BackupPanel, backupPrepared }", "import { AppHelp } from '../components/GettingStarted.jsx'\nimport { BackupPanel, backupPrepared }")
edit('src/views/Settings.jsx','    <BackupPanel onExport={doExport} />','    <AppHelp />\n    <BackupPanel onExport={doExport} />')
print('Guided setup and iPhone installation/backup help applied')
