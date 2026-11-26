import test from 'node:test'
import assert from 'node:assert/strict'
import { elapsedSeconds, posterClock, posterSetLabel } from './tv-poster.mjs'
test('elapsed time includes background time and crosses midnight', () => {
  const start = Date.parse('2026-11-19T23:59:00Z')
  assert.equal(elapsedSeconds(start, start + 125900), 125)
  assert.equal(elapsedSeconds(start, null, start + 600000), 600)
  assert.equal(posterClock(elapsedSeconds(start, start + 3661000)), '1:01:01')
})
test('missing or reversed timestamps are never invented', () => {
  for (const start of [undefined, NaN, Infinity, 0, -1]) assert.equal(elapsedSeconds(start, 1000), null)
  assert.equal(elapsedSeconds(2000, 1000), null)
  assert.equal(posterClock(null), 'Not recorded')
})
test('reps, holds and cardio retain their different recorded units', () => {
  assert.equal(posterSetLabel('reps', { r: 12, w: 20 }, 'lb'), '12 reps · 20 lb')
  assert.equal(posterSetLabel('time', { sec: 90, w: 0 }, 'lb'), '1:30 hold · no added load')
  assert.equal(posterSetLabel('cardio', { min: 20, speed: 8 }), '20 min · 8 km/h')
  assert.equal(posterSetLabel('reps', { r: 10, w: 20 }), '10 reps · 20 logged units')
})
