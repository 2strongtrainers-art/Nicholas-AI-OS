import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MOVEMENT_ILLUSTRATIONS, MOVEMENT_REVIEW_STATUS, movementReferenceFor, movementFor } from './tv-movement-illustrations.mjs'
import { MUSCLE_SPLIT } from './tv-programs.mjs'
test('Every prescribed exercise maps to one distinct two-position asset; other exercises do not inherit a pose',()=>{
  const ids=MUSCLE_SPLIT.days.flatMap(day=>day.exercises.map(ex=>ex[0])).sort()
  assert.ok(ids.every(id=>movementReferenceFor(id))); assert.equal(Object.keys(MOVEMENT_ILLUSTRATIONS).length,53)
  assert.equal(new Set(ids.map(id=>movementReferenceFor(id).path)).size,16)
  assert.equal(movementReferenceFor({id:'unknown'}),null)
  assert.equal(movementReferenceFor({id:'custom-0313'}),null)
  assert.equal(movementReferenceFor(),null)
})
test('Image manifest matches the rendered exact-ID records and has valid full-size dimensions and hashes',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('./movement-assets.json',import.meta.url)))
  assert.equal(manifest.assets.length,16)
  for(const row of manifest.assets){
    const art=movementReferenceFor(row.id)
    for(const key of ['path','width','height','sha256','bytes'])assert.equal(art[key],row[key])
    assert.equal(art.width,1200);assert.equal(art.height,800)
    assert.match(art.sha256,/^[0-9a-f]{64}$/)
    assert.ok(art.alt.includes('left')&&art.alt.includes('right'))
    assert.equal(art.steps.length,3)
  }
})
test('Hammer and biceps curl grip cues remain distinct and hammer cue explicitly rejects the catalogue error',()=>{
  assert.match(movementReferenceFor('0313').steps.join(' '),/do not rotate your palms forward/)
  assert.match(movementReferenceFor('0294').steps.join(' '),/palms forward/)
  assert.match(movementReferenceFor('0585').steps[0],/fronts of your lower shins/)
  assert.match(movementReferenceFor('0586').steps[0],/behind your lower legs/)
})

test('Reviewed v2 allowlist enables only exact exercise images and preserves technique cues',()=>{
  for (const id of MUSCLE_SPLIT.days.flatMap(d=>d.exercises.map(e=>e[0]))) {
    assert.equal(MOVEMENT_REVIEW_STATUS[id], 'approved')
    assert.equal(movementFor(id), movementReferenceFor(id))
    assert.match(movementFor(id).path, /-v2\.webp$/)
    assert.equal(movementReferenceFor(id).steps.length, 3)
  }
  assert.equal(movementFor('unknown'), null)
})

test('Press captions and close-grip row instructions match the revised image sequence',()=>{
  for(const id of ['0289','0314']){assert.match(movementFor(id).leftLabel,/Lowered/);assert.match(movementFor(id).rightLabel,/Press/)}
  assert.match(movementFor('0861').steps[0],/palms facing inward/)
  assert.equal(movementFor('custom-0313'),null)
})

test('Latest batch binds six reviewed catalogue IDs to valid disjoint image regions and exact equipment',()=>{
 const progress=JSON.parse(fs.readFileSync(new URL('./artwork-progress.json',import.meta.url)))
 const ids=progress.currentBatch.exactIds
 assert.equal(ids.length,6);assert.equal(new Set(ids).size,6)
 const regions=new Set()
 for(const id of ids){
  const art=movementFor(id),entry=progress.entries.find(e=>e.id===id)
  assert.equal(art.name,entry.name);assert.equal(art.equipment,entry.equipment)
  assert.ok(art.top>=0&&art.cropHeight>0&&art.top+art.cropHeight<=art.height)
  assert.match(art.url,/^https:\/\/static\.wixstatic\.com\/media\/[A-Za-z0-9_~.-]+\.png$/)
  assert.match(art.sha256,/^[a-f0-9]{64}$/);assert.equal(art.steps.length,3)
  regions.add([art.url,art.top,art.cropHeight].join(':'))
 }
 assert.equal(regions.size,6)
 assert.equal(movementFor('0043'),null) // A high-bar squat illustration must not imply full-depth acceptance.
 assert.notEqual(movementFor('0417').top,movementFor('1373').top)
 assert.equal(movementFor('custom-0662'),null)
})

test('Start/Finish art is visible in preview, active posters and Focus without mixing portrait and technique',()=>{
  const component=fs.readFileSync(new URL('./MovementIllustration.jsx',import.meta.url),'utf8')
  const phaseInstaller=fs.readFileSync(new URL('./upgrade_movement_illustrations.py',import.meta.url),'utf8')
  const tools=fs.readFileSync(new URL('./upgrade_workout_tools.py',import.meta.url),'utf8')
  const css=fs.readFileSync(new URL('./movement-illustrations.css',import.meta.url),'utf8')
  assert.match(component,/poster = false/)
  assert.match(component,/<strong>START<\/strong>/)
  assert.match(component,/<strong>FINISH<\/strong>/)
  assert.match(component,/if \(!asset\) return null/)
  assert.match(component,/AI-generated likeness illustration/)
  assert.match(phaseInstaller,/MovementIllustration ex=\{ex\} poster/)
  assert.match(tools,/MovementIllustration ex=\{ex\} poster/)
  assert.match(css,/\.tv-movement-poster/)
  assert.equal(MOVEMENT_REVIEW_STATUS['0001'], undefined) // queued artwork must never appear as Nick
  assert.equal(movementFor('0001'),null)
})
