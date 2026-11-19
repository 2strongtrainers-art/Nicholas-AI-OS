#!/usr/bin/env python3
"""First-user audit fixes, applied after all existing original-source patches."""
from pathlib import Path
import shutil, sys
front=Path(sys.argv[1]).resolve()
assets=Path(__file__).resolve().parent
def edit(path, old, new):
 p=front/path;s=p.read_text()
 if s.count(old)!=1:raise RuntimeError(f'{path}: expected one anchor: {old[:100]}')
 p.write_text(s.replace(old,new,1))
for source,target in [('tv-audit-safety.mjs','src/lib/tv-audit-safety.js'),('audit-fixes.css','src/audit-fixes.css'),('AuditModals.jsx','src/components/Modals.jsx')]:shutil.copyfile(assets/source,front/target)
edit('src/main.jsx',"import './iphone-workout.css'","import './iphone-workout.css'\nimport './audit-fixes.css'")

# Units remain selectable until real numerical weight data exists. Never relabel history.
edit('src/views/Settings.jsx',"import { Section,", "import { hasWeightData } from '../lib/tv-audit-safety.js'\nimport { Section,")
edit('src/views/Settings.jsx',"footer={t('Note: switching units only changes the label — logged numbers are not converted.')}","footer={hasWeightData(S) ? 'Weight unit is locked to protect your saved numbers. Restoring a backup keeps the unit saved in that backup.' : 'Choose your weight unit before entering weights.'}")
edit('src/views/Settings.jsx',"options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}\n          value={S.unit} onChange={v => update(s => { s.unit = v })}","options={['kg','lb'].map(value => ({ value, label: value, disabled: hasWeightData(S) && value !== S.unit }))}\n          value={S.unit} onChange={v => { if (!hasWeightData(useStore.getState().S)) update(s => { s.unit = v }) }}")
edit('src/components/ui.jsx',"aria-pressed={o.value === value}\n          onClick", "aria-pressed={o.value === value}\n          disabled={!!o.disabled}\n          onClick")
edit('src/components/ui.jsx',"export function Check({ checked, onChange, className = '', size })", "export function Check({ checked, onChange, className = '', size, 'aria-label': label = 'Set completed' })")
edit('src/components/ui.jsx','role="checkbox"\n      aria-checked', 'role="checkbox"\n      aria-label={label}\n      aria-checked')
edit('src/components/ui.jsx','aria-label="Decrease"','aria-label={\'Decrease \' + (label || \'value\')}')
edit('src/components/ui.jsx','aria-label="Increase"','aria-label={\'Increase \' + (label || \'value\')}')
edit('src/components/ui.jsx','<NumberField value={value} decimal={decimal} onChange={onChange} />','<NumberField aria-label={label || \'Numeric value\'} value={value} decimal={decimal} onChange={onChange} />')

# Intentional body-weight entry: no fabricated default and no forced check-in.
edit('src/sheets.jsx',"Button, Slider, Switch, Segmented, SelectRow, TextArea", "Button, Slider, Switch, Segmented, SelectRow, TextArea, NumberField")
edit('src/sheets.jsx',"useState(bw ? bw.w : 70)","useState(null)")
edit('src/sheets.jsx',"\n    if (!n || n <= 0) { toast(t('Enter a valid weight')); return }", "\n    if (!Number.isFinite(n) || n <= 0 || n > wHi(unit)) { toast(t('Enter a valid weight')); return }")
edit('src/sheets.jsx',"t('Slide or tap to set your weight — tracked before every workout so your curve stays honest.')", "'Enter today’s body weight, or skip this check-in.'")
edit('src/sheets.jsx','    <WeightInput value={v} setValue={setV} unit={unit} />', '''    <label htmlFor="tv-bodyweight-value">Body weight ({unit})</label>
    <NumberField id="tv-bodyweight-value" aria-label={'Body weight in ' + unit} className="tv-bodyweight-input" nullable value={v} onChange={setV} placeholder="Enter today’s weight" />
    {bw && <p className="small muted">Previous entry: {fmtNum(bw.w)} {unit} on {fmtDate(bw.d, true)}. Enter today’s value above.</p>}''')
