import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MOVEMENT_ILLUSTRATIONS, MOVEMENT_REVIEW_STATUS, movementReferenceFor, movementFor } from './tv-movement-illustrations.mjs'
import { CATALOGUE_ART_CORE } from './tv-catalogue-art-core.mjs'
import { CATALOGUE_ART_BATCH9 } from './tv-catalogue-art-batch9.mjs'
import { CATALOGUE_ART_BATCH10 } from './tv-catalogue-art-batch10.mjs'
import { CATALOGUE_ART_BATCH11 } from './tv-catalogue-art-batch11.mjs'
import { CATALOGUE_ART_BATCH12 } from './tv-catalogue-art-batch12.mjs'
import { CATALOGUE_ART_BATCH13 } from './tv-catalogue-art-batch13.mjs'
import { CATALOGUE_ART_BATCH14 } from './tv-catalogue-art-batch14.mjs'
import { CATALOGUE_ART_BATCH15 } from './tv-catalogue-art-batch15.mjs'
import { CATALOGUE_ART_BATCH16 } from './tv-catalogue-art-batch16.mjs'
import { CATALOGUE_ART_BATCH17 } from './tv-catalogue-art-batch17.mjs'
import { CATALOGUE_ART_BATCH18 } from './tv-catalogue-art-batch18.mjs'
import { CATALOGUE_ART_BATCH19 } from './tv-catalogue-art-batch19.mjs'
import { CATALOGUE_ART_BATCH20 } from './tv-catalogue-art-batch20.mjs'
import { CATALOGUE_ART_BATCH21 } from './tv-catalogue-art-batch21.mjs'
import { CATALOGUE_ART_BATCH22 } from './tv-catalogue-art-batch22.mjs'
import { CATALOGUE_ART_BATCH23 } from './tv-catalogue-art-batch23.mjs'
import { CATALOGUE_ART_BATCH24 } from './tv-catalogue-art-batch24.mjs'
import { CATALOGUE_ART_BATCH25 } from './tv-catalogue-art-batch25.mjs'
import { CATALOGUE_ART_BATCH26 } from './tv-catalogue-art-batch26.mjs'
import { CATALOGUE_ART_BATCH27 } from './tv-catalogue-art-batch27.mjs'
import { CATALOGUE_ART_BATCH28 } from './tv-catalogue-art-batch28.mjs'
import { CATALOGUE_ART_BATCH29 } from './tv-catalogue-art-batch29.mjs'
import { MUSCLE_SPLIT } from './tv-programs.mjs'
test('Batch 19 exact IDs match catalogue names and preserve prior image records',()=>{
 const text=fs.readFileSync(process.env.TV_CATALOGUE_PATH,'utf8')
 const catalogue=new Map(JSON.parse(text.slice(text.indexOf('[')).trim().replace(/;$/,'')).map(ex=>[ex.id,ex]))
 const entries=Object.entries(CATALOGUE_ART_BATCH19)
 assert.equal(entries.length,25)
 assert.equal(new Set(entries.map(([,a])=>a.url)).size,25)
 for(const [id,a] of entries){
  assert.equal(a.id,id);assert.equal(movementFor(id),a)
  assert.equal(a.name,catalogue.get(id).n);assert.equal(a.equipment,catalogue.get(id).eq)
  assert.deepEqual([a.width,a.height],[1200,800]);assert(a.bytes>50000&&a.bytes<500000)
  assert.match(a.sha256,/^[0-9a-f]{64}$/)
  assert.match(a.url,/^https:\/\/static\.wixstatic\.com\/media\/[A-Za-z0-9_~.-]+\.webp$/)
  assert.equal(a.coaching.length,4);assert(a.coaching.every(x=>x.length>20))
 }
 assert.match(CATALOGUE_ART_BATCH19['1268'].coaching[0],/whole head and upper back/)
 assert.match(CATALOGUE_ART_BATCH19['1636'].coaching[0],/two high side pulleys/)
 assert.match(CATALOGUE_ART_BATCH19['0204'].coaching[1],/extend the elbow outward/)
 assert.match(CATALOGUE_ART_BATCH19['0203'].coaching[0],/high pulley/)
 assert.match(CATALOGUE_ART_BATCH19['0206'].coaching[0],/palms down/)
})
test('Every prescribed exercise maps to one distinct two-position asset; other exercises do not inherit a pose',()=>{
  const ids=MUSCLE_SPLIT.days.flatMap(day=>day.exercises.map(ex=>ex[0])).sort()
  assert.ok(ids.every(id=>movementReferenceFor(id))); assert.equal(Object.keys(MOVEMENT_ILLUSTRATIONS).length,63+Object.keys(CATALOGUE_ART_CORE).length+Object.keys(CATALOGUE_ART_BATCH9).length+Object.keys(CATALOGUE_ART_BATCH10).length+Object.keys(CATALOGUE_ART_BATCH11).length+Object.keys(CATALOGUE_ART_BATCH12).length+Object.keys(CATALOGUE_ART_BATCH13).length+Object.keys(CATALOGUE_ART_BATCH14).length+Object.keys(CATALOGUE_ART_BATCH15).length+Object.keys(CATALOGUE_ART_BATCH16).length+Object.keys(CATALOGUE_ART_BATCH17).length+Object.keys(CATALOGUE_ART_BATCH18).length+Object.keys(CATALOGUE_ART_BATCH19).length+Object.keys(CATALOGUE_ART_BATCH20).length+Object.keys(CATALOGUE_ART_BATCH21).length+Object.keys(CATALOGUE_ART_BATCH22).length+Object.keys(CATALOGUE_ART_BATCH23).length+Object.keys(CATALOGUE_ART_BATCH24).length+Object.keys(CATALOGUE_ART_BATCH25).length+Object.keys(CATALOGUE_ART_BATCH26).length+Object.keys(CATALOGUE_ART_BATCH27).length+Object.keys(CATALOGUE_ART_BATCH28).length+Object.keys(CATALOGUE_ART_BATCH29).length)
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
 assert.equal(movementFor('0043').id,'0043') // Batch 10 has a distinct full-depth high-bar squat card.
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
 assert.equal(Object.keys(MOVEMENT_ILLUSTRATIONS).filter(id=>!expected.includes(id)&&!(id in CATALOGUE_ART_CORE)&&!(id in CATALOGUE_ART_BATCH9)&&!(id in CATALOGUE_ART_BATCH10)&&!(id in CATALOGUE_ART_BATCH11)&&!(id in CATALOGUE_ART_BATCH12)&&!(id in CATALOGUE_ART_BATCH13)&&!(id in CATALOGUE_ART_BATCH14)&&!(id in CATALOGUE_ART_BATCH15)&&!(id in CATALOGUE_ART_BATCH16)&&!(id in CATALOGUE_ART_BATCH17)&&!(id in CATALOGUE_ART_BATCH18)&&!(id in CATALOGUE_ART_BATCH19)&&!(id in CATALOGUE_ART_BATCH20)&&!(id in CATALOGUE_ART_BATCH21)&&!(id in CATALOGUE_ART_BATCH22)&&!(id in CATALOGUE_ART_BATCH23)&&!(id in CATALOGUE_ART_BATCH24)&&!(id in CATALOGUE_ART_BATCH25)&&!(id in CATALOGUE_ART_BATCH26)&&!(id in CATALOGUE_ART_BATCH27)&&!(id in CATALOGUE_ART_BATCH28)&&!(id in CATALOGUE_ART_BATCH29)).length,53)
 assert.match(movementFor('0276').steps[1],/opposite leg/)
 assert.match(movementFor('0262').steps[1],/both feet remain grounded/)
 assert.match(movementFor('3639').steps[1],/shoulders stay on the mat/)
})


