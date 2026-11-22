import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { COACH_NOTES, ESSENTIAL_IDS, coachNotesFor, normalizeExerciseNames } from './tv-coach-notes.mjs'
import { MUSCLE_SPLIT } from './tv-programs.mjs'
import { CATALOGUE_ART_BATCH16 } from './tv-catalogue-art-batch16.mjs'

test('Batch 16 replaces contradictory generic instructions without expanding the Main 16', () => {
  assert.equal(ESSENTIAL_IDS.length, 16)
  for (const [id, asset] of Object.entries(CATALOGUE_ART_BATCH16)) {
    assert.deepEqual(coachNotesFor({ id }), asset.coaching)
    assert.equal(asset.coaching.length, 4)
  }
  assert.match(coachNotesFor({ id: '3235' })[1], /whole body lowers from the knees/)
  assert.match(coachNotesFor({ id: '0149' })[1], /overhead/)
  assert.equal(coachNotesFor({ id: 'constructor' }), null)
})

test('every split movement has exactly four usable notes and one exact identifier', () => {
  const ids = MUSCLE_SPLIT.days.flatMap(day => day.exercises.map(ex => ex[0]))
  assert.equal(ids.length, 16)
  assert.deepEqual([...ids].sort(), [...ESSENTIAL_IDS].sort())
  for (const id of ids) {
    assert.equal(COACH_NOTES[id].length, 4)
    assert(COACH_NOTES[id].every(note => typeof note === 'string' && note.length > 30))
  }
  assert.equal(coachNotesFor({id:'not-present'}), null)
  assert.equal(coachNotesFor({id:'__proto__'}), null)
})
test('catalogue entries and every programmed prescription resolve without invented media coverage', {skip: !process.env.TV_CATALOGUE_PATH}, async () => {
  const { EXDB } = await import(pathToFileURL(resolve(process.env.TV_CATALOGUE_PATH)).href)
  assert.equal(EXDB.length,1324)
  assert.equal(new Set(EXDB.map(ex => ex.id)).size,1324)
  normalizeExerciseNames(EXDB)
  for (const ex of EXDB) {
    for(const key of ['id','n','eq','bp','tg']) assert.equal(typeof ex[key], 'string', `${ex.id}: ${key}`)
    assert(ex.st.length > 0 && ex.st.every(step => typeof step === 'string' && step.trim().length > 0), ex.id)
    assert(!ex.n.includes('в°'), ex.id)
  }
  const index = new Map(EXDB.map(ex => [ex.id,ex]))
  for (const day of MUSCLE_SPLIT.days) for(const [id,,sets,min,max,rest] of day.exercises) {
    assert(index.has(id)); assert(sets > 0 && min > 0 && max >= min && rest > 0)
  }
})