edit('src/sheets.jsx','<Button variant="primary" onClick={save}>{required ?','<Button variant="primary" disabled={!Number.isFinite(v) || v <= 0 || v > wHi(unit)} onClick={save}>{required ?')
edit('src/sheets.jsx','{ locked: !!opts.required }','{ locked: false }')

# Accessible focus-mode controls, explicit finish action and partial-session reporting.
edit('src/views/Workout.jsx','aria-label="Decrease" onClick={() => bump','aria-label={`Decrease ${col.hd}, set ${i + 1}, ${ex.n}`} onClick={() => bump')
edit('src/views/Workout.jsx','aria-label="Increase" onClick={() => bump','aria-label={`Increase ${col.hd}, set ${i + 1}, ${ex.n}`} onClick={() => bump')
edit('src/views/Workout.jsx','<NumberField decimal={col.dec}', '<NumberField aria-label={`${col.hd}, set ${i + 1}, ${ex.n}`} decimal={col.dec}')
edit('src/views/Workout.jsx','<Check checked={s.done} onChange={() => onToggle(i)} />','<Check aria-label={`Set ${i + 1} completed, ${ex.n}`} checked={s.done} onChange={() => onToggle(i)} />')
edit('src/views/Workout.jsx','<button className="iconbtn" style={{ color: \'var(--acc)\' }} aria-label={t(\'Finish\')} onClick={finishWorkout}><Icon name="check" /></button>','<button className="iconbtn tv-finish-action" style={{ color: \'var(--acc)\' }} aria-label={t(\'Finish\')} onClick={finishWorkout}><Icon name="check" /><span>Finish</span></button>')
edit('src/sheets.jsx',"<h3 style={{ margin: '8px 0' }}>{t('Workout complete!')}</h3>","<h3 style={{ margin: '8px 0' }}>{w.partial ? 'Partial workout saved' : t('Workout complete!')}</h3>\n    {w.partial && <p className=\"tv-finish-note\">Saved {setsDone(w)} of {w.plannedSets} planned sets. This does not mark the program day complete. Repeat the day when ready.</p>}")
edit('src/sheets.jsx',"confirmText: t('Finish workout'), onConfirm: doFinishWorkout", "confirmText: 'Save partial workout', cancelText: 'Continue workout', onConfirm: doFinishWorkout")
edit('src/sheets.jsx','    id: A.id, d: A.d, tvTemplate:', '    partial: setsDoneActive(A) < A.entries.reduce((n,e) => n + e.sets.length, 0), plannedSets: A.entries.reduce((n,e) => n + e.sets.length, 0),\n    id: A.id, d: A.d, tvTemplate:')
edit('src/sheets.jsx','    <BodyMap load={loadOfWorkouts([w])} body={st.body} />','    <p className="small">Exercises performed: {w.entries.map(e => EXIDX[e.id]?.n || e.id).join(\', \') || \'No sets logged\'}.</p>\n    <BodyMap load={loadOfWorkouts([w])} body={st.body} />')
edit('src/sheets.jsx',"{ kind: 'center', locked: true })\n}","{ kind: 'center', locked: false })\n}")
edit('src/sheets.jsx','return <div className="item" onClick={onClick}>','return <div className="item" role="button" tabIndex={0} aria-label={`View ${w.name}, ${fmtDate(w.d, true)}`} onKeyDown={e => { if (e.key === \'Enter\' || e.key === \' \') { e.preventDefault(); onClick() } }} onClick={onClick}>')

edit('src/sheets.jsx', 'sets: e.sets, topW: e.topW || null, target:', 'sets: e.sets.filter(set => set.done), topW: e.topW || null, target:')