test('Core and Batch 9/10/11/12 artwork map only the reviewed IDs to verified derivative assets',()=>{
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
 const batch9=['0279','0283','0284','0285','0291','0293','0295','0298','0299','0300','0301','0302','0309','0311','1201','1646','1647','1648','1654','1731','2137','3016','3545','3635','3769']
 const batch10=['0023','0024','0026','0028','0029','0030','0031','0033','0034','0035','0036','0037','0038','0039','0041','0042','0043','1013','1016','1017','1255','1316','1369','1370','2407']
 const batch11=['0044','0046','0047','0048','0049','0050','0051','0052','0053','0054','0055','0056','0057','0058','0059','0063','1409','1410','1435','1461','1462','1545','1719','1720','3562']
 const batch12=['0022','0045','0060','0061','0064','0065','0066','0067','0068','0069','0070','0072','0073','0074','0075','0076','0077','0078','0079','0080','1411','1412','1751','2187','3017']
 const batch15=['0119','0121','0122','1258','0124','0123','0126','0125','0127','3212','0128','3360','1259','0129','1399','0130','0139','0140','3543','1771','1374','1160','1494','0148','0151']
 for(const id of [...repaired,...newest,...batch7,...batch8,...batch9,...batch10,...batch11,...batch12,...batch15]){
  const asset=movementFor(id)
  assert.ok(asset);assert.equal(asset.style,'Nick Style 3 + approved primary likeness')
  assert.match(asset.url,/\.webp$/);assert.match(asset.review.identity,/primary likeness/)
 }
 for(const id of batch12){
  const asset=movementFor(id)
  assert.deepEqual([asset.width,asset.height],[1200,800])
  assert.ok(asset.bytes>100000&&asset.bytes<500000)
  assert.match(asset.review.movement,/corrected after owner feedback/)
 }
 for(const id of batch15){
  const asset=movementFor(id)
  assert.deepEqual([asset.width,asset.height],[1200,800])
  assert.ok(asset.bytes>50000&&asset.bytes<500000)
  assert.match(asset.review.movement,/corrected cards replaced/)
 }
 assert.match(movementFor('0064').leftLabel,/Full bar/)
 assert.match(movementFor('0065').steps[0],/balance point/)
 assert.match(movementFor('0066').steps[0],/parallel to the feet/)
 assert.match(movementFor('0075').steps[0],/behind the body/)
 assert.match(movementFor('0076').steps[0],/elbows bending/)
})

