import { MUSCLE_SPLIT, SCHEDULES, installedDays, addMuscleSplit } from './tv-programs.mjs'
import { hasWeightData } from './tv-audit-safety.mjs'

export const weekSnapshot = S => JSON.stringify(Array.from({length:7}, (_, day) => S.week?.[day] || null))

// A read-only preview of every changed weekday, including old split days that move.
export function setupReview(S, schedule) {
  if (!Object.hasOwn(SCHEDULES, schedule)) throw new Error('Choose a training schedule.')
  const selected = SCHEDULES[schedule], installed = installedDays(S)
  const ids = new Set(installed.filter(Boolean).map(r => r.id))
  const rows = []
  for (let day = 0; day < 7; day++) {
    const current = S.week?.[day] || null, index = selected.indexOf(day)
    if (index < 0 && !(selected.length && ids.has(current))) continue
    const target = index < 0 ? null : MUSCLE_SPLIT.days[index]
    const nextId = index < 0 ? null : installed[index]?.id
    if (current === nextId && (index < 0 || nextId)) continue
    rows.push({day, from: (S.routines || []).find(r => r.id === current)?.name || (current ? 'Existing routine' : 'Rest'), to: target?.name || 'Rest'})
  }
  return {schedule, snapshot: weekSnapshot(S), rows}
}

// Called only after the displayed review is confirmed. No historical/active data is touched.
export function applySetup(S, {schedule, unit, expectedWeek, makeId}) {
  if (!['lb','kg'].includes(unit)) throw new Error('Choose pounds or kilograms.')
  if (hasWeightData(S) && unit !== S.unit) throw new Error('Your weight unit is locked to protect saved numbers.')
  if (weekSnapshot(S) !== expectedWeek) throw new Error('Your calendar changed. Review the training days again.')
  const review = setupReview(S, schedule)
  const result = addMuscleSplit(S, {makeId, schedule:'none'})
  const days = installedDays(S), ids = new Set(days.map(r => r.id))
  const selected = SCHEDULES[schedule]
  if (selected.length) {
    for (let day = 0; day < 7; day++) {
      if (!selected.includes(day) && ids.has(S.week?.[day])) S.week[day] = null
    }
    selected.forEach((day, index) => {S.week[day] = days[index].id})
  }
  S.unit = unit
  S.tvSetupDone = true
  S.tvProgramSchedule = schedule === 'none' ? 'flexible' : schedule
  return {...result, changes:review.rows, scheduled:selected.length}
}
