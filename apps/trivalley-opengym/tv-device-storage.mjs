export const BACKUP_KEY = 'tv_backup_status_v1'
export function persistDeviceState(storage, key, state, now = Date.now()) {
  try {
    storage.setItem(key, JSON.stringify(state))
    return { ok: true, savedAt: now }
  } catch {
    return { ok: false, savedAt: null }
  }
}
export function readBackup(storage) {
  try { return JSON.parse(storage.getItem(BACKUP_KEY)) || {} } catch { return {} }
}
export function prepareBackup(storage, state, now = Date.now()) {
  const next = { ...readBackup(storage), prepared: { at: now, stateTs: state._ts || 0 } }
  storage.setItem(BACKUP_KEY, JSON.stringify(next))
  return next
}
export function confirmBackup(storage, state, now = Date.now()) {
  const current = readBackup(storage)
  if (!current.prepared || current.prepared.stateTs !== (state._ts || 0)) throw new Error('Export a fresh backup first')
  const next = { confirmed: { ...current.prepared, confirmedAt: now } }
  storage.setItem(BACKUP_KEY, JSON.stringify(next))
  return next
}
export function backupSummary(metadata, state, now = Date.now()) {
  const saved = metadata.confirmed
  if (!saved) return { due: true, label: 'No backup confirmed' }
  const changed = (state.workouts || []).some(w => (w.end || 0) > saved.at)
  const stateChanged = (state._ts || 0) > (saved.stateTs || 0)
  const old = now - saved.at >= 7 * 86400000
  return { due: changed || stateChanged || old, label: changed ? 'New workouts need a backup' : stateChanged ? 'Changes need a fresh backup' : old ? 'Weekly backup due' : 'Backup confirmed by you' }
}