test('Library coverage matches rendered assets while claims stay separate from verified live coverage',()=>{
 const installer=fs.readFileSync(new URL('./upgrade_first_use.py',import.meta.url),'utf8')
 assert(installer.includes(`likeness illustrations are available for ${Object.keys(MOVEMENT_ILLUSTRATIONS).length} exercises`))
 const progress=JSON.parse(fs.readFileSync(new URL('./artwork-progress.json',import.meta.url)))
 assert.equal(progress.catalogueTotal,1324)
 assert.equal(new Set(progress.entries.map(e=>e.id)).size,1324)
 const deployed=new Set(progress.entries.filter(e=>e.deployed).map(e=>e.id))
 assert.equal(progress.catalogueIllustrated,deployed.size)
 assert.equal(progress.catalogueQueued,1324-deployed.size)
 assert([...deployed].every(id=>movementFor(id)))
 const claim=progress.currentBatch.exactIds
 assert(claim.length>0&&claim.length<=25&&new Set(claim).size===claim.length)
 assert(claim.every(id=>progress.entries.some(e=>e.id===id)))
 if(progress.currentBatch.status.startsWith('DEPLOYED')||progress.currentBatch.status==='VERIFIED_LIVE') assert(claim.every(id=>deployed.has(id)))
 else assert(claim.every(id=>!deployed.has(id)))
 if(progress.currentBatch.status.startsWith('REVIEWED_WIX_MEDIA_READY')) assert(claim.every(id=>movementFor(id)))
})
test('Batch 16 exact-ID cards have unique URLs, reviewed dimensions and movement-specific accessible coaching',()=>{
 const entries=Object.entries(CATALOGUE_ART_BATCH16)
 assert.equal(entries.length,25)
 assert.equal(new Set(entries.map(([,a])=>a.url)).size,25)
 for(const [id,a] of entries){
  assert.equal(a.id,id);assert.equal(movementFor(id),a)
  assert.deepEqual([a.width,a.height],[1200,800]);assert(a.bytes>50000&&a.bytes<500000)
  assert.match(a.url,/^https:\/\/static\.wixstatic\.com\/media\/[A-Za-z0-9_~.-]+\.webp$/)
  assert.match(a.sha256,/^[0-9a-f]{64}$/)
  assert.equal(a.coaching.length,4);assert(a.coaching.every(x=>x.length>20))
 }
 assert.match(CATALOGUE_ART_BATCH16['0149'].rightLabel,/overhead/)
 assert.match(CATALOGUE_ART_BATCH16['3235'].coaching[1],/whole body lowers from the knees/)
 assert.match(CATALOGUE_ART_BATCH16['0158'].coaching[0],/head resting/)
 assert.match(CATALOGUE_ART_BATCH16['0168'].coaching[1],/inward/)
 assert.match(CATALOGUE_ART_BATCH16['0155'].coaching[0],/high handles/)
 assert.match(CATALOGUE_ART_BATCH16['0155'].coaching[1],/down and together/)
})

