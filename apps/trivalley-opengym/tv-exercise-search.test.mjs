import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeQuery, scoreExercise, sortExerciseMatches} from './tv-exercise-search.mjs'
const exercises = [
  {id:'1', n:'Dumbbell Romanian Deadlift', tg:'Hamstrings', eq:'Dumbbell', st:['Maintain a controlled hinge']},
  {id:'2', n:'Air Bike', tg:'Abs', eq:'Body Weight'},
  {id:'3', n:'Push-Up', tg:'Chest', eq:'Body Weight'},
  {id:'4', n:'Lateral Raise', tg:'Shoulders', eq:'Dumbbell'},
]
test('aliases and exercise-name ranking', () => {
  assert.equal(normalizeQuery('DB RDL'), 'dumbbell romanian deadlift')
  assert.equal(scoreExercise(exercises[0], 'DB RDL'), 120)
  assert.equal(scoreExercise(exercises[2], 'press up'), 120)
  assert.equal(sortExerciseMatches(exercises, 'Air Bike')[0].id, '2')
})
test('name matches outrank equipment and instructional matches', () => {
  const ranked = sortExerciseMatches(exercises, 'Dumbbell')
  assert.equal(ranked[0].id, '1')
  assert.equal(ranked[1].id, '4')
})
test('invalid or empty queries do not fabricate matches', () => {
  assert.equal(sortExerciseMatches(exercises,'zzzzzz').length, 0)
  assert.equal(sortExerciseMatches(exercises,'').length, exercises.length)
})
test('saved and recent priority cannot override an actual text query', () => {
  assert.equal(sortExerciseMatches(exercises,'push up',{recentIds:['1'],favoriteIds:['1']})[0].id,'3')
  assert.equal(sortExerciseMatches(exercises,'',{mode:'recent',recentIds:['4','2']})[0].id,'4')
})
