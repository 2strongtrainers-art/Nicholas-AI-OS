import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { COACH_NOTES, ESSENTIAL_IDS, coachNotesFor, normalizeExerciseNames } from './tv-coach-notes.mjs'
import { MUSCLE_SPLIT } from './tv-programs.mjs'
import { CATALOGUE_ART_BATCH16 } from './tv-catalogue-art-batch16.mjs'
import { CATALOGUE_ART_BATCH17 } from './tv-catalogue-art-batch17.mjs'
import { CATALOGUE_ART_BATCH18 } from './tv-catalogue-art-batch18.mjs'
import { CATALOGUE_ART_BATCH19 } from './tv-catalogue-art-batch19.mjs'
import { CATALOGUE_ART_BATCH20 } from './tv-catalogue-art-batch20.mjs'
test('Batch 19 coaching matches its illustrations without changing the Main 16',()=>{
 assert.equal(ESSENTIAL_IDS.length,16)
 for(const [id,a] of Object.entries(CATALOGUE_ART_BATCH19)) assert.deepEqual(coachNotesFor({id}),a.coaching)
 assert.match(coachNotesFor({id:'1268'})[0],/whole head and upper back/)
 assert.match(coachNotesFor({id:'0204'})[1],/elbow outward/)
 assert.equal(coachNotesFor({id:'constructor'}),null)
})

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

test('Batch 17 provides exact movement coaching while preserving Main 16 membership',()=>{
 assert.equal(ESSENTIAL_IDS.length,16)
 for(const [id,a] of Object.entries(CATALOGUE_ART_BATCH17)) assert.deepEqual(coachNotesFor({id}),a.coaching)
 assert.match(coachNotesFor({id:'0182'})[0],/high pulley/)
 assert.match(coachNotesFor({id:'0184'})[1],/elbow bend/)
 assert.equal(coachNotesFor({id:'toString'}),null)
})

test('Batch 18 provides exact movement coaching while preserving Main 16 membership',()=>{
 assert.equal(ESSENTIAL_IDS.length,16)
 for(const [id,a] of Object.entries(CATALOGUE_ART_BATCH18)) assert.deepEqual(coachNotesFor({id}),a.coaching)
 assert.match(coachNotesFor({id:'2414'})[0],/both hands/)
 assert.match(coachNotesFor({id:'0137'})[1],/high plank/)
 assert.equal(coachNotesFor({id:'constructor'}),null)
})
test('Batch 20 accessible coaching resolves exact catalogue IDs without changing Main 16 membership',()=>{
 assert.equal(ESSENTIAL_IDS.length,16)
 for(const [id,a] of Object.entries(CATALOGUE_ART_BATCH20))assert.deepEqual(coachNotesFor({id}),a.coaching)
})


import { CATALOGUE_ART_BATCH23 } from './tv-catalogue-art-batch23.mjs'
test('Batch23 exposes four structured coaching fields for every new exact ID',()=>{
 assert.equal(ESSENTIAL_IDS.length,16)
 for(const [id,asset] of Object.entries(CATALOGUE_ART_BATCH23)){
  const notes=coachNotesFor({id})
  assert.deepEqual(notes,asset.coaching,id)
  assert.equal(notes.length,4,id)
 }
 assert.equal(coachNotesFor({id:'constructor'}),null)
})

import { CATALOGUE_ART_BATCH24 } from './tv-catalogue-art-batch24.mjs'
test('Batch24 exposes four structured coaching fields for every new exact ID',()=>{
 assert.equal(ESSENTIAL_IDS.length,16)
 for(const [id,asset] of Object.entries(CATALOGUE_ART_BATCH24)){
  const notes=coachNotesFor({id})
  assert.deepEqual(notes,asset.coaching,id)
  assert.equal(notes.length,4,id)
 }
 assert.equal(coachNotesFor({id:'constructor'}),null)
})

import { CATALOGUE_ART_BATCH25 } from './tv-catalogue-art-batch25.mjs'
test('Batch25 exposes four structured coaching fields for every new exact ID',()=>{
 assert.equal(ESSENTIAL_IDS.length,16)
 for(const [id,asset] of Object.entries(CATALOGUE_ART_BATCH25)){
  const notes=coachNotesFor({id})
  assert.deepEqual(notes,asset.coaching,id)
  assert.equal(notes.length,4,id)
 }
 assert.equal(coachNotesFor({id:'constructor'}),null)
})