test('Batch 17 exact-ID cards have unique URLs, reviewed dimensions and movement-specific accessible coaching',()=>{
 const entries=Object.entries(CATALOGUE_ART_BATCH17)
 assert.equal(entries.length,25)
 assert.equal(new Set(entries.map(([,a])=>a.url)).size,25)
 for(const [id,a] of entries){
  assert.equal(a.id,id);assert.equal(movementFor(id),a)
  assert.deepEqual([a.width,a.height],[1200,800]);assert(a.bytes>50000&&a.bytes<500000)
  assert.match(a.url,/^https:\/\/static\.wixstatic\.com\/media\/[A-Za-z0-9_~.-]+\.webp$/)
  assert.match(a.sha256,/^[0-9a-f]{64}$/)
  assert.equal(a.coaching.length,4);assert(a.coaching.every(x=>x.length>20))
 }
 assert.match(CATALOGUE_ART_BATCH17['0172'].coaching[1],/fixed elbow bend/)
 assert.match(CATALOGUE_ART_BATCH17['0186'].coaching[0],/floor mat/)
 assert.match(CATALOGUE_ART_BATCH17['1262'].coaching[0],/below your hips/)
 assert.match(CATALOGUE_ART_BATCH17['1263'].coaching[0],/hips level/)
})

test('Batch 18 exact-ID cards have unique URLs, reviewed dimensions and movement-specific accessible coaching',()=>{
 const entries=Object.entries(CATALOGUE_ART_BATCH18)
 assert.equal(entries.length,25)
 assert.equal(new Set(entries.map(([,a])=>a.url)).size,25)
 for(const [id,a] of entries){
  assert.equal(a.id,id);assert.equal(movementFor(id),a)
  assert.deepEqual([a.width,a.height],[1200,800]);assert(a.bytes>50000&&a.bytes<500000)
  assert.match(a.url,/^https:\/\/static\.wixstatic\.com\/media\/[A-Za-z0-9_~.-]+\.webp$/)
  assert.match(a.sha256,/^[0-9a-f]{64}$/)
  assert.equal(a.coaching.length,4);assert(a.coaching.every(x=>x.length>20))
 }
 assert.match(CATALOGUE_ART_BATCH18['2414'].coaching[0],/both hands/)
 assert.match(CATALOGUE_ART_BATCH18['0105'].coaching[1],/neck clearance/)
 assert.match(CATALOGUE_ART_BATCH18['0137'].coaching[1],/both elbows together/)
 assert.match(CATALOGUE_ART_BATCH18['0191'].coaching[1],/down and inward/)
 assert.match(CATALOGUE_ART_BATCH18['1635'].coaching[0],/palm down/)
 assert.match(CATALOGUE_ART_BATCH18['3165'].coaching[1],/same towel and anchor/)
 assert.match(CATALOGUE_ART_BATCH18['1723'].coaching[2],/free hand/)
})
test('Batch 20 binds exact catalogue names, equipment and unique media while preserving predecessor records',()=>{
 const text=fs.readFileSync(process.env.TV_CATALOGUE_PATH,'utf8')
 const catalogue=new Map(JSON.parse(text.slice(text.indexOf('[')).trim().replace(/;$/,'')).map(ex=>[ex.id,ex]))
 assert.equal(Object.keys(CATALOGUE_ART_BATCH20).length,25)
 assert.equal(new Set(Object.values(CATALOGUE_ART_BATCH20).map(a=>a.url)).size,25)
 for(const [id,a] of Object.entries(CATALOGUE_ART_BATCH20)){
  assert.equal(a.id,id);assert.equal(a.name,catalogue.get(id).n);assert.equal(a.equipment,catalogue.get(id).eq)
  assert.equal(movementFor(id),a);assert.deepEqual([a.width,a.height],[1200,800]);assert.match(a.sha256,/^[0-9a-f]{64}$/)
  assert.equal(a.coaching.length,4);assert.ok(a.coaching.every(x=>x.length>20))
 }
 assert.match(CATALOGUE_ART_BATCH20['2331'].coaching[0],/fan-bike saddle/)
 assert.match(CATALOGUE_ART_BATCH20['0216'].coaching[0],/floor/)
 assert.match(CATALOGUE_ART_BATCH20['1726'].coaching[0],/whole head/)
 assert.match(CATALOGUE_ART_BATCH20['0214'].coaching[1],/other arm stays forward/)
})

