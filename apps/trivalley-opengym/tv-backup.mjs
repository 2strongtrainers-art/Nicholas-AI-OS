// Local-only workout export/import with validated legacy compatibility.
// This module sends no client or workout data to any network service.
export const BACKUP_FORMAT = 'trivalley-fit-workout-backup'
export const BACKUP_VERSION = 1
const LIMIT_BYTES = 12 * 1024 * 1024
const arrayFields = ['workouts','routines','bodyweight']
const forbidden = new Set(['__proto__','prototype','constructor'])
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x)
const assert = (condition, message) => { if (!condition) throw new Error(message) }
function audit(value, depth = 0, counter = {n:0}) {
  counter.n++
  assert(counter.n < 300000, 'Backup contains too many values')
  assert(depth < 35, 'Backup is nested too deeply')
  if (Array.isArray(value)) {
    assert(value.length < 100000, 'Backup includes an oversized list')
    for (const child of value) audit(child, depth + 1, counter)
  } else if (plain(value)) {
    for (const [key, child] of Object.entries(value)) {
      assert(!forbidden.has(key), 'Backup contains unsafe object keys')
      audit(child, depth + 1, counter)
    }
  }
}
function validate(state) {
  assert(plain(state), 'Workout state must be an object')
  audit(state)
  for (const field of arrayFields) assert(Array.isArray(state[field]), 'Missing or invalid ' + field)
  for (const field of ['customEx','favoriteExercises']) {
    if (field in state) assert(Array.isArray(state[field]), 'Invalid ' + field)
  }
  assert(!('active' in state) || state.active == null || plain(state.active), 'Invalid active session')
  assert(!('week' in state) || plain(state.week), 'Invalid week schedule')
  for (const workout of state.workouts) {
    assert(plain(workout) && Array.isArray(workout.entries), 'Invalid logged workout')
    for (const ex of workout.entries) {
      assert(plain(ex) && typeof ex.id === 'string' && Array.isArray(ex.sets), 'Invalid workout exercise')
      for (const set of ex.sets) assert(plain(set) && typeof set.done === 'boolean', 'Invalid workout set')
    }
  }
  for (const routine of state.routines) {
    assert(plain(routine) && typeof routine.id === 'string' && Array.isArray(routine.ex), 'Invalid routine')
  }
  return JSON.parse(JSON.stringify(state))
}
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2,'0')).join('')
async function digest(text) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure checksum support is unavailable')
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}
export async function serializeWorkoutBackup(state) {
  const validated = validate(state)
  const serialized = JSON.stringify(validated)
  assert(new TextEncoder().encode(serialized).length <= LIMIT_BYTES, 'Workout backup is too large')
  const sha256 = await digest(serialized)
  return JSON.stringify({
    format: BACKUP_FORMAT, version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(), sha256, state: validated
  }, null, 2)
}
export async function parseWorkoutBackup(raw) {
  assert(typeof raw === 'string' && new TextEncoder().encode(raw).length <= LIMIT_BYTES,
    'Backup file must be valid JSON under 12 MB')
  let json
  try { json = JSON.parse(raw) } catch { throw new Error('File is not valid JSON') }
  assert(plain(json), 'Invalid backup document')
  if (json.format === BACKUP_FORMAT) {
    assert(json.version === BACKUP_VERSION, 'Unsupported backup format version')
    assert(typeof json.sha256 === 'string' && /^[0-9a-f]{64}$/.test(json.sha256),
      'Missing backup checksum')
    const state = validate(json.state)
    const calculated = await digest(JSON.stringify(json.state))
    assert(calculated === json.sha256, 'Backup checksum mismatch; no data was imported')
    return {state, verified: true, legacy: false}
  }
  // Older openGym backups contain the state at the top level, without an integrity checksum.
  assert(!('format' in json), 'Unsupported backup document')
  return {state: validate(json), verified: false, legacy: true}
}
