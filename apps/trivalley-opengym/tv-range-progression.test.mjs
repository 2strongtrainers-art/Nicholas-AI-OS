import { describe, it, expect } from 'vitest'
import { nextPrescription } from './progression.js'

const cfg = { id: '0289', mode: 'reps', sets: 3, repsMin: 8, reps: 12, weight: 30, prog: 'double' }
const history = rows => ({ unit: 'kg', workouts: rows.map((reps, i) => ({ d: '2026-11-' + (i + 1), entries: [{ id: cfg.id, target: cfg, sets: reps.map(r => ({ w: 30, r, done: r > 0 })) }] })) })
describe('template rep-range progression', () => {
  it('continues increasing reps instead of deloading three improving sessions below the top', () => {
    const p = nextPrescription(history([[8,8,8],[9,9,9],[10,10,10]]), cfg)
    expect(p.kind).toBe('hold'); expect(p.weight).toBe(30); expect(p.reps).toBe(11)
  })
  it('still deloads three unchanged sessions below the target', () => {
    expect(nextPrescription(history([[9,9,9],[9,9,9],[9,9,9]]), cfg).kind).toBe('deload')
  })
  it('increases load and returns to the bottom after all sets reach the top', () => {
    const p = nextPrescription(history([[12,12,12]]), cfg)
    expect(p.kind).toBe('up'); expect(p.weight).toBe(32.5); expect(p.reps).toBe(8)
  })
  it('does not count an incomplete set as improved performance', () => {
    expect(nextPrescription(history([[10,10,0],[11,11,0],[12,12,0]]), cfg).kind).toBe('deload')
  })
})
