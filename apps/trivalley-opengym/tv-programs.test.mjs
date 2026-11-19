import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MUSCLE_SPLIT, installedDays, addMuscleSplit, restForEntry, needsWorkingLoad } from './tv-programs.mjs'
import { serializeWorkoutBackup, parseWorkoutBackup } from './tv-backup.mjs'
import { durationRange } from './tv-training-insights.mjs'

const fresh = () => ({ unit: 'lb', routines: [{ id: 'mine', name: 'My original routine', ex: [] }], workouts: [{ id: 'history', entries: [] }], bodyweight: [], week: {}, dayPlan: { '2026-11-20': 'mine' }, active: { id: 'in-progress', entries: [] } })
const generator = () => { let n = 0; return () => 'program-' + ++n }

test('adds three ordered, editable routines without changing the active session, overrides, records or existing routine', () => {
  const S = fresh(), before = structuredClone(S)
  const result = addMuscleSplit(S, { makeId: generator() })
  assert.equal(result.added, 3)
  assert.deepEqual(installedDays(S).map(r => r.name), ['Back & Biceps', 'Chest & Triceps', 'Legs'])
  for (const key of ['active', 'workouts', 'dayPlan', 'week']) assert.deepEqual(S[key], before[key])
  assert.deepEqual(S.routines[0], before.routines[0])
  assert.ok(installedDays(S).every(r => r.ex.every(e => e.loadRequired && e.prog === 'double' && e.weight === 0)))
})
test('repeated installation is idempotent and preserves custom edits', () => {
  const S = fresh(), makeId = generator()
  addMuscleSplit(S, { makeId }); const days = installedDays(S)
  days[0].name = 'My Pull'; days[0].ex[0].sets = 2
  assert.equal(addMuscleSplit(S, { makeId }).added, 0)
  assert.equal(S.routines.length, 4)
  assert.equal(installedDays(S)[0].name, 'My Pull')
  assert.equal(installedDays(S)[0].ex[0].sets, 2)
})
test('scheduling fills only chosen empty slots and keeps occupied and unrelated days', () => {
  const S = fresh(); S.week = { 1: 'mine', 2: 'mine' }
  const result = addMuscleSplit(S, { makeId: generator(), schedule: 'mwf' })
  assert.deepEqual(result.kept, [1])
  assert.deepEqual(result.assigned, [3, 5])
  assert.equal(S.week[1], 'mine'); assert.equal(S.week[2], 'mine')
  assert.equal(S.week[3], result.routineIds[1])
  assert.equal(S.week[5], result.routineIds[2])
  assert.throws(() => addMuscleSplit(S, { makeId: generator(), schedule: 'unknown' }))
})
test('removing one template day then reinstalling adds only the missing day', () => {
  const S = fresh(), makeId = generator(); addMuscleSplit(S, { makeId })
  S.routines.splice(2, 1)
  assert.equal(addMuscleSplit(S, { makeId }).added, 1)
  assert.ok(installedDays(S).every(Boolean))
})
test('required working loads and valid per-exercise rests respect non-template defaults', () => {
  assert.equal(needsWorkingLoad({ target: { loadRequired: true }, sets: [{ w: 0 }] }, 0), true)
  assert.equal(needsWorkingLoad({ target: { loadRequired: true }, sets: [{ w: 25 }] }, 0), false)
  assert.equal(needsWorkingLoad({ target: {}, sets: [{ w: 0 }] }, 0), false)
  assert.equal(restForEntry({ target: { restSec: 120 } }, 90), 120)
  assert.equal(restForEntry({ target: { restSec: -1 } }, 90), 90)
  assert.equal(restForEntry({}, 90), 90)
  assert.deepEqual(durationRange({ restSec: 60 }, { ex: [{ sets: 3, reps: 10, restSec: 120 }] }), { min: 11, max: 13 })
})
test('verified backups retain template metadata, progression, loads and rest settings', async () => {
  const S = fresh(); addMuscleSplit(S, { makeId: generator(), schedule: 'tts' })
  const imported = await parseWorkoutBackup(await serializeWorkoutBackup(S))
  assert.equal(imported.verified, true)
  assert.deepEqual(imported.state, S)
})
const cataloguePath = process.env.TV_CATALOGUE_PATH
test('every template exercise resolves to the pinned catalogue and correct equipment', { skip: !cataloguePath }, () => {
  const source = fs.readFileSync(cataloguePath, 'utf8')
  const exercises = JSON.parse(source.slice(source.indexOf('=') + 1).trim().replace(/;$/, ''))
  const index = new Map(exercises.map(e => [e.id, e]))
  for (const day of MUSCLE_SPLIT.days) {
    for (const [id, , sets, low, high, rest] of day.exercises) {
      const exercise = index.get(id)
      assert.ok(exercise?.st?.length, 'Missing exercise instructions ' + id)
      assert.ok(['dumbbell', 'cable', 'leverage machine', 'sled machine'].includes(exercise.eq), 'Wrong equipment ' + id)
      assert.ok(sets >= 2 && sets <= 3 && low <= high && rest >= 60 && rest <= 120)
    }
  }
  assert.equal(index.get('0861').n, 'cable seated row')
  assert.equal(index.get('1459').n, 'dumbbell romanian deadlift')
})
