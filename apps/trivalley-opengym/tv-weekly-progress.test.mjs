import test from 'node:test'
import assert from 'node:assert/strict'
import { weeklyProgress } from './tv-weekly-progress.mjs'
const today='2026-11-19', now=Date.parse(today+'T20:00:00Z')
const record=(id,d,reps=8,extra={})=>({id,d,end:Date.parse(d+'T12:00:00Z'),unit:'lb',entries:[{id:'curl',target:{mode:'reps'},sets:[{w:50,r:reps,done:true},{w:50,r:10,done:false}]}],...extra})
test('seven-day card is empty without saved performed work',()=>{
 const p=weeklyProgress({workouts:[],active:record('active',today)},today,now)
 assert.equal(p.sessions,0);assert.equal(p.sets,0);assert.equal(p.trainedDays,0);assert.equal(p.improvement,null)
 assert.equal(p.days.length,7);assert.equal(p.start,'2026-11-13');assert.equal(p.end,today)
})
test('counts partial effort separately, deduplicates and excludes empty and future records',()=>{
 const full=record('a',today),partial=record('b','2026-11-18',9,{partial:true})
 const p=weeklyProgress({workouts:[full,full,partial,record('empty',today,8,{entries:[]}),record('tomorrow','2026-11-20'),record('future-time',today,10,{end:now+60000}),record('invalid','2026-02-30')]},today,now)
 assert.equal(p.sessions,1);assert.equal(p.partial,1);assert.equal(p.sets,2);assert.equal(p.trainedDays,2)
 assert.deepEqual(p.days.at(-2),{day:'2026-11-18',full:0,partial:1})
})
test('uses two exact calendar windows and counts several sessions on one day once for days trained',()=>{
 const p=weeklyProgress({workouts:[record('current-edge','2026-11-13'),record('same-day','2026-11-13'),record('prior-edge','2026-11-06'),record('prior-end','2026-11-12'),record('too-old','2026-11-05')]},today,now)
 assert.equal(p.sessions,2);assert.equal(p.previousSessions,2);assert.equal(p.trainedDays,1)
})
test('shows only recorded same-load, known-unit rep improvements in the displayed window',()=>{
 const a=record('a','2026-11-12',8),b=record('b',today,10)
 assert.equal(weeklyProgress({workouts:[b,a]},today,now).improvement.gain,2)
 assert.equal(weeklyProgress({workouts:[a,{...b,unit:'kg'}]},today,now).improvement,null)
 assert.equal(weeklyProgress({workouts:[{...a,unit:undefined},b]},today,now).improvement,null)
 const heavier=record('c',today,10);heavier.entries[0].sets[0].w=55
 assert.equal(weeklyProgress({workouts:[a,heavier]},today,now).improvement,null)
})
test('does not recycle an old improvement as this week or compare time-mode records',()=>{
 const a=record('a','2026-11-08',8),b=record('b','2026-11-09',10)
 assert.equal(weeklyProgress({workouts:[a,b]},today,now).improvement,null)
 const c=record('c',today,12);c.entries[0].target.mode='time'
 assert.equal(weeklyProgress({workouts:[a,c]},today,now).improvement,null)
})
test('date window crosses DST and year boundaries without counting by elapsed hours',()=>{
 assert.equal(weeklyProgress({},'2026-11-03',now).start,'2026-10-28')
 assert.equal(weeklyProgress({},'2027-01-02',now).start,'2026-12-27')
})
