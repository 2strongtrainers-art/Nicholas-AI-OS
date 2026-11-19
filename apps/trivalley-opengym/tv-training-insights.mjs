// Calendar-based summaries of real completed records. No seeded activity or estimates of gains.
export function validDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const date = new Date(day + 'T12:00:00Z')
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === day
}
export function shiftDay(day, offset) {
  if (!validDay(day)) throw new Error('A valid local calendar date is required')
  const date = new Date(day + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
export function routineOn(S, day) {
  if (!validDay(day)) return null
  const override = S.dayPlan?.[day]
  if (override === 'rest') return null
  const validOverride = (S.routines || []).some(r => r.id === override)
  const id = validOverride ? override : S.week?.[new Date(day + 'T12:00:00Z').getUTCDay()]
  return (S.routines || []).find(r => r.id === id && r.ex?.length) || null
}
export function nextSession(S, today) {
  for (let offset = 0; offset <= 14; offset++) {
    const day = shiftDay(today, offset)
    const routine = routineOn(S, day)
    if (routine) return { day, routine, offset }
  }
  return null
}
const doneSets = w => (w.entries || []).reduce((n, e) => n + (e.sets || []).filter(s => s.done === true).length, 0)
export function completedRecords(S, today) {
  if (!validDay(today)) throw new Error('A valid local calendar date is required')
  const seen = new Set()
  return (S.workouts || []).filter(w => {
    if (!validDay(w.d) || w.d > today || !doneSets(w)) return false
    if (w.id && seen.has(w.id)) return false
    if (w.id) seen.add(w.id)
    return true
  }).sort((a, b) => a.d.localeCompare(b.d) || (a.end || 0) - (b.end || 0))
}
export function progressSummary(S, today) {
  const records = completedRecords(S, today)
  const start = shiftDay(today, -6), prior = shiftDay(today, -13)
  const recent = records.filter(w => w.d >= start)
  const previous = records.filter(w => w.d >= prior && w.d < start)
  const weekday = new Date(today + 'T12:00:00Z').getUTCDay()
  const monday = shiftDay(today, -((weekday + 6) % 7))
  const due = [], trained = new Set(records.map(w => w.d))
  for (let day = monday; day <= today; day = shiftDay(day, 1)) {
    if (routineOn(S, day)) due.push(day)
  }
  return {
    total: records.length, sessions: recent.length, previousSessions: previous.length,
    completedSets: recent.reduce((n, w) => n + doneSets(w), 0),
    scheduledDue: due.length, scheduledDone: due.filter(day => trained.has(day)).length,
    last: records.at(-1) || null
  }
}
// A planning range, not measured workout time. Includes five minutes of preparation,
// 3–5 seconds per rep, configured holds/cardio, rests between sets and transitions.
export function durationRange(S, routine) {
  if (!routine?.ex?.length) return null
  let low = 300, high = 300
  const rest = Math.max(0, Number(S.restSec) || 0)
  for (const cfg of routine.ex) {
    const sets = Math.max(1, Number(cfg.sets) || 1)
    const mode = cfg.mode || (cfg.min != null ? 'cardio' : 'reps')
    const fixed = mode === 'cardio' ? (Number(cfg.min) || 20) * 60
      : mode === 'time' ? (Number(cfg.sec) || 45) : null
    low += sets * (fixed ?? (Number(cfg.reps) || 10) * 3) + (sets - 1) * rest
    high += sets * (fixed ?? (Number(cfg.reps) || 10) * 5) + (sets - 1) * rest + 60
  }
  return { min: Math.max(1, Math.ceil(low / 60)), max: Math.max(1, Math.ceil(high / 60)) }
}
// Only compare new, explicitly unit-stamped rep records at the same load.
// Legacy unit labels and time/cardio entries cannot establish a strength comparison.
export function recentRepProgress(S, today) {
  const byExercise = new Map()
  for (const w of completedRecords(S, today)) {
    if (w.unit !== 'lb' && w.unit !== 'kg') continue
    for (const e of w.entries || []) {
      if (e.target?.mode !== 'reps') continue
      const sets = (e.sets || []).filter(s => s.done && Number.isFinite(s.w) && Number.isFinite(s.r) && s.r > 0)
      if (!sets.length) continue
      const weight = Math.max(...sets.map(s => s.w))
      const reps = Math.max(...sets.filter(s => s.w === weight).map(s => s.r))
      const key = e.id + ':' + w.unit, previous = byExercise.get(key)
      byExercise.set(key, { id: e.id, unit: w.unit, weight, reps, day: w.d, workoutId: w.id,
        gain: previous && previous.workoutId !== w.id && previous.weight === weight ? reps - previous.reps : null })
    }
  }
  return [...byExercise.values()].filter(x => x.gain > 0).sort((a, b) => b.day.localeCompare(a.day))[0] || null
}