test('Batch 21 preserves exact catalogue bindings and source-specific coaching',()=>{
 const text=fs.readFileSync(process.env.TV_CATALOGUE_PATH,'utf8')
 const catalogue=new Map(JSON.parse(text.slice(text.indexOf('[')).trim().replace(/;$/,'')).map(ex=>[ex.id,ex]))
 assert.equal(Object.keys(CATALOGUE_ART_BATCH21).length,25)
 assert.equal(new Set(Object.values(CATALOGUE_ART_BATCH21).map(a=>a.url)).size,25)
 for(const [id,a] of Object.entries(CATALOGUE_ART_BATCH21)){
  assert.equal(a.id,id);assert.equal(a.name,catalogue.get(id).n);assert.equal(a.equipment,catalogue.get(id).eq)
  assert.equal(movementFor(id),a);assert.deepEqual([a.width,a.height],[1200,800]);assert.match(a.sha256,/^[0-9a-f]{64}$/)
  assert.equal(a.coaching.length,4);assert(a.coaching.every(x=>x.length>20))
 }
 assert.match(CATALOGUE_ART_BATCH21['0296'].coaching[0],/one vertical dumbbell/)
 assert.match(CATALOGUE_ART_BATCH21['1649'].coaching[0],/Sit upright/)
 assert.match(CATALOGUE_ART_BATCH21['1275'].coaching[0],/advanced depth push-up/)
 assert.match(CATALOGUE_ART_BATCH21['0303'].coaching[0],/head lower than your hips/)
 assert.match(CATALOGUE_ART_BATCH21['0307'].coaching[1],/elbow bend nearly unchanged/)
})

test('Batch22 exact IDs, source-specific cues and expression-only prior revisions are bound',()=>{
 const text=fs.readFileSync(process.env.TV_CATALOGUE_PATH,'utf8')
 const catalogue=new Map(JSON.parse(text.slice(text.indexOf('[')).trim().replace(/;$/,'')).map(ex=>[ex.id,ex]))
 assert.equal(Object.keys(CATALOGUE_ART_BATCH22).length,25)
 assert.equal(new Set(Object.values(CATALOGUE_ART_BATCH22).map(a=>a.url)).size,25)
 for(const [id,a] of Object.entries(CATALOGUE_ART_BATCH22)){
  assert.equal(a.id,id);assert.equal(a.name,catalogue.get(id).n);assert.equal(a.equipment,catalogue.get(id).eq)
  assert.equal(movementFor(id),a);assert.deepEqual([a.width,a.height],[1200,800]);assert.match(a.sha256,/^[0-9a-f]{64}$/)
  assert.equal(a.coaching.length,4);assert(a.coaching.every(x=>x.length>20));assert(a.review.expression.length>30)
 }
 assert.match(CATALOGUE_ART_BATCH22['1437'].coaching[0],/forearm supported/)
 assert.match(CATALOGUE_ART_BATCH22['1732'].coaching[0],/one dumbbell held securely in both hands/)
 assert.match(CATALOGUE_ART_BATCH22['0318'].coaching[1],/alternate/)
 assert.match(CATALOGUE_ART_BATCH22['1279'].coaching[1],/elbow bend nearly unchanged/)
 for(const id of ['2403','0286','1649','1652','1655','1656'])assert.match(CATALOGUE_ART_BATCH21[id].review.identity,/expression revised/)
})


test('Batch23 exact IDs retain source-specific movement distinctions and four coaching cues',()=>{
 const text=fs.readFileSync(process.env.TV_CATALOGUE_PATH,'utf8')
 const catalogue=new Map(JSON.parse(text.slice(text.indexOf('[')).trim().replace(/;$/,'')).map(ex=>[ex.id,ex]))
 assert.equal(Object.keys(CATALOGUE_ART_BATCH23).length,25)
 assert.equal(new Set(Object.values(CATALOGUE_ART_BATCH23).map(a=>a.url)).size,25)
 for(const [id,a] of Object.entries(CATALOGUE_ART_BATCH23)){
  assert.equal(a.name,catalogue.get(id).n);assert.equal(a.equipment,catalogue.get(id).eq)
  assert.equal(movementFor(id),a);assert.deepEqual([a.width,a.height],[1200,800]);assert.match(a.sha256,/^[0-9a-f]{64}$/)
  assert.equal(a.coaching.length,4);assert(a.coaching.every(x=>x.length>20));assert(a.review.expression.length>20)
 }
 assert.match(CATALOGUE_ART_BATCH23['0325'].coaching[1],/arms forward/)
 assert.match(CATALOGUE_ART_BATCH23['0328'].coaching[1],/elbow angle nearly unchanged/)
 assert.match(CATALOGUE_ART_BATCH23['1733'].coaching[0],/one light dumbbell securely in both hands/)
 assert.match(CATALOGUE_ART_BATCH23['1729'].coaching[1],/other stays extended/)
 assert.match(CATALOGUE_ART_BATCH23['0339'].coaching[0],/face-down/)
 assert.match(CATALOGUE_ART_BATCH23['0340'].coaching[0],/palms inward/)
})


