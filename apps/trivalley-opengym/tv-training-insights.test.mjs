import test from 'node:test'
import assert from 'node:assert/strict'
import { validDay, shiftDay, nextSession, routineOn, progressSummary, durationRange, recentRepProgress } from './tv-training-insights.mjs'
import { persistDeviceState, prepareBackup, confirmBackup, readBackup, backupSummary } from './tv-device-storage.mjs'

const day = '2026-11-19'
const set = (w = 50, r = 10, done = true) => ({ w, r, done })
const workout = (id, d, sets = [set()], extra = {}) => ({ id, d, unit: 'lb', entries: [{ id: 'squat', target: { mode: 'reps' }, sets }], ...extra })
const plan = { routines: [{ id: 'a', name: 'Strength', ex: [{ id: 'squat', sets: 3, reps: 10 }] }], week: { 1: 'a', 3: 'a', 5: 'a' }, dayPlan: {}, workouts: [] }

test('calendar arithmetic rejects impossible dates and crosses DST/year boundaries by calendar day', () => {
  assert.equal(validDay('2026-02-30'), false)
  assert.equal(validDay('2028-02-29'), true)
  assert.equal(shiftDay('2026-11-01', -1), '2026-10-31')
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01')
  assert.throws(() => shiftDay('invalid', 1))
})
test('next session respects rest overrides, missing routines and one-off scheduling', () => {
  assert.equal(nextSession(plan, day).day, '2026-11-20')
  const S = { ...plan, dayPlan: { '2026-11-20': 'rest', '2026-11-21': 'a' } }
  assert.equal(nextSession(S, day).day, '2026-11-21')
  assert.equal(routineOn({ ...plan, week: { 4: 'missing' } }, day), null)
  assert.equal(nextSession({ ...plan, week: {} }, day), null)
})
test('summary uses complete sets, ignores duplicate/future/empty records and compares exact seven-day windows', () => {
  const S = { ...plan, workouts: [workout('a', '2026-11-17', [set(), set(50, 5, false)]), workout('a', '2026-11-17'), workout('old', '2026-11-12'), workout('edge', '2026-11-13'), workout('future', '2026-11-20'), workout('empty', day, []), workout('bad', '2026-02-30')] }
  const result = progressSummary(S, day)
  assert.equal(result.sessions, 2)
  assert.equal(result.previousSessions, 1)
  assert.equal(result.completedSets, 2)
  assert.equal(result.total, 3)
})
test('scheduled-day counts stop today, honor rest and never exceed their denominator', () => {
  const S = { ...plan, workouts: [workout('a', '2026-11-16'), workout('b', '2026-11-16'), workout('c', '2026-11-17')], dayPlan: { '2026-11-18': 'rest' } }
  const result = progressSummary(S, day)
  assert.deepEqual([result.scheduledDone, result.scheduledDue], [1, 1])
  assert.equal(progressSummary({ ...plan, week: {} }, day).scheduledDue, 0)
})
test('duration differentiates reps, timed holds and cardio, and labels a range', () => {
  assert.equal(durationRange(plan, null), null)
  assert.deepEqual(durationRange({ restSec: 60 }, { ex: [{ sets: 3, reps: 10, mode: 'reps' }] }), { min: 9, max: 11 })
  assert.deepEqual(durationRange({ restSec: 60 }, { ex: [{ sets: 1, min: 20, mode: 'cardio' }] }), { min: 25, max: 26 })
  assert.deepEqual(durationRange({ restSec: 0 }, { ex: [{ sets: 2, sec: 45, mode: 'time' }] }), { min: 7, max: 8 })
})
test('rep comparison requires the same known unit and load; excludes legacy and timed work', () => {
  const a = workout('a', '2026-11-16', [set(50, 8)])
  const b = workout('b', '2026-11-18', [set(50, 10)])
  assert.equal(recentRepProgress({ workouts: [b, a] }, day).gain, 2)
  assert.equal(recentRepProgress({ workouts: [a, { ...b, unit: 'kg' }] }, day), null)
  assert.equal(recentRepProgress({ workouts: [{ ...a, unit: undefined }, b] }, day), null)
  assert.equal(recentRepProgress({ workouts: [a, workout('b', day, [set(55, 10)])] }, day), null)
  assert.equal(recentRepProgress({ workouts: [a, { ...b, entries: [{ ...b.entries[0], target: { mode: 'time' } }] }] }, day), null)
})
const memory = () => { const map = new Map(); return { getItem: k => map.get(k) || null, setItem: (k, v) => map.set(k, v) } }
test('storage success reports a saved timestamp and quota denial reports unsaved without throwing', () => {
  const storage = memory()
  assert.deepEqual(persistDeviceState(storage, 'data', { a: 1 }, 100), { ok: true, savedAt: 100 })
  assert.equal(storage.getItem('data'), '{"a":1}')
  assert.deepEqual(persistDeviceState({ setItem() { throw new Error('QuotaExceededError') } }, 'data', {}, 100), { ok: false, savedAt: null })
})
test('preparing a file never confirms a backup and confirmation rejects stale exports', () => {
  const storage = memory(), state = { _ts: 10, workouts: [] }
  assert.throws(() => confirmBackup(storage, state))
  prepareBackup(storage, state, 100)
  assert.equal(readBackup(storage).confirmed, undefined)
  assert.equal(backupSummary(readBackup(storage), state, 101).due, true)
  assert.throws(() => confirmBackup(storage, { ...state, _ts: 11 }))
  confirmBackup(storage, state, 102)
  assert.equal(backupSummary(readBackup(storage), state, 103).due, false)
  assert.equal(backupSummary(readBackup(storage), { workouts: [{ end: 104 }] }, 105).label, 'New workouts need a backup')
  assert.equal(backupSummary(readBackup(storage), state, 100 + 7 * 86400000).label, 'Weekly backup due')
})
