#!/usr/bin/env python3
"""Focused, reversible TriValley FIT v4 UI and data-safety edits.

Run only after patch_opengym.py and add_daily_verse.py.  The pinned upstream
OpenGym workout engine and its AGPL source notices are not replaced.
"""
from pathlib import Path
import re
import shutil
import sys

front = Path(sys.argv[1]).resolve()
assets = Path(__file__).resolve().parent
assert (front / "src/views/Home.jsx").is_file(), "Expected OpenGym frontend"

def edit(path, old, new):
    p = front / path
    content = p.read_text()
    n = content.count(old)
    if n != 1:
        raise RuntimeError(f"{path}: expected 1 anchor, got {n}: {old[:80]}")
    p.write_text(content.replace(old, new, 1))

def regex_edit(path, pattern, replacement):
    p = front / path
    content, n = re.subn(pattern, replacement, p.read_text(), count=1, flags=re.S)
    if n != 1:
        raise RuntimeError(f"{path}: missing regex anchor: {pattern[:90]}")
    p.write_text(content)

# 1. Source/license link remains directly visible and anchored to the
# exact GitHub Actions source SHA where available.
app = front / "src/App.jsx"
text = app.read_text()
topbar = re.search(r'<div className="tv-topbar">.*?</div>', text, re.S)
if not topbar:
    raise RuntimeError("Cannot find TriValley source/verse topbar")
old = topbar.group()
src_match = re.search(r'<a href="([^"]+)"[^>]*>Modified source', old)
upstream_match = re.search(r'<a href="([^"]+)"[^>]*>openGym credit', old)
if not src_match or not upstream_match:
    raise RuntimeError("AGPL/source links were moved; refuse to erase attribution")
new = f'''<header className="tv-v4-topbar">
          <span className="tv-topbar-brand"><span className="tv-knot" aria-hidden="true"><img src="./trivalley-triquetra.png" width="28" height="28" alt="" /></span>TRIVALLEY.FIT</span>
          <span className="tv-topbar-actions">
            <button type="button" className="tv-verse-trigger" data-testid="tv-daily-verse-trigger"
              onClick={{() => window.dispatchEvent(new Event('tv:verse-open'))}}>Verse</button>
            <a href="{src_match.group(1)}" target="_blank" rel="noopener noreferrer"
              aria-label="Modified OpenGym corresponding source, AGPL 3.0">Source · AGPL</a>
            <a href="{upstream_match.group(1)}" target="_blank" rel="noopener noreferrer"
              className="tv-upstream-credit">openGym</a>
          </span>
        </header>'''
app.write_text(text.replace(old, new, 1))

# 2. Replace the automatic modal/banner with a manually opened full dialog.
# The new DailyVerseCard is rendered inline on Home only.
p = front / "src/components/DailyVerse.jsx"
text = p.read_text()
text = text.replace("const [compact, setCompact] = useState(true)", "const [compact, setCompact] = useState(false)", 1)
pattern = r'  useEffect\(\(\) => \{\n    if \(!active\) return undefined\n    const showIfNewDay = \(\) => \{.*?\n  \}, \[active\]\)'
new_effect = '''  useEffect(() => {
    if (!active) return undefined
    const onManual = () => { setDate(new Date()); setCompact(false); setOpen(true) }
    const onPreference = () => { if (!isEnabled()) setOpen(false) }
    window.addEventListener('tv:verse-open', onManual)
    window.addEventListener('tv:verse-preference', onPreference)
    return () => {
      window.removeEventListener('tv:verse-open', onManual)
      window.removeEventListener('tv:verse-preference', onPreference)
    }
  }, [active])'''
text, count = re.subn(pattern, lambda _: new_effect, text, count=1, flags=re.S)
if count != 1:
    raise RuntimeError("Could not safely disable automatic scripture overlay")
p.write_text(text)
shutil.copyfile(assets / "DailyVerseCard.jsx", front / "src/components/DailyVerseCard.jsx")

# 3. Put the real workout action above the week calendar and avoid a false
# "Rest Day" for users who have not created any plan.
home = front / "src/views/Home.jsx"
text = home.read_text()
anchor = "import { useState } from 'react'"
if text.count(anchor) != 1:
    raise RuntimeError("Unexpected Home imports")
text = text.replace(anchor, anchor + "\nimport DailyVerseCard from '../components/DailyVerseCard.jsx'", 1)
header_old = """    <div className="hdr">
      <div><h1>{user ? t('Hi {0}', user.name) : 'TriValley FIT'}</h1><div className="sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
    </div>"""
header_new = """    <div className="tv-today-header">
      <div><div className="tv-eyebrow">YOUR TRAINING</div>
        <h1>{user ? t('Hi {0}', user.name) : 'Today'}</h1>
        <div className="sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      </div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
    </div>"""
