import test from 'node:test'
import assert from 'node:assert/strict'
import { showGettingStarted, contentHeight } from './tv-navigation.mjs'

test('welcome is for new trainees, without marking returning records or changing state', () => {
  const s = {workouts:[],routines:[{id:'custom'}]}, before = structuredClone(s)
  assert.equal(showGettingStarted(s),true)
  assert.deepEqual(s,before)
  assert.equal(showGettingStarted({...s,tvSetupDone:true}),false)
  assert.equal(showGettingStarted({...s,active:{id:'in-progress'}}),false)
  assert.equal(showGettingStarted({...s,workouts:[{entries:[{sets:[{w:25,r:10}]}]}]}),false)
  assert.equal(showGettingStarted({...s,workouts:[{entries:[]}]}),true)
})
test('content is always above dock and adapts to a keyboard viewport', () => {
  for(const [height,dock] of [[667,510],[844,690],[932,780],[400,130]]) {
    assert.equal(contentHeight(height,dock),dock-8)
    assert.ok(contentHeight(height,dock)<dock)
    assert.equal(contentHeight(height,dock,true),height)
  }
  assert.equal(contentHeight(0,500),0)
  assert.equal(contentHeight(400,-10),0)
  assert.equal(contentHeight(400,999),400)
})
