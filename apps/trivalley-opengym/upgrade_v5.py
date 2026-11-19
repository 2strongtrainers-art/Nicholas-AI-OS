#!/usr/bin/env python3
"""Native workout guidance, measured progress, truthful device status and premium theme.

Apply once, after upgrade_v4.py, to the exact pinned upstream frontend.
"""
from pathlib import Path
import shutil
import sys

front = Path(sys.argv[1]).resolve()
assets = Path(__file__).resolve().parent

def edit(path, old, new):
    target = front / path
    text = target.read_text()
    if text.count(old) != 1:
        raise RuntimeError(f'{path}: expected one anchor: {old[:90]}')
    target.write_text(text.replace(old, new, 1))

for name in ['tv-training-insights', 'tv-device-storage']:
    shutil.copyfile(assets / (name + '.mjs'), front / 'src/lib' / (name + '.js'))
shutil.copyfile(assets / 'TrainingCompanion.jsx', front / 'src/components/TrainingCompanion.jsx')
shutil.copyfile(assets / 'premium-training.css', front / 'src/premium-training.css')
edit('src/main.jsx', "import './index.css'", "import './index.css'\nimport './premium-training.css'")
edit('src/App.jsx', "import DailyVerse from './components/DailyVerse.jsx'", "import DailyVerse from './components/DailyVerse.jsx'\nimport { DeviceStatus } from './components/TrainingCompanion.jsx'")
edit('src/App.jsx', 'function applyPrefs(theme, accent) {', "function applyPrefs(theme, accent, style) {")
edit('src/App.jsx', "  de.dataset.theme = theme === 'light' ? 'light' : 'dark'", "  de.dataset.tvStyle = style === 'classic' ? 'classic' : 'premium'\n  de.dataset.theme = theme === 'light' ? 'light' : 'dark'")
edit('src/App.jsx', 'applyPrefs(S.theme, S.accent) }, [S.theme, S.accent]', 'applyPrefs(S.theme, S.accent, S.tvVisualStyle) }, [S.theme, S.accent, S.tvVisualStyle]')
edit('src/App.jsx', '        <ErrorBoundary>', '        <DeviceStatus />\n        <ErrorBoundary>')

edit('src/store/useStore.js', "import { create } from 'zustand'", "import { create } from 'zustand'\nimport { persistDeviceState } from '../lib/tv-device-storage.js'")
edit('src/store/useStore.js', "function loadState() {\n  try {\n    const raw = localStorage.getItem(KEY)\n    if (raw) return Object.assign(clone(DEF), JSON.parse(raw))\n  } catch (e) { /* ignore */ }\n  return clone(DEF)\n}", """function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid saved state')
      return { S: Object.assign(clone(DEF), parsed), storageStatus: { ok: true, savedAt: parsed._ts || null } }
    }
    return { S: clone(DEF), storageStatus: null }
  } catch {
    return { S: clone(DEF), storageStatus: { ok: false, savedAt: null } }
  }
}""")
edit('src/store/useStore.js', '  let pushTm = null', '  const initial = loadState()\n  let pushTm = null')
edit('src/store/useStore.js', '    localStorage.setItem(KEY, JSON.stringify(S))\n    set({ S })', """    const storageStatus = persistDeviceState(localStorage, KEY, S)
    // Keep edits in memory when Safari refuses a write; expose the failure instead of
    // losing the new set or falsely reporting that it has been saved.
    set({ S, storageStatus })""")
edit('src/store/useStore.js', '    S: (() => { const s = loadState(); registerCustom(s.customEx); return s })(),', '    S: (() => { registerCustom(initial.S.customEx); return initial.S })(),\n    storageStatus: initial.storageStatus,')
edit('src/store/useStore.js', "    isGuest: () => localStorage.getItem('gym_guest') === '1',\n    setGuest(v) { if (v) localStorage.setItem('gym_guest', '1'); else localStorage.removeItem('gym_guest'); set({}) },", """    guestSession: (() => { try { return localStorage.getItem('gym_guest') === '1' } catch { return false } })(),
    isGuest: () => get().guestSession,
    setGuest(v) {
      try { if (v) localStorage.setItem('gym_guest', '1'); else localStorage.removeItem('gym_guest') }
      catch { set({ storageStatus: { ok: false, savedAt: null } }) }
      set({ guestSession: !!v })
    },""")