# Modal-only duplicated prose; Media retains full instructions in the workout reference.
edit('src/components/Media.jsx','export default function Media({ ex, id, compact, minimizable })','export default function Media({ ex, id, compact, minimizable, instructions = true })')
edit('src/components/Media.jsx','<ol className="tv-steps">{movementReferenceFor(ex).steps.map((step,i) => <li key={i}>{step}</li>)}</ol>', '{instructions && <ol className="tv-steps">{movementReferenceFor(ex).steps.map((step,i) => <li key={i}>{step}</li>)}</ol>}')
edit('src/components/Media.jsx',"(compact ? ' compact' : '')", "' tv-written-guidance' + (compact ? ' compact' : '')")
edit('src/components/Media.jsx','          <BodyCue />','')
edit('src/components/Media.jsx','TRIVALLEY.FIT · FORM REFERENCE','WRITTEN GUIDANCE · exercise-specific illustration unavailable')
edit('src/components/Media.jsx','{steps.length > 0 && <ol','{instructions && steps.length > 0 && <ol')
edit('src/sheets.jsx','onClick={close}>Close</button></div>\n    <Media ex={ex} />','onClick={close}>Close</button></div>\n    <Media ex={ex} instructions={false} />')

edit('src/components/TrainingCompanion.jsx','Older logs have no recorded unit; changing the unit setting relabels numbers without converting them.', 'Older logs have no recorded unit. Weight-unit changes are locked once you save weight data.')

# One Home program guide, consistent titles, relevant progress chart.
edit('src/views/Home.jsx','    {(!program || program.routine) && <TrainingBrief routineOverride={program?.routine} />}','    {!program && !S.active && <TrainingBrief />}')
edit('src/views/Home.jsx','<Button icon="plus" onClick={loadStarterPlan}>Load starter plan</Button>','<Button icon="calendar" onClick={() => nav(\'/plan\')}>Choose a ready-made program</Button>')
edit('src/views/Home.jsx','        <Button icon="calendar" onClick={() => nav(\'/plan\')}>Build my plan</Button>','')
edit('src/views/Home.jsx','      <img src="./assets/tv-coach-portrait.webp" width="72" height="72" alt="Nick Kaplan, your TriValley.fit coach" style={{ objectFit: \'cover\', borderRadius: 14, float: \'right\', margin: \'0 0 12px 14px\' }} />','      <img className="tv-coach-mark" src="./trivalley-triquetra.png" width="44" height="44" alt="TriValley.fit Trinity knot" />')
edit('src/views/Plan.jsx',"<h1>{t('Plan')}</h1>","<h1>Programs</h1>")
edit('src/views/Stats.jsx',"<h1>{t('Stats')}</h1>","<h1>Progress</h1>")
edit('src/views/Stats.jsx',"const curEx = exId && exHist.includes(exId) ? exId : exHist[0] || null", "const recentExercise = [...S.workouts].sort((a,b) => (b.end || b.start || 0) - (a.end || a.start || 0)).flatMap(w => w.entries).find(e => EXIDX[e.id] && e.sets?.some(s => s.done))?.id\n  const curEx = exId && exHist.includes(exId) ? exId : recentExercise || exHist[0] || null")
edit('src/lib/progression.js','Nothing logged yet — this session sets the baseline.', 'No previous session for this exercise — today sets your baseline.')
edit('src/views/Library.jsx', "import {sortExerciseMatches}", "import {suggestExerciseQuery, sortExerciseMatches}")
edit('src/views/Library.jsx','  const knownIds = new Set(fullLibrary.map(ex => ex.id))','  const knownIds = new Set(fullLibrary.map(ex => ex.id))\n  const suggestion = suggestExerciseQuery(fullLibrary, query)')
edit('src/views/Library.jsx','<strong>{mode === \'favorites\' && !query ?', '<p>{suggestion && <button type="button" className="btn" onClick={() => { setQuery(suggestion); setShown(40) }}>Did you mean “{suggestion}”?</button>}</p>\n        <strong>{mode === \'favorites\' && !query ?')
edit('src/views/Library.jsx','onClick={() => addToRoutineSheet(ex)}>Plan</Button>','aria-label={`Add ${ex.n} to a routine`} onClick={() => addToRoutineSheet(ex)}>Plan</Button>')

# Support is optional, with a separately verified one-time Stripe link. Keep upstream credit.
p=front/'src/App.jsx'
if 'tv-upstream-credit' not in p.read_text():
 candidates=[x for x in (front/'src').rglob('*.jsx') if 'className="tv-upstream-credit"' in x.read_text()]
 if len(candidates)!=1:raise RuntimeError('Expected exactly one upper-right upstream anchor')
 p=candidates[0]
