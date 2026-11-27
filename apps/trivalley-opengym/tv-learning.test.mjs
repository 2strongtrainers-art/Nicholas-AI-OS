import test from 'node:test'
import assert from 'node:assert/strict'
import {LESSONS,POSTER_EXERCISES,QUICK_POSTERS,posterExercise,posterRoutine,savedPosterRoutine,installPoster,proteinPortion} from './tv-learning.mjs'
import {serializeWorkoutBackup,parseWorkoutBackup} from './tv-backup.mjs'
const state=()=>({routines:[{id:'keep',name:'My existing routine',ex:[{id:'2330',sets:3,reps:10,weight:75}]}],customEx:[{id:'mine',n:'Keep my exercise'}],workouts:[{id:'old',entries:[{id:'2330',sets:[{w:75,r:10,done:true}]}]}],bodyweight:[{d:'2026-11-19',w:190}],week:{1:'keep'},dayPlan:{'2026-11-21':'rest'},active:{id:'in-progress',routineId:'keep',entries:[]},exWeights:{2330:{w:75}},unit:'lb'})
test('all five lessons have unique routes, real actions and nonempty original sections',()=>{
 assert.equal(LESSONS.length,5);assert.equal(new Set(LESSONS.map(l=>l.slug)).size,5)
 const routes=new Set(['/posters','/plan','/stats','/library'])
 for(const l of LESSONS){assert.equal(l.sections.length,3);assert.ok(l.sections.every(([title,text])=>title&&text.length>60));assert.ok(routes.has(l.action.to));assert.ok(l.source.startsWith('https://'))}
})
test('posters use distinct supported definitions, no starting load and no automatic progression',()=>{
 assert.equal(QUICK_POSTERS.length,7);assert.equal(POSTER_EXERCISES.length,26)
 for(const p of QUICK_POSTERS){const r=posterRoutine(p.key);assert.equal(new Set(r.ex.map(x=>x.id)).size,r.ex.length);for(const c of r.ex){assert.ok(posterExercise(c.id));assert.equal(c.weight,0);assert.equal(c.prog,'off');assert.ok(c.tvPoster);assert.equal(c.sets,2);assert.ok(c.mode==='time'?c.sec>0:c.reps>0)}}
 const core=posterRoutine('plank-practice').ex;assert.ok(core[1].id.endsWith('side-left'));assert.ok(core[2].id.endsWith('side-right'));assert.equal(core[1].sec,core[2].sec)
 const circuit=posterRoutine('easy-circuit').ex;assert.ok(circuit.every(c=>c.sg===circuit[0].sg&&c.mode==='time'&&c.sec===30));assert.deepEqual(circuit.map(x=>x.restSec),[0,0,60])
})
test('previews are detached and never install custom exercises or modify the plan',()=>{
 const S=state(),before=structuredClone(S),r=posterRoutine('lower-body');r.ex[0].reps=999
 assert.deepEqual(S,before);assert.equal(posterRoutine('lower-body').ex[0].reps,8);assert.equal(savedPosterRoutine(S,'lower-body'),null)
})
test('installation appends only required exercises and a routine, leaving the active session and records intact',()=>{
 const S=state(),before=structuredClone(S);assert.deepEqual(installPoster(S,'lower-body',()=> 'new'),{id:'new',added:true})
 assert.equal(S.customEx.length,4);assert.equal(S.routines.length,2);assert.deepEqual(S.routines[0],before.routines[0]);assert.deepEqual(S.customEx[0],before.customEx[0]);for(const key of ['active','workouts','bodyweight','week','dayPlan','exWeights','unit'])assert.deepEqual(S[key],before[key])
 S.routines[1].ex[0].reps=6;const saved=structuredClone(S);assert.deepEqual(installPoster(S,'lower-body',()=>{throw Error('must not allocate')}),{id:'new',added:false});assert.deepEqual(S,saved)
})
test('colliding custom exercise or routine IDs and unknown keys fail before mutation',()=>{
 for(const scenario of ['exercise','routine','unknown']){const S=state();if(scenario==='exercise')S.customEx.push({id:posterRoutine('lower-body').ex[0].id,n:'My unrelated exercise'});const before=structuredClone(S);assert.throws(()=>installPoster(S,scenario==='unknown'?'missing':'lower-body',()=>scenario==='routine'?'keep':'new'));assert.deepEqual(S,before)}
})
test('shared custom exercise definitions deduplicate across posters and backup/restore retains all data',async()=>{
 const S=state();installPoster(S,'lower-body',()=> 'lower');installPoster(S,'plank-practice',()=> 'core');installPoster(S,'easy-circuit',()=> 'circuit');assert.equal(S.customEx.length,9);assert.equal(new Set(S.customEx.map(x=>x.id)).size,9)
 const restored=await parseWorkoutBackup(await serializeWorkoutBackup(S));assert.ok(restored.verified);assert.deepEqual(restored.state,S)
})
test('label scaling is exact before display rounding and blank/invalid/inconsistent values are rejected',()=>{
 assert.deepEqual(proteinPortion({servingGrams:'200',proteinGrams:'20',wantedProtein:'25'}),{foodGrams:250,servings:1.25,wantedProtein:25})
 assert.equal(proteinPortion({servingGrams:100,proteinGrams:12,wantedProtein:25}).foodGrams,100*25/12)
 for(const change of [{proteinGrams:''},{servingGrams:0},{wantedProtein:NaN},{proteinGrams:201},{wantedProtein:201},{servingGrams:'Infinity'},{proteinGrams:0.01,wantedProtein:200}])assert.throws(()=>proteinPortion({servingGrams:200,proteinGrams:20,wantedProtein:25,...change}))
})