test('Batch24 exact IDs retain source-specific movement distinctions and four coaching cues',()=>{
 const text=fs.readFileSync(process.env.TV_CATALOGUE_PATH,'utf8')
 const catalogue=new Map(JSON.parse(text.slice(text.indexOf('[')).trim().replace(/;$/,'')).map(ex=>[ex.id,ex]))
 assert.equal(Object.keys(CATALOGUE_ART_BATCH24).length,25)
 assert.equal(new Set(Object.values(CATALOGUE_ART_BATCH24).map(a=>a.url)).size,25)
 for(const [id,a] of Object.entries(CATALOGUE_ART_BATCH24)){
  assert.equal(a.name,catalogue.get(id).n);assert.equal(a.equipment,catalogue.get(id).eq)
  assert.equal(movementFor(id),a);assert.deepEqual([a.width,a.height],[1200,800]);assert.match(a.sha256,/^[0-9a-f]{64}$/)
  assert.equal(a.coaching.length,4);assert(a.coaching.every(x=>x.length>20));assert(a.review.expression.length>20)
 }
 assert.match(CATALOGUE_ART_BATCH24['0344'].coaching[0],/pronated/)
 assert.match(CATALOGUE_ART_BATCH24['0346'].coaching[0],/reverse grip/)
 assert.match(CATALOGUE_ART_BATCH24['1284'].coaching[0],/head, neck and upper back/)
 assert.match(CATALOGUE_ART_BATCH24['1328'].coaching[1],/elbows outward/)
 assert.match(CATALOGUE_ART_BATCH24['1735'].coaching[0],/both hands/)
 assert.match(CATALOGUE_ART_BATCH24['0352'].coaching[0],/palms facing each other/)
 assert.match(CATALOGUE_ART_BATCH24['1287'].coaching[0],/decline bench/)
 assert.match(CATALOGUE_ART_BATCH24['1663'].coaching[0],/thumb upward/)
})


test('Batch25 exact IDs retain source-specific movement distinctions and four coaching cues',()=>{
 const text=fs.readFileSync(process.env.TV_CATALOGUE_PATH,'utf8')
 const catalogue=new Map(JSON.parse(text.slice(text.indexOf('[')).trim().replace(/;$/,'')).map(ex=>[ex.id,ex]))
 assert.equal(Object.keys(CATALOGUE_ART_BATCH25).length,25)
 assert.equal(new Set(Object.values(CATALOGUE_ART_BATCH25).map(a=>a.url)).size,25)
 for(const [id,a] of Object.entries(CATALOGUE_ART_BATCH25)){
  assert.equal(a.name,catalogue.get(id).n);assert.equal(a.equipment,catalogue.get(id).eq)
  assert.equal(movementFor(id),a);assert.deepEqual([a.width,a.height],[1200,800]);assert.match(a.sha256,/^[0-9a-f]{64}$/)
  assert.equal(a.coaching.length,4);assert(a.coaching.every(x=>x.length>20));assert(a.review.expression.length>20)
 }
 assert.match(CATALOGUE_ART_BATCH25['1621'].coaching[0],/palm facing inward/)
 assert.match(CATALOGUE_ART_BATCH25['1289'].coaching[1],/opposite weight stays still/)
 assert.match(CATALOGUE_ART_BATCH25['1291'].coaching[1],/steady elbow bend/)
 assert.match(CATALOGUE_ART_BATCH25['1414'].coaching[0],/palm-down/)
 assert.match(CATALOGUE_ART_BATCH25['1415'].coaching[1],/thumb side/)
 assert.match(CATALOGUE_ART_BATCH25['0361'].coaching[1],/opposite weight stays/)
 assert.match(CATALOGUE_ART_BATCH25['0360'].coaching[0],/empty hand/)
 assert.match(CATALOGUE_ART_BATCH25['0364'].coaching[0],/palm-up/)

})


