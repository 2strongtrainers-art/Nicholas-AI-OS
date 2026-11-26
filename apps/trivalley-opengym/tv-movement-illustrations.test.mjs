import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MOVEMENT_ILLUSTRATIONS, MOVEMENT_REVIEW_STATUS, movementReferenceFor, movementFor } from './tv-movement-illustrations.mjs'
import { CATALOGUE_ART_CORE } from './tv-catalogue-art-core.mjs'
import { MUSCLE_SPLIT } from './tv-programs.mjs'
test('Every prescribed exercise maps to one distinct two-position asset; other exercises do not inherit a pose',()=>{
  const ids=MUSCLE_SPLIT.days.flatMap(day=>day.exercises.map(ex=>ex[0])).sort()
  assert.ok(ids.every(id=>movementReferenceFor(id))); assert.equal(Object.keys(MOVEMENT_ILLUSTRATIONS).length,63+Object.keys(CATALOGUE_ART_CORE).length)
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
 const ids=['0404','1379','0401','0381','0410','0375']
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
  assert.equal(MOVEMENT_REVIEW_STATUS['0002'], 'approved') // formerly held; repaired exact-ID artwork is now accepted
  assert.equal(movementFor('0002').id,'0002')
})

test('Avatar abs batch uses ten real exact catalogue IDs without replacing the previous 53',()=>{
 const expected=['0001','0003','0006','0262','0267','0276','3640','0687','0871','3639']
 const cataloguePath=process.env.TV_CATALOGUE_PATH
 if(!cataloguePath) throw new Error('TV_CATALOGUE_PATH required for exact-ID artwork validation')
 const source=fs.readFileSync(cataloguePath,'utf8')
 const catalogue=JSON.parse(source.slice(source.indexOf('[')).trim().replace(/;$/,''))
 const urls=new Set()
 for(const id of expected){
  const row=catalogue.find(e=>e.id===id),art=movementFor(id)
  assert.ok(row&&art);assert.equal(art.name,row.n);assert.equal(art.equipment,row.eq)
  assert.equal(art.equipment,'body weight');assert.equal(art.steps.length,3)
  assert.equal(art.top,0);assert.equal(art.cropHeight,art.height)
  assert.equal(art.width,1536);assert.equal(art.height,1024)
  assert.match(art.sha256,/^[a-f0-9]{64}$/);assert.ok(art.bytes>100000)
  assert.match(art.review.identity,/avatar portrait/);assert.match(art.review.movement,/unverified/)
  urls.add(art.url);assert.equal(movementFor('custom-'+id),null)
 }
 assert.equal(urls.size,10)
 assert.equal(Object.keys(MOVEMENT_ILLUSTRATIONS).filter(id=>!expected.includes(id)&&!(id in CATALOGUE_ART_CORE)).length,53)
 assert.match(movementFor('0276').steps[1],/opposite leg/)
 assert.match(movementFor('0262').steps[1],/both feet remain grounded/)
 assert.match(movementFor('3639').steps[1],/shoulders stay on the mat/)
})


test('Core artwork maps only the 200 reviewed IDs to verified derivative assets',()=>{
 const text=fs.readFileSync(process.env.TV_CATALOGUE_PATH,'utf8')
 const catalogue=new Map(JSON.parse(text.slice(text.indexOf('[')).trim().replace(/;$/,'')).map(ex=>[ex.id,ex]))
 const assets=Object.values(CATALOGUE_ART_CORE)
 assert.equal(assets.length,200)
 assert.equal(new Set(assets.map(asset=>asset.url)).size,200)
 for(const asset of assets){
  assert.equal(movementFor(asset.id),asset)
  assert.equal(catalogue.get(asset.id).n,asset.name)
  assert.equal(catalogue.get(asset.id).eq,asset.equipment)
  assert.match(asset.url,/^https:\/\/static\.wixstatic\.com\/media\/[A-Za-z0-9_~.-]+\.(?:png|webp)$/)
  assert.deepEqual([asset.width,asset.height],[1536,1024])
  assert.match(asset.sha256,/^[a-f0-9]{64}$/)
  assert(asset.steps[0].length>30)
 }
 const repaired=['0634','0691','0735','0826','1466','1495','3204','0459','3239','1774','2329','2466','0002','0969','0985','1011','1014','0226','1714']
 const newest=['0983','0984','0986','0987','0988','0989','0990','0991','0993','0994','0996','0997','0998','0999','1000','1001','1003','1004','1008','1009','1010','1012','1018','1022','1023']
 const batch7=['0227','0228','0229','0230','0231','1376','0232','0233','1727','0234','0235','0236','1269','0238','0237','0239','0240','2464','0241','2405','0862','0244','1645','1728','0245']
 const batch8=['1270','1324','0246','1325','0247','1407','1377','1378','0248','2963','1548','1271','0251','1430','2462','1272','3216','1326','0253','0257','1273','0258','1327','0259','2398']
 for(const id of [...repaired,...newest,...batch7,...batch8]){
  const asset=movementFor(id)
  assert.ok(asset);assert.equal(asset.style,'Nick Style 3 + approved primary likeness')
  assert.match(asset.url,/\.webp$/);assert.match(asset.review.identity,/primary likeness/)
 }
})

test('Library copy reports the complete live illustrated coverage',()=>{
 const firstUseInstaller=fs.readFileSync(new URL('./upgrade_first_use.py',import.meta.url),'utf8')
 assert.match(firstUseInstaller,/likeness illustrations are available for 263 exercises/)
 assert.doesNotMatch(firstUseInstaller,/available for 63 exercises/)
})