if text.count(header_old) != 1:
    raise RuntimeError("Home header anchor changed")
text = text.replace(header_old, header_new, 1)
calendar = """    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}>"""
if text.count(calendar) != 1:
    raise RuntimeError("Week calendar anchor changed")
hero = """    <section className="card tv-today-hero" data-testid="tv-today-hero" aria-label="Today's workout">
      <span className="tv-today-hero-kicker">{S.active ? 'CONTINUE YOUR SESSION' : routine?.ex?.length ? 'TODAY’S PLAN' : 'READY WHEN YOU ARE'}</span>
      <h2>{S.active ? (S.active.name || 'Workout') : routine?.ex?.length ? routine.name :
        S.routines.length ? 'Choose your workout' : 'Ready to train?'}</h2>
      <p>{S.active ? 'Your logged sets are saved locally. Return to your workout where you left off.' :
        routine?.ex?.length ? 'Your next training session is ready. Follow your plan or make an adjustment.' :
        'Start a freestyle session now, or build a plan you can reuse. No account required.'}</p>
      <div className="tv-hero-metrics">
        {routine?.ex?.length > 0 && <span>{exCount(routine.ex.length)}</span>}
        <span>{S.active ? 'In progress' : S.routines.length ? 'Your schedule' : 'Free guest training'}</span>
        <span>{wThisWeek} sessions this week</span>
      </div>
      <Button className="tv-primary-action" variant="primary" icon="play" data-testid="tv-start-primary"
        onClick={() => S.active ? nav('/workout') : routine?.ex?.length ? startFlow(routine.id) : startFlow(null)}>
        {S.active ? 'Resume workout' : routine?.ex?.length ? 'Start today’s workout' : 'Start a workout now'}
      </Button>
      {!S.routines.length && !S.active && <div className="tv-hero-alternatives">
        <Button icon="plus" onClick={loadStarterPlan}>Load starter plan</Button>
        <Button icon="calendar" onClick={() => nav('/plan')}>Build my plan</Button>
      </div>}
      <span className="tv-today-quiet">Guest workouts stay on this device. Save a backup in Settings.</span>
    </section>
    <DailyVerseCard />
    <div className="card tv-week-card">
      <div className="row between" style={{ marginBottom: 8 }}>"""
text = text.replace(calendar, hero, 1)
start = text.find("    {!S.routines.length && !S.active && (")
finish = text.find("    <div className=\"card tv-coaching-card\">", start)
if start < 0 or finish < 0:
    raise RuntimeError("Old onboarding component was changed; cannot remove duplicate")
text = text[:start] + text[finish:]
text = text.replace(": t('Rest day')", ": S.routines.length ? t('Rest day') : 'Not scheduled'", 1)
home.write_text(text)

# 4. Preserve original exercise IDs while making search relevance-driven.
shutil.copyfile(assets / "tv-exercise-search.mjs", front / "src/lib/tv-exercise-search.js")
lib = front / "src/views/Library.jsx"
text = lib.read_text()
text = text.replace("import { useState } from 'react'", "import {useEffect, useRef, useState} from 'react'\nimport {sortExerciseMatches} from '../lib/tv-exercise-search.js'", 1)
text = text.replace("const [filtersOpen, setFiltersOpen] = useState(false)",
    """const [filtersOpen, setFiltersOpen] = useState(false)
  const closeFiltersRef = useRef(null)
  const openFiltersRef = useRef(null)
  const panelRef = useRef(null)
  useEffect(() => {
    if (!filtersOpen) return undefined
    const oldOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => closeFiltersRef.current?.focus())
    const onKey = ev => {
      if (ev.key === 'Escape') { ev.preventDefault(); setFiltersOpen(false); return }
      if (ev.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll('button:not([disabled]), input:not([disabled])')]
      if (!focusable.length) return
      if (ev.shiftKey && document.activeElement === focusable[0]) {
        ev.preventDefault(); focusable[focusable.length - 1].focus()
      } else if (!ev.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        ev.preventDefault(); focusable[0].focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = oldOverflow
      if (previouslyFocused?.focus) previouslyFocused.focus()
    }
  }, [filtersOpen])""", 1)
old_search = """  const searchText = query.toLowerCase().trim()
  const base = collection.filter(ex =>
    (!bodyPart || ex.bp === bodyPart) &&
    (!searchText || searchable(ex).includes(searchText))
  )
  const equipmentOptions = equipmentOf(base)
  const equipmentOn = equipmentOptions.includes(equipment) ? equipment : ''
  const matching = (equipmentOn ? base.filter(ex => ex.eq === equipmentOn) : base).slice()
  if (mode === 'recent') matching.sort((a, b) => recentRank.get(a.id) - recentRank.get(b.id))"""