test('Batch26 exact IDs retain source-specific movement distinctions and four coaching cues',()=>{
 const text=fs.readFileSync(process.env.TV_CATALOGUE_PATH,'utf8')
 const catalogue=new Map(JSON.parse(text.slice(text.indexOf('[')).trim().replace(/;$/,'')).map(ex=>[ex.id,ex]))
 assert.equal(Object.keys(CATALOGUE_ART_BATCH26).length,25)
 assert.equal(new Set(Object.values(CATALOGUE_ART_BATCH26).map(a=>a.url)).size,25)
 for(const [id,a] of Object.entries(CATALOGUE_ART_BATCH26)){
  assert.equal(a.name,catalogue.get(id).n);assert.equal(a.equipment,catalogue.get(id).eq)
  assert.equal(movementFor(id),a);assert.deepEqual([a.width,a.height],[1200,800]);assert.match(a.sha256,/^[0-9a-f]{64}$/)
  assert.equal(a.coaching.length,4);assert(a.coaching.every(x=>x.length>20));assert(a.review.expression.length>20)
 }
 assert.match(CATALOGUE_ART_BATCH26['1672'].coaching[1],/turn the palm down/)
 assert.match(CATALOGUE_ART_BATCH26['1292'].coaching[0],/plant one foot/)
 assert.match(CATALOGUE_ART_BATCH26['0365'].coaching[0],/palms facing each other/)
 assert.match(CATALOGUE_ART_BATCH26['1441'].coaching[0],/palm-down/)
 assert.match(CATALOGUE_ART_BATCH26['0367'].coaching[0],/palm-up/)
 assert.match(CATALOGUE_ART_BATCH26['1329'].coaching[1],/opposite weight hangs/)
 assert.match(CATALOGUE_ART_BATCH26['0371'].coaching[2],/Do not add a jump/)
 assert.match(CATALOGUE_ART_BATCH26['0372'].coaching[0],/one upper arm/)
 assert.match(CATALOGUE_ART_BATCH26['1294'].coaching[1],/lift your hips/)
 assert.match(CATALOGUE_ART_BATCH26['1295'].coaching[1],/hips level/)
 assert.match(CATALOGUE_ART_BATCH26['0376'].coaching[1],/bent-elbow raise/)
 assert.match(CATALOGUE_ART_BATCH26['2292'].coaching[1],/standing demonstration/)


})

test('Batch27 exact catalogue mapping preserves reverse grips, support and alternating mechanics',()=>{
 const text=fs.readFileSync(process.env.TV_CATALOGUE_PATH,'utf8')
 const catalogue=new Map(JSON.parse(text.slice(text.indexOf('[')).trim().replace(/;$/,'')).map(ex=>[ex.id,ex]))
 assert.equal(Object.keys(CATALOGUE_ART_BATCH27).length,25)
 assert.equal(new Set(Object.values(CATALOGUE_ART_BATCH27).map(a=>a.url)).size,25)
 for(const [id,a] of Object.entries(CATALOGUE_ART_BATCH27)){
  assert.equal(a.name,catalogue.get(id).n);assert.equal(a.equipment,catalogue.get(id).eq)
  assert.equal(movementFor(id),a);assert.deepEqual([a.width,a.height],[1200,800]);assert.match(a.sha256,/^[0-9a-f]{64}$/)
  assert.equal(a.coaching.length,4);assert(a.coaching.every(x=>x.length>20));assert(a.review.expression.length>20)
 }
 assert.match(CATALOGUE_ART_BATCH27['0379'].coaching[2],/bodyweight through the head/)
 assert.match(CATALOGUE_ART_BATCH27['1624'].coaching[0],/head and upper back supported/)
 assert.match(CATALOGUE_ART_BATCH27['1330'].coaching[0],/empty hand/)
 assert.match(CATALOGUE_ART_BATCH27['1331'].coaching[1],/both weights together/)
 assert.match(CATALOGUE_ART_BATCH27['0384'].coaching[1],/overhand grip/)
 assert.match(CATALOGUE_ART_BATCH27['1675'].coaching[0],/chest-down/)
 assert.match(CATALOGUE_ART_BATCH27['2397'].coaching[1],/arms still softly bent/)
 assert.match(CATALOGUE_ART_BATCH27['0387'].coaching[1],/lower it fully and then raise the opposite/)
 assert.match(CATALOGUE_ART_BATCH27['1676'].coaching[1],/thumb leading/)
 assert.match(CATALOGUE_ART_BATCH27['1730'].coaching[1],/then extend the other/)
 assert.match(CATALOGUE_ART_BATCH27['1737'].coaching[1],/both elbows backward together/)
 assert.match(CATALOGUE_ART_BATCH27['3547'].coaching[1],/reverse that sequence/)
 assert.match(CATALOGUE_ART_BATCH27['0394'].coaching[0],/empty hand/)
})