s=p.read_text();import re
s,n=re.subn(r'<a href="[^"]+" target="_blank" rel="noopener noreferrer"\s+className="tv-upstream-credit">openGym</a>', '<a href="https://donate.stripe.com/bJe3cw6LUfnw8Z1biqf3a02" target="_blank" rel="noopener noreferrer" className="tv-support-link" aria-label="Donate: optional one-time support for Nick’s work, opens Stripe in a new tab">Donate</a>',s)
if n!=1:raise RuntimeError('Donation anchor mismatch')
p.write_text(s)
edit('src/views/Settings.jsx','<a href="https://github.com/DuarteSantos8/openGym" target="_blank" rel="noopener">source code</a>', '<a href="https://github.com/2strongtrainers-art/Nicholas-AI-OS/tree/feat/trivalley-opengym-free-20261116/apps/trivalley-opengym" target="_blank" rel="noopener noreferrer">Modified source · AGPL</a> · <a href="https://github.com/alexpcosta/opengym" target="_blank" rel="noopener noreferrer">openGym upstream</a>')

# Persist wall-clock rest deadline, scoped to the active workout. No history/state migration.
edit('src/store/useUI.js',"import { create }", "import { recoverRest } from '../lib/tv-audit-safety.js'\nimport { create }")
edit('src/store/useUI.js','let toastTm = null', '''const REST_KEY = 'tv_rest_timer_v1'
const persistRest = timer => { try { if (timer) localStorage.setItem(REST_KEY, JSON.stringify(timer)); else localStorage.removeItem(REST_KEY) } catch {} }
// Safari and touch browsers do not always focus a tapped button. Retain the
// actual trigger, rather than returning focus to document.body after dismissal.
let lastTrigger = null, triggerAt = 0
const rememberTrigger = e => { lastTrigger = e.target.closest?.('button,a[href],[role="button"],input,select,textarea,[tabindex]'); triggerAt = Date.now() }
document.addEventListener('pointerdown', rememberTrigger, true)
document.addEventListener('click', rememberTrigger, true)
document.addEventListener('keydown', () => { lastTrigger = null }, true)
const sheetOpener = () => lastTrigger?.isConnected && Date.now() - triggerAt < 1000 ? lastTrigger : document.activeElement
let toastTm = null''')
edit('src/store/useUI.js',"{ id, render, kind, locked }", "{ id, render, kind, locked, opener: sheetOpener() }")
edit('src/store/useUI.js','  startRest(sec) {','''  restoreRest() {
    if (get().timer) return
    let raw; try { raw = localStorage.getItem(REST_KEY) } catch { return }
    const saved = recoverRest(raw, useStore.getState().S.active?.id)
    if (saved) get().startRest(saved.left, saved)
    else persistRest(null)
  },
  startRest(sec, saved = null) {''')
edit('src/store/useUI.js','    const endsAt = Date.now() + sec * 1000\n    set({ timer: { left: sec, total: sec, endsAt } })','''    const endsAt = saved?.endsAt || Date.now() + sec * 1000
    const timer = { left: sec, total: saved?.total || sec, endsAt, sessionId: useStore.getState().S.active?.id }
    set({ timer }); persistRest(timer)''')
edit('src/store/useUI.js','    set({ timer: { ...tm, left, total: tm.total + sec, endsAt: tm.endsAt + sec * 1000 } })','    const timer = { ...tm, left, total: tm.total + sec, endsAt: tm.endsAt + sec * 1000 }\n    set({ timer }); persistRest(timer)')
edit('src/store/useUI.js','    set({ timer: null })','    set({ timer: null }); persistRest(null)')
edit('src/components/RestTimer.jsx', '  const timer = useUI(s => s.timer)', '  useEffect(() => { useUI.getState().restoreRest() }, [])\n  const timer = useUI(s => s.timer)')
edit('src/components/RestTimer.jsx','icon="minus" onClick={() => addRest(-15)}','icon="minus" aria-label="Subtract 15 seconds from rest" onClick={() => addRest(-15)}')
edit('src/components/RestTimer.jsx','icon="plus" onClick={() => addRest(15)}','icon="plus" aria-label="Add 15 seconds to rest" onClick={() => addRest(15)}')
print('First-user audit safeguards and verified optional support link applied')
