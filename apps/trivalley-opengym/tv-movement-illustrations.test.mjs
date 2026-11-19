import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MOVEMENT_ILLUSTRATIONS, movementFor } from './tv-movement-illustrations.mjs'
import { MUSCLE_SPLIT } from './tv-programs.mjs'
test('Every prescribed exercise maps to one distinct two-position asset; other exercises do not inherit a pose',()=>{
  const ids=MUSCLE_SPLIT.days.flatMap(day=>day.exercises.map(ex=>ex[0])).sort()
  assert.deepEqual(Object.keys(MOVEMENT_ILLUSTRATIONS).sort(),ids)
  assert.equal(new Set(ids.map(id=>movementFor(id).path)).size,16)
  assert.equal(movementFor({id:'unknown'}),null)
  assert.equal(movementFor({id:'custom-0313'}),null)
  assert.equal(movementFor(),null)
})
test('Image manifest matches the rendered exact-ID records and has valid full-size dimensions and hashes',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('./movement-assets.json',import.meta.url)))
  assert.equal(manifest.assets.length,16)
  for(const row of manifest.assets){
    const art=movementFor(row.id)
    for(const key of ['path','width','height','sha256','bytes'])assert.equal(art[key],row[key])
    assert.equal(art.width,1200);assert.equal(art.height,800)
    assert.match(art.sha256,/^[0-9a-f]{64}$/)
    assert.ok(art.alt.includes('left')&&art.alt.includes('right'))
    assert.equal(art.steps.length,3)
  }
})
test('Hammer and biceps curl grip cues remain distinct and hammer cue explicitly rejects the catalogue error',()=>{
  assert.match(movementFor('0313').steps.join(' '),/do not rotate your palms forward/)
  assert.match(movementFor('0294').steps.join(' '),/palms forward/)
  assert.match(movementFor('0585').steps[0],/fronts of your lower shins/)
  assert.match(movementFor('0586').steps[0],/behind your lower legs/)
})
