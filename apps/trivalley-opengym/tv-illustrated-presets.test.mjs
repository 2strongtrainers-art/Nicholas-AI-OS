import test from 'node:test'
import assert from 'node:assert/strict'
import {ILLUSTRATED_EXERCISES, ILLUSTRATED_POSTERS, NICK_POSTER_ART, illustratedArtFor} from './tv-illustrated-presets.mjs'
import {posterRoutine,installPoster} from './tv-learning.mjs'
import {serializeWorkoutBackup,parseWorkoutBackup} from './tv-backup.mjs'
test('four new sessions have exact side-specific entries, safe art regions and both requested visual styles',()=>{
 assert.equal(ILLUSTRATED_POSTERS.length,4);assert.equal(ILLUSTRATED_EXERCISES.length,18)
 assert.equal(new Set(ILLUSTRATED_EXERCISES.map(d=>d.id)).size,18)
 const styles=new Set(),urls=new Set()
 for(const d of ILLUSTRATED_EXERCISES){const a=illustratedArtFor(d);assert.ok(a);styles.add(a.style);urls.add(a.url);assert.ok(a.top>=0&&a.cropHeight>0&&a.top+a.cropHeight<=a.height);assert.equal(new URL(a.url).hostname,'static.wixstatic.com');assert.ok(d.st.length>=3)}
 assert.deepEqual([...styles].sort(),['Dumbbell','TRX']);assert.equal(urls.size,5)
 for(const key of ['supported-reverse-lunge','bird-dog','deadbug','supported-row']){
  const sides=ILLUSTRATED_EXERCISES.filter(d=>d.id.includes(key));assert.equal(sides.length,2);assert.ok(sides[0].id.endsWith('left'));assert.ok(sides[1].id.endsWith('right'))
 }
})
test('edited identity, equipment or instructions never receive a mismatched illustration',()=>{
 const original=ILLUSTRATED_EXERCISES[0];assert.ok(illustratedArtFor(original))
 for(const change of [{n:'My renamed move'},{eq:'barbell'},{pose:'squat'},{st:['Do something different']},{tvPosterVersion:2}])assert.equal(illustratedArtFor({...original,...change}),null)
})
test('weighted entries require an explicit load and automatic increases remain off',()=>{
 for(const p of ILLUSTRATED_POSTERS){const r=posterRoutine(p.key);assert.equal(r.ex.length,p.ex.length)
  for(const cfg of r.ex){const d=ILLUSTRATED_EXERCISES.find(d=>d.id===cfg.id);assert.ok(d);assert.equal(cfg.weight,0);assert.equal(cfg.prog,'off');assert.equal(!!cfg.loadRequired,d.eq==='dumbbell');assert.ok(cfg.reps>=cfg.repsMin&&cfg.repsMin>0)}
 }
})
test('saving all new sessions preserves existing logs, occupied days, active session and edits on replay',async()=>{
 const s={routines:[{id:'keep',name:'Existing',ex:[]}],customEx:[],week:{1:'keep'},dayPlan:{'2026-11-21':'rest'},workouts:[{id:'old',entries:[]}],active:{id:'active',entries:[]},unit:'lb',exWeights:{},bodyweight:[]},before=structuredClone(s)
 for(const p of ILLUSTRATED_POSTERS)installPoster(s,p.key,()=>p.key)
 assert.equal(s.routines.length,5);assert.equal(s.customEx.length,18)
 for(const k of ['week','dayPlan','workouts','active','bodyweight'])assert.deepEqual(s[k],before[k])
 s.routines[1].ex[0].reps=7;const installed=structuredClone(s)
 for(const p of ILLUSTRATED_POSTERS)assert.equal(installPoster(s,p.key,()=>{throw Error('duplicate')} ).added,false)
 assert.deepEqual(s,installed)
 const backup=await parseWorkoutBackup(await serializeWorkoutBackup(s));assert.ok(backup.verified);assert.deepEqual(backup.state,s)
})
