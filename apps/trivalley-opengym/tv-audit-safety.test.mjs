import test from 'node:test'
import assert from 'node:assert/strict'
import { hasWeightData, recoverRest } from './tv-audit-safety.mjs'
import { suggestExerciseQuery, sortExerciseMatches } from './tv-exercise-search.mjs'
import { addMuscleSplit, programPosition, MUSCLE_SPLIT } from './tv-programs.mjs'
import { serializeWorkoutBackup, parseWorkoutBackup } from './tv-backup.mjs'

test('unit lock protects each store of weight data without locking an empty starter program', () => {
  assert.equal(hasWeightData({routines:[{ex:[{weight:0}]}]}),false)
  for(const state of [{bodyweight:[{w:70}]},{targetW:100},{exWeights:{x:{w:20}}},{routines:[{ex:[{weight:10}]}]},
    {active:{entries:[{sets:[{w:25}]}]}},{workouts:[{entries:[{sets:[{w:15,done:true}]}]}]}]) assert.equal(hasWeightData(state),true)
})
test('rest recovery preserves original wall-clock deadline and rejects expired, malformed and other-session timers', () => {
  const timer={sessionId:'my-workout',endsAt:121000,total:120}
  assert.deepEqual(recoverRest(JSON.stringify(timer),'my-workout',61000),{...timer,left:60})
  for(const [raw,id,now] of [[timer,'another-workout',61000],[timer,'my-workout',122000],[timer,null,61000],['{','my-workout',1000],[{...timer,total:-1},'my-workout',1000]]) assert.equal(recoverRest(raw,id,now),null)
})
test('bounded spelling suggestions preserve exact-match ranking and require a real exercise name', () => {
  const exercises=[{id:'a',n:'dumbbell hammer curl'},{id:'b',n:'hammer curl'},{id:'c',n:'dumbbell biceps curl'}]
  assert.equal(suggestExerciseQuery(exercises,'hamer curl'),'hammer curl')
  assert.equal(sortExerciseMatches(exercises,'hammer curl')[0].id,'b')
  assert.equal(suggestExerciseQuery(exercises,'zzzzzzz'),null)
})
test('saving and restoring a partial workout keeps its program day; completed and legacy records still advance', async () => {
  const S={unit:'lb',routines:[],workouts:[],bodyweight:[],week:{},active:null};let id=0
  addMuscleSplit(S,{makeId:()=>`test-${++id}`})
  const w={id:'partial',d:'2026-11-19',start:10,end:100,partial:true,plannedSets:13,tvTemplate:{id:MUSCLE_SPLIT.id,day:'back-biceps'},entries:[{id:'2330',sets:[{w:25,r:10,done:true}]}]}
  S.workouts.push(w)
  assert.equal(programPosition(S,1000).index,0)
  const restored=await parseWorkoutBackup(await serializeWorkoutBackup(S))
  assert.equal(restored.state.workouts[0].partial,true)
  assert.equal(programPosition(restored.state,1000).index,0)
  S.workouts[0].partial=false;assert.equal(programPosition(S,1000).index,1)
  delete S.workouts[0].partial;assert.equal(programPosition(S,1000).index,1)
})