test('Batch28 exact catalogue mapping preserves neutral and reverse grips, support and alternating mechanics',()=>{
 const text=fs.readFileSync(process.env.TV_CATALOGUE_PATH,'utf8')
 const catalogue=new Map(JSON.parse(text.slice(text.indexOf('[')).trim().replace(/;$/,'')).map(ex=>[ex.id,ex]))
 assert.equal(Object.keys(CATALOGUE_ART_BATCH28).length,25)
 assert.equal(new Set(Object.values(CATALOGUE_ART_BATCH28).map(a=>a.url)).size,25)
 for(const [id,a] of Object.entries(CATALOGUE_ART_BATCH28)){
  assert.equal(a.name,catalogue.get(id).n);assert.equal(a.equipment,catalogue.get(id).eq)
  assert.equal(movementFor(id),a);assert.deepEqual([a.width,a.height],[1200,800]);assert.match(a.sha256,/^[0-9a-f]{64}$/)
  assert.equal(a.coaching.length,4);assert(a.coaching.every(x=>x.length>20));assert(a.review.expression.length>20)
 }
 assert.match(CATALOGUE_ART_BATCH28['0397'].coaching[1],/small wrist arc/)
 assert.match(CATALOGUE_ART_BATCH28['0403'].coaching[1],/overhand grip/)
 assert.match(CATALOGUE_ART_BATCH28['2188'].coaching[1],/both elbows together/)
 assert.match(CATALOGUE_ART_BATCH28['3664'].coaching[0],/support palm below the shoulder/)
 assert.match(CATALOGUE_ART_BATCH28['2805'].coaching[1],/rear toes stay supported/)
 assert.match(CATALOGUE_ART_BATCH28['0415'].coaching[1],/opposite arm forward/)
 assert.match(CATALOGUE_ART_BATCH28['1739'].coaching[1],/return it before extending the opposite/)

})

test('Batch29 exact catalogue mapping preserves neutral and reverse grips, support and alternating mechanics',()=>{
 const text=fs.readFileSync(process.env.TV_CATALOGUE_PATH,'utf8')
 const catalogue=new Map(JSON.parse(text.slice(text.indexOf('[')).trim().replace(/;$/,'')).map(ex=>[ex.id,ex]))
 assert.equal(Object.keys(CATALOGUE_ART_BATCH29).length,25)
 assert.equal(new Set(Object.values(CATALOGUE_ART_BATCH29).map(a=>a.url)).size,25)
 for(const [id,a] of Object.entries(CATALOGUE_ART_BATCH29)){
  assert.equal(a.name,catalogue.get(id).n);assert.equal(a.equipment,catalogue.get(id).eq)
  assert.equal(movementFor(id),a);assert.deepEqual([a.width,a.height],[1200,800]);assert.match(a.sha256,/^[0-9a-f]{64}$/)
  assert.equal(a.coaching.length,4);assert(a.coaching.every(x=>x.length>20));assert(a.review.expression.length>20)
 }
 assert.match(CATALOGUE_ART_BATCH29['1741'].coaching[1],/both elbows backward together/)
 assert.match(CATALOGUE_ART_BATCH29['0422'].coaching[0],/whole working upper arm/)
 assert.match(CATALOGUE_ART_BATCH29['0427'].coaching[1],/palms in/)
 assert.match(CATALOGUE_ART_BATCH29['2293'].coaching[1],/lower overhand/)
 assert.match(CATALOGUE_ART_BATCH29['2796'].coaching[1],/rear foot stays supported/)
 assert.match(CATALOGUE_ART_BATCH29['2812'].coaching[1],/both supported contacts/)
 assert.match(CATALOGUE_ART_BATCH29['0436'].coaching[1],/elbows outward/)
 assert.match(CATALOGUE_ART_BATCH29['0433'].coaching[1],/steady elbow bend/)

})
