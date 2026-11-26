import test from 'node:test'
import assert from 'node:assert/strict'
import {setupReview,applySetup,weekSnapshot} from './tv-setup.mjs'
import {addMuscleSplit,installedDays} from './tv-programs.mjs'
let n=0
const makeId=()=>`setup-routine-${++n}`
const state=()=>({unit:'lb',routines:[{id:'existing',name:'My existing workout',ex:[]}],week:{1:'existing',0:'existing'},workouts:[{id:'old-log',note:'keep'}],active:{id:'active',entries:[]},dayOverrides:{'2026-11-21':'existing'}})
test('review is read-only and names replacements before confirmation',()=>{
 const s=state(),before=JSON.stringify(s),r=setupReview(s,'mwf')
 assert.equal(JSON.stringify(s),before)
 assert.deepEqual(r.rows.map(x=>x.day),[1,3,5])
 assert.deepEqual(r.rows[0],{day:1,from:'My existing workout',to:'Back & Biceps'})
})
test('confirmed setup preserves history, active session, other days and overrides',()=>{
 const s=state(),before=structuredClone(s),review=setupReview(s,'mwf')
 const out=applySetup(s,{schedule:'mwf',unit:'lb',expectedWeek:review.snapshot,makeId})
 const days=installedDays(s)
 assert.equal(out.scheduled,3);assert.equal(s.week[1],days[0].id);assert.equal(s.week[3],days[1].id);assert.equal(s.week[5],days[2].id)
 assert.equal(s.week[0],'existing');assert.deepEqual(s.active,before.active);assert.deepEqual(s.workouts,before.workouts);assert.deepEqual(s.dayOverrides,before.dayOverrides)
 assert.equal(s.routines[0].id,'existing');assert.equal(s.tvSetupDone,true)
})
test('moving the same split clears its old days without clearing unrelated routines',()=>{
 const s=state();addMuscleSplit(s,{makeId,schedule:'tts'});const review=setupReview(s,'mwf')
 assert.deepEqual(review.rows.map(x=>x.day),[1,2,3,4,5,6])
 applySetup(s,{schedule:'mwf',unit:'lb',expectedWeek:review.snapshot,makeId})
 for(const day of [2,4,6])assert.equal(s.week[day],null)
 assert.equal(s.week[0],'existing');assert.equal(s.routines.length,4)
 const again=setupReview(s,'mwf');assert.equal(again.rows.length,0)
})
test('a calendar change after review aborts without adding or replacing anything',()=>{
 const s=state(),review=setupReview(s,'mwf');s.week[2]='existing';const before=JSON.stringify(s)
 assert.throws(()=>applySetup(s,{schedule:'mwf',unit:'lb',expectedWeek:review.snapshot,makeId}),/calendar changed/)
 assert.equal(JSON.stringify(s),before)
})
test('flexible mode adds routines while preserving the complete calendar',()=>{
 const s=state(),week=structuredClone(s.week)
 applySetup(s,{schedule:'none',unit:'lb',expectedWeek:weekSnapshot(s),makeId})
 assert.deepEqual(s.week,week);assert.equal(s.tvProgramSchedule,'flexible')
})
test('saved weight data cannot be relabelled through setup',()=>{
 const s=state();s.bodyweight=[{d:'2026-11-19',w:200}];const before=JSON.stringify(s)
 assert.throws(()=>applySetup(s,{schedule:'mwf',unit:'kg',expectedWeek:weekSnapshot(s),makeId}),/locked/)
 assert.equal(JSON.stringify(s),before)
})