new_search = """  const searchText = query.toLowerCase().trim()
  const base = collection.filter(ex => !bodyPart || ex.bp === bodyPart)
  const searched = sortExerciseMatches(base, searchText, {
    mode, recentIds, favoriteIds: favorites, planIds: [...planIds]
  })
  const equipmentOptions = equipmentOf(searched)
  const equipmentOn = equipmentOptions.includes(equipment) ? equipment : ''
  const matching = equipmentOn ? searched.filter(ex => ex.eq === equipmentOn) : searched"""
if text.count(old_search) != 1:
    raise RuntimeError("Library search computation changed")
text = text.replace(old_search, new_search, 1)
text = re.sub(r"\n  const quickParts = preferredParts\.map\([^\n]+\)\.filter\(Boolean\)", "", text, count=1)
text = re.sub(r'    <div className="tv-quick-filters".*?\n    </div>\n\n    <div className="tv-library-toolbar">', '    <div className="tv-library-toolbar">', text, count=1, flags=re.S)
text = text.replace('<h1>{t(\'Exercises\')}</h1>', '<h1>Exercise Library</h1>', 1)
text = text.replace('guided exercise references · free to explore', 'exercises · guided movement notes', 1)
text = text.replace('placeholder="Search exercises, muscles, equipment…"', 'placeholder="Search an exercise or muscle"', 1)
text = text.replace("      <button type=\"button\" className=\"tv-filter-trigger\"",
                    "      <button ref={openFiltersRef} type=\"button\" className=\"tv-filter-trigger\"", 1)
start = text.find('    {filtersOpen && <div id="tv-library-advanced"')
finish = text.find('    <div className="tv-exercise-list"', start)
if start < 0 or finish < 0:
    raise RuntimeError("Library advanced filter region changed")
sheet = """    {(bodyPart || equipmentOn) && <div className="tv-active-filters" aria-label="Active filters">
      {bodyPart && <button type="button" className="tv-active-filter" onClick={() => changePart('')}>
        {t(bodyPart)} ×</button>}
      {equipmentOn && <button type="button" className="tv-active-filter" onClick={() => setEquipment('')}>
        {t(equipmentOn)} ×</button>}
    </div>}

    {filtersOpen && <div className="tv-filter-overlay" data-testid="tv-filter-overlay">
      <button type="button" className="tv-filter-backdrop" aria-label="Close exercise filters"
        onClick={() => setFiltersOpen(false)} />
      <section className="tv-filter-sheet" id="tv-library-advanced" ref={panelRef}
        role="dialog" aria-modal="true" aria-label="Exercise filters">
        <div className="tv-sheet-heading">
          <strong>Find the right movement</strong>
          <button ref={closeFiltersRef} className="tv-sheet-close" type="button"
            data-testid="tv-filters-close" onClick={() => setFiltersOpen(false)}>Close</button>
        </div>
        <div className="tv-advanced-heading"><strong>Target muscle</strong>
          <button type="button" onClick={resetFilters}>Clear all</button></div>
        <div className="tv-advanced-chips">
          <button type="button" className={'tv-filter-chip' + (!bodyPart ? ' active' : '')}
            onClick={() => changePart('')}>All muscles</button>
          {BODYPARTS.map(part => <button type="button" key={part}
            className={'tv-filter-chip' + (bodyPart === part ? ' active' : '')}
            onClick={() => changePart(part)}>{t(part)}</button>)}
        </div>
        <div className="tv-advanced-heading"><strong>Available equipment</strong></div>
        <div className="tv-advanced-chips">
          <button type="button" className={'tv-filter-chip' + (!equipmentOn ? ' active' : '')}
            onClick={() => {setEquipment('');setShown(40)}}>Any equipment</button>
          {equipmentOptions.map(item => <button type="button" key={item}
            className={'tv-filter-chip' + (equipmentOn === item ? ' active' : '')}
            onClick={() => {setEquipment(item);setShown(40)}}>{t(item)}</button>)}
        </div>
        <button type="button" className="tv-done-filters" data-testid="tv-filters-done"
          onClick={() => setFiltersOpen(false)}>Show {matching.length} exercises</button>
      </section>
    </div>}

"""
text = text[:start] + sheet + text[finish:]
# A fixed dialog inside OpenGym's animated route container is positioned relative
# to that transformed ancestor; on the hosted phone viewport, taps hit links
# behind the sheet after the browser scrolls. Portal it to document.body.
portal_import = "import {createPortal} from 'react-dom'\n"
if "import {useEffect, useRef, useState} from 'react'\n" not in text:
    raise RuntimeError("Expected generated React imports for modal portal")
