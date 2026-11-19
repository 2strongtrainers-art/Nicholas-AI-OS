import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { todayISO, fmtNum } from '../lib/format.js'
import { EXIDX } from '../lib/exercises.js'
import { buildSets, modeOf, fmtSec } from '../lib/history.js'
import { nextPrescription, applyPrescription } from '../lib/progression.js'
import { t } from '../lib/i18n.js'
import { nextSession, durationRange, progressSummary, recentRepProgress, completedRecords } from '../lib/tv-training-insights.js'
import { readBackup, prepareBackup, confirmBackup, backupSummary } from '../lib/tv-device-storage.js'

const nameOf = id => EXIDX[id]?.n || id
const dateLabel = day => new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
const notifyBackup = () => window.dispatchEvent(new Event('tv:backup-status'))
export function backupPrepared(S) {
  try {
    prepareBackup(localStorage, S)
    notifyBackup()
    return true
  } catch { return false }
}
function useBackup(S) {
  const [metadata, setMetadata] = useState(() => readBackup(localStorage))
  useEffect(() => {
    const refresh = () => setMetadata(readBackup(localStorage))
    window.addEventListener('tv:backup-status', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('tv:backup-status', refresh); window.removeEventListener('storage', refresh) }
  }, [])
  return { metadata, summary: backupSummary(metadata, S) }
}
export function DeviceStatus() {
  const nav = useNavigate(), S = useStore(s => s.S), saved = useStore(s => s.storageStatus)
  const [online, setOnline] = useState(navigator.onLine)
  const [offlineReady, setOfflineReady] = useState(false)
  const { summary } = useBackup(S)
  useEffect(() => {
    const check = async () => {
      setOnline(navigator.onLine)
      try {
        const registration = await navigator.serviceWorker?.getRegistration()
        if (!registration?.active?.scriptURL.includes('/tv-sw.js')) { setOfflineReady(false); return }
        const keys = await caches.keys()
        let ready = false
        for (const key of keys.filter(k => k.startsWith('trivalley-open-gym-'))) {
          const cache = await caches.open(key)
          const response = await cache.match(new URL('./index.html', location.href.split('#')[0]).href)
          if (response?.ok) ready = true
        }
        setOfflineReady(ready)
      } catch { setOfflineReady(false) }
    }
    check()
    window.addEventListener('online', check); window.addEventListener('offline', check)
    navigator.serviceWorker?.addEventListener('controllerchange', check)
    return () => { window.removeEventListener('online', check); window.removeEventListener('offline', check); navigator.serviceWorker?.removeEventListener('controllerchange', check) }
  }, [])
  const failed = saved?.ok === false
  return <aside className={'tv-device-status' + (failed ? ' tv-save-error' : '')} aria-label="Device storage status" data-testid="tv-device-status">
    <div role={failed ? 'alert' : 'status'}>
      <strong>{failed ? 'Changes are not saved' : saved?.ok ? 'Saved on this device' : 'Ready to save on this device'}</strong>
      <span>{failed ? 'Keep this page open and export a backup now.' : online ? (offlineReady ? 'Offline app cached' : 'Online · offline cache not yet verified') : offlineReady ? 'Offline · using cached app' : 'Offline · cache not verified'}</span>
    </div>
    <button type="button" onClick={() => nav('/settings')} data-testid="tv-backup-shortcut">{failed ? 'Export backup' : summary.label}</button>
  </aside>
}
function targetLabel(cfg, sets, unit) {
  const set = sets[0]
  if (!set) return 'Set your target in the workout'
  const mode = modeOf(cfg), n = sets.length
  const fields = mode === 'cardio' ? ['min', 'speed'] : mode === 'time' ? ['sec', 'w'] : ['r', 'w']
  if (sets.some(s => fields.some(key => s[key] !== set[key]))) {
    return sets.map(s => targetLabel(cfg, [s], unit)).join('; ')
  }
  if (mode === 'cardio') return `${n} × ${fmtNum(set.min || 0)} min · ${fmtNum(set.speed || 0)} km/h`
  const load = set.w > 0 ? `${fmtNum(set.w)} ${unit} · ` : ''
  return mode === 'time' ? `${n} × ${fmtSec(set.sec)} · ${load ? load.slice(0, -3) : 'bodyweight'}`
    : `${n} × ${set.r || 0} reps · ${load ? load.slice(0, -3) : 'bodyweight'}`
}
export function TrainingBrief() {
  const S = useStore(s => s.S), nav = useNavigate()
  const next = nextSession(S, todayISO())
  if (S.active || !next) return null
  const estimate = durationRange(S, next.routine)
  const records = completedRecords(S, todayISO())
  return <section className="card tv-session-brief" data-testid="tv-session-brief" aria-label="Your session guide">
    <div className="tv-eyebrow">{next.offset ? 'NEXT SCHEDULED SESSION' : 'YOUR SESSION GUIDE'}</div>
    <h2>{next.routine.name}</h2>
    <p className="small muted">{next.offset ? `${dateLabel(next.day)} · Today has no scheduled session.` : 'Scheduled for today.'} Estimated {estimate.min}–{estimate.max} min.</p>
    <details>
      <summary>View exercises, previous sets and next targets</summary>
      <ol className="tv-targets">
        {next.routine.ex.map((cfg, index) => {
          const plan = nextPrescription(S, cfg, next.routine)
          const sets = applyPrescription(buildSets(S, cfg), plan)
          const lastWorkout = [...records].reverse().find(w => w.entries?.some(e => e.id === cfg.id && modeOf(e.target || e) === modeOf(cfg)))
          const last = lastWorkout?.entries.find(e => e.id === cfg.id)
          const previous = last?.sets.filter(s => s.done)
          return <li key={cfg.id + '-' + index}>
            <strong>{nameOf(cfg.id)}</strong>
            <span data-testid="tv-next-target">Next: {targetLabel(cfg, sets, S.unit)}</span>
            <span className="muted">{previous?.length ? `Previous (${dateLabel(lastWorkout.d)}): ${targetLabel({ ...cfg, sets: previous.length }, previous, lastWorkout.unit || 'logged units')}` : 'No completed sets for this exercise yet.'}</span>
            {plan.why && <span className="tv-prescription-reason">{t(...plan.why)}</span>}
          </li>
        })}
      </ol>
      <p className="small muted">Targets follow your selected progression policy. Adjust to your readiness and available equipment. Older logs have no recorded unit; changing the unit setting relabels numbers without converting them.</p>
      <p className="small muted">Time is a planning estimate: five minutes of preparation, planned sets, 3–5 seconds per rep, your rest setting, and exercise transitions.</p>
    </details>
    <button className="tv-text-action" onClick={() => nav('/plan')}>Review or adjust my plan</button>
  </section>
}
export function ProgressSummary() {
  const S = useStore(s => s.S), summary = progressSummary(S, todayISO()), rep = recentRepProgress(S, todayISO())
  return <section className="card tv-progress-summary" data-testid="tv-progress-summary" aria-label="Training progress summary">
    <div className="tv-eyebrow">YOUR LAST SEVEN DAYS</div>
    <h2>{summary.total ? 'Your consistency, at a glance' : 'Your progress starts with one session'}</h2>
    <div className="tv-progress-grid">
      <div><strong data-testid="tv-summary-sessions">{summary.sessions}</strong><span>Completed sessions</span></div>
      <div><strong data-testid="tv-summary-sets">{summary.completedSets}</strong><span>Logged sets</span></div>
      <div><strong>{summary.scheduledDue ? `${summary.scheduledDone}/${summary.scheduledDue}` : '—'}</strong><span>Scheduled days trained</span></div>
    </div>
    <p className="small muted">{summary.total ? `${summary.previousSessions} sessions in the previous seven days. Last session: ${dateLabel(summary.last.d)}.` : 'Complete and finish a workout to see your actual training here.'}</p>
    {rep && <p className="tv-progress-gain">{nameOf(rep.id)}: {rep.gain} more {rep.gain === 1 ? 'rep' : 'reps'} {rep.weight > 0 ? `at ${fmtNum(rep.weight)} ${rep.unit}` : 'with bodyweight'} ({dateLabel(rep.day)}), compared with your previous logged top set at that load.</p>}
    <details><summary>How this is calculated</summary><p className="small muted">Only finished sessions with completed sets count. Scheduled days cover Monday through today using your current plan and day overrides; any completed session on a scheduled day counts. Future sessions are excluded. Rep comparisons require the same exercise, mode, load and recorded unit. Older entries without a unit are excluded from rep comparisons.</p></details>
  </section>
}
export function BackupPanel({ onExport }) {
  const S = useStore(s => s.S), { metadata, summary } = useBackup(S)
  const [error, setError] = useState('')
  const canConfirm = metadata.prepared && metadata.prepared.stateTs === (S._ts || 0)
  return <section className="card tv-backup-panel" data-testid="tv-backup-panel" aria-label="Backup status">
    <div className="tv-eyebrow">PROTECT YOUR TRAINING</div><h2>{summary.label}</h2>
    <p className="small muted">Workouts are stored in this browser. A backup is a separate JSON file you save in Files or another safe place.</p>
    {metadata.confirmed && <p className="small muted">You confirmed a backup on {new Date(metadata.confirmed.at).toLocaleDateString()}. The app cannot verify that file remains available.</p>}
    <button type="button" className="btn primary" onClick={onExport}>Export a fresh backup</button>
    {canConfirm && <div className="tv-backup-confirm"><p className="small">Your file is ready. Complete the browser’s save or share step, then confirm here.</p><button type="button" className="btn" onClick={() => {
      try { confirmBackup(localStorage, S); setError(''); notifyBackup() } catch (e) { setError(e.message) }
    }}>I saved this backup</button></div>}
    {error && <p role="alert">{error}</p>}
    <p className="small muted">Importing a backup replaces this device’s current data after a confirmation. Export before switching phones or clearing browser data.</p>
  </section>
}