edit('src/views/Home.jsx', "import DailyVerseCard from '../components/DailyVerseCard.jsx'", "import DailyVerseCard from '../components/DailyVerseCard.jsx'\nimport { TrainingBrief, ProgressSummary } from '../components/TrainingCompanion.jsx'")
edit('src/views/Home.jsx', 'todayISO, isoOf, weekKey, DAYS', 'todayISO, isoOf, weekKey, DAYS, exCount')
edit('src/views/Home.jsx', '    <DailyVerseCard />', '    <TrainingBrief />\n    <ProgressSummary />\n    <DailyVerseCard />')
edit('src/views/Home.jsx', "'Your logged sets are saved locally. Return to your workout where you left off.'", "'Return to your workout where you left off. Check the device status above to confirm your latest save.'")
# Preserve Nick's already-approved, already-public portrait as a native component.
edit('src/views/Home.jsx', '    <div className="card tv-coaching-card">', '''    <div className="card tv-coaching-card">
      <img src="./assets/tv-coach-portrait.webp" width="72" height="72" alt="Nick Kaplan, your TriValley.fit coach" style={{ objectFit: 'cover', borderRadius: 14, float: 'right', margin: '0 0 12px 14px' }} />''')
edit('src/views/Stats.jsx', "import { useState", "import { ProgressSummary } from '../components/TrainingCompanion.jsx'\nimport { useState")
edit('src/views/Stats.jsx', '    <div className="tiles">', '    <ProgressSummary />\n    <div className="tiles">')

edit('src/views/Settings.jsx', "import {serializeWorkoutBackup,parseWorkoutBackup} from '../lib/tv-backup.js'", "import {serializeWorkoutBackup,parseWorkoutBackup} from '../lib/tv-backup.js'\nimport { BackupPanel, backupPrepared } from '../components/TrainingCompanion.jsx'")
edit('src/views/Settings.jsx', "if (MOBILE) { await shareExport(json, name); toast('Backup ready to save'); return }", "if (MOBILE) { await shareExport(json, name); backupPrepared(S); toast('Backup ready — confirm after saving'); return }")
edit('src/views/Settings.jsx', "      toast('Backup exported with checksum')", "      backupPrepared(S)\n      toast('Verified backup ready — save the file, then confirm below')")
edit('src/views/Settings.jsx', '    {/* ---------- general ---------- */}', '    <BackupPanel onExport={doExport} />\n\n    {/* ---------- general ---------- */}')
edit('src/views/Settings.jsx', '      <Row icon="moon"', '''      <Row icon="sparkles" iconTint="var(--acc)" title="Visual style" subtitle="Premium uses TriValley Onyx and Gold. Classic lets you choose an accent.">
        <Segmented className="seg-inline" options={[{ value: 'premium', label: 'Premium' }, { value: 'classic', label: 'Classic' }]}
          value={S.tvVisualStyle === 'classic' ? 'classic' : 'premium'} onChange={v => update(s => { s.tvVisualStyle = v })} />
      </Row>
      <Row icon="moon"''')
edit('src/views/Settings.jsx', '      <div className="lrow" style={{ flexDirection:', "      {S.tvVisualStyle === 'classic' && <div className=\"lrow\" style={{ flexDirection:")
edit('src/views/Settings.jsx', '        </div>\n      </div>\n    </Section>\n\n    {/* ---------- data:', '        </div>\n      </div>}\n    </Section>\n\n    {/* ---------- data:')

# The existing records remain unchanged. New records retain the unit actually selected
# at session start so future comparisons can reject mixed-unit history.
edit('src/sheets.jsx', 's.active = { id: uid(), d: todayISO(), start:', 's.active = { unit: s.unit, id: uid(), d: todayISO(), start:')
edit('src/sheets.jsx', 'id: A.id, d: A.d, start: A.start, end: Date.now(),', 'id: A.id, d: A.d, unit: A.unit || null, start: A.start, end: Date.now(),')
print('TriValley v5 native training improvements applied')