text = text.replace(
    "import {useEffect, useRef, useState} from 'react'\n",
    "import {useEffect, useRef, useState} from 'react'\n" + portal_import,
    1
)
open_modal = '    {filtersOpen && <div className="tv-filter-overlay"'
close_modal = '    </div>}\n\n    <div className="tv-exercise-list"'
if text.count(open_modal) != 1 or text.count(close_modal) != 1:
    raise RuntimeError("Refuse unanchored filter portal transformation")
text = text.replace(open_modal, '    {filtersOpen && createPortal(<div className="tv-filter-overlay"', 1)
text = text.replace(close_modal, '    </div>, document.body)}\n\n    <div className="tv-exercise-list"', 1)
lib.write_text(text)

# 5. Upgrade backup export/import without ever sending the JSON off-device.
shutil.copyfile(assets / "tv-backup.mjs", front / "src/lib/tv-backup.js")
settings = front / "src/views/Settings.jsx"
text = settings.read_text()
text = text.replace("import { useEffect, useRef, useState } from 'react'",
                    "import { useEffect, useRef, useState } from 'react'\nimport {serializeWorkoutBackup,parseWorkoutBackup} from '../lib/tv-backup.js'",1)
start = text.find("  const doExport = async () => {")
finish = text.find("  const signInHere = async () => {", start)
if start < 0 or finish < 0:
    raise RuntimeError("Settings backup tools changed")
new_backup = """  const doExport = async () => {
    try {
      const json = await serializeWorkoutBackup(S)
      const name = 'trivalley-fit-verified-backup-' + todayISO() + '.json'
      if (MOBILE) { await shareExport(json, name); toast('Backup ready to save'); return }
      const blob = new Blob([json], {type: 'application/json'})
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = name
      document.body.appendChild(a); a.click()
      setTimeout(() => {URL.revokeObjectURL(a.href);a.remove()}, 2500)
      toast('Backup exported with checksum')
    } catch (e) {toast('Backup could not be exported: ' + e.message)}
  }
  const doImport = ev => {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    if (!f) return
    if (f.size > 12 * 1024 * 1024) {toast('Backup exceeds the 12 MB safety limit');return}
    const rd = new FileReader()
    rd.onload = async () => {
      try {
        const parsed = await parseWorkoutBackup(rd.result)
        const warning = parsed.verified
          ? 'Checksum verified. Importing replaces your current workouts, plan and settings on this device.'
          : 'Legacy backup without a checksum. It passed structural validation but authenticity cannot be verified. Importing replaces all current data on this device.'
        confirmSheet({
          title: parsed.verified ? 'Import verified backup?' : 'Import legacy backup?',
          message: warning + (S.active ? ' The current active workout will also be replaced.' : ''),
          confirmText: 'Import backup', danger: true,
          onConfirm: () => {
            replaceState(Object.assign(JSON.parse(JSON.stringify(DEF)), parsed.state), true)
            toast('Workout backup restored')
          }
        })
      } catch (e) {toast('Import blocked: ' + e.message)}
    }
    rd.onerror = () => toast('Could not read this backup file')
    rd.readAsText(f)
  }
"""
text = text[:start] + new_backup + text[finish:]
text = text.replace("title={t('Import backup')}", "title=\"Import checked backup\" subtitle=\"Older openGym files are supported after validation\"", 1)
text = text.replace("title={t('Export backup (JSON)')}", "title=\"Export verified backup (JSON)\" subtitle=\"Includes workout history, routines and favorites\"", 1)
settings.write_text(text)

# 6. Make repeated Finish requests idempotent while keeping all existing stats
# and progress calculation semantics.
edit("src/sheets.jsx", "    s.workouts.push(w)\n    s.active = null",
     """    // Prevent double-logging if an iOS tap/confirmation event is delivered twice.
    if (!s.workouts.some(existing => existing.id === w.id)) s.workouts.push(w)
    s.active = null""")
# 7. Label the established navigation without changing its routes.
edit("src/components/TabBar.jsx", "label={t('Home')}", 'label="Today"')
edit("src/components/TabBar.jsx", "label={t('Plan')}", 'label="Programs"')
edit("src/components/TabBar.jsx", "label={t('Stats')}", 'label="Progress"')
edit("src/components/TabBar.jsx", "label={t('Exercises')}", 'label="Library"')
edit("src/components/TabBar.jsx", "{S.active ? t('Resume') : t('Start')}", "{S.active ? 'Resume' : 'Train'}")
edit("src/components/TabBar.jsx", '<nav id="tabbar">', '<nav id="tabbar" aria-label="Primary training navigation">')
# 8. CSS comes last; it deliberately overrides the legacy temporary v3 theme.
(front / "src/index.css").open("a").write("\n" + (assets / "v4-layout.css").read_text())
print("TriValley FIT v4 UI, offline backup validation, and deduplicated workout finish applied.")
