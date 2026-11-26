import test from 'node:test'
import assert from 'node:assert/strict'
import {webcrypto} from 'node:crypto'
import {parseWorkoutBackup, serializeWorkoutBackup} from './tv-backup.mjs'
globalThis.crypto ??= webcrypto
const state = () => ({
  unit:'lb', routines:[{id:'r1',name:'Push Day',ex:[{id:'bench',sets:3}]}],
  workouts:[{id:'w1',d:'2026-11-17',entries:[{id:'bench',sets:[{w:65,r:8,done:true}]}]}],
  bodyweight:[],customEx:[],favoriteExercises:['bench'],active:{id:'a1',entries:[]},week:{1:'r1'}
})
test('modern backup verifies and round-trips complete history', async () => {
  const original=state()
  const parsed=await parseWorkoutBackup(await serializeWorkoutBackup(original))
  assert.equal(parsed.verified,true)
  assert.deepEqual(parsed.state,original)
})
test('existing plain OpenGym backups remain importable without claiming integrity', async () => {
  const old=state(); delete old.favoriteExercises;delete old.customEx
  const parsed=await parseWorkoutBackup(JSON.stringify(old))
  assert.equal(parsed.legacy,true)
  assert.equal(parsed.state.workouts[0].entries[0].sets[0].w,65)
})
test('tampering fails before state replacement', async () => {
  const obj=JSON.parse(await serializeWorkoutBackup(state()))
  obj.state.workouts[0].entries[0].sets[0].w=999
  await assert.rejects(parseWorkoutBackup(JSON.stringify(obj)), /checksum mismatch/)
})
test('rejects invalid structure and unsafe object keys', async () => {
  await assert.rejects(parseWorkoutBackup('{"workouts":[],"routines":[],"bodyweight":[],"__proto__":{}}'), /unsafe object keys/)
  await assert.rejects(parseWorkoutBackup('{"workouts":{},"routines":[],"bodyweight":[]}'), /Invalid or invalid|Missing or invalid/)
})
test('rejects unsupported future envelopes', async () => {
  await assert.rejects(parseWorkoutBackup(JSON.stringify({format:'unknown',version:9,state:state()})),/Unsupported backup/)
})
