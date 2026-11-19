// Original TriValley programming. Exercise IDs resolve against the pinned openGym catalogue.
// No client records, model-generated exercise substitutions or prescribed starting loads.
export const MUSCLE_SPLIT = {
  id: 'trivalley-muscle-split', version: 1, name: '3-Day Muscle Split',
  audience: 'Gym-based strength and muscle training',
  equipment: 'Dumbbells, adjustable bench, cables and leg machines',
  warmup: 'Start with 5–8 minutes of easy movement, then 1–3 lighter practice sets for the first compound exercise. Warm-up sets are separate from the working sets below.',
  effort: 'Choose loads that leave about 2–3 good reps in reserve. Record your actual reps. Keep your technique controlled; adjust the load or exercise when needed.',
  progression: 'Work within each rep range. Once every working set reaches the top with good technique, use the smallest suitable load increase next time and return toward the bottom of the range. Review the app’s suggestion against the weights available to you.',
  frequency: 'Three reusable sessions, in your chosen order. The optional Mon/Wed/Fri or Tue/Thu/Sat schedule gives each primary group one dedicated session per week. Adjust frequency and volume to your goals and recovery.',
  source: 'https://acsm.org/resistance-training-guidelines-update-2026/',
  days: [
    { key: 'back-biceps', name: 'Back & Biceps', emoji: 'pullup', exercises: [
      ['2330', 'Cable lat pulldown', 3, 8, 12, 120],
      ['0861', 'Cable seated row', 3, 8, 12, 120],
      ['0383', 'Dumbbell reverse fly', 2, 12, 15, 75],
      ['0294', 'Dumbbell biceps curl', 3, 10, 12, 75],
      ['0313', 'Dumbbell hammer curl', 2, 10, 12, 75]
    ] },
    { key: 'chest-triceps', name: 'Chest & Triceps', emoji: 'dumbbell', note: 'Includes shoulders.', exercises: [
      ['0289', 'Dumbbell bench press', 3, 8, 12, 120],
      ['0314', 'Dumbbell incline bench press', 3, 8, 12, 120],
      ['0405', 'Dumbbell seated shoulder press', 2, 8, 12, 120],
      ['0334', 'Dumbbell lateral raise', 2, 12, 15, 75],
      ['0200', 'Cable rope pushdown', 3, 10, 15, 75],
      ['0194', 'Cable overhead rope triceps extension', 2, 10, 15, 75]
    ] },
    { key: 'legs', name: 'Legs', emoji: 'legs', exercises: [
      ['0739', 'Leg press', 3, 8, 12, 120],
      ['1459', 'Dumbbell Romanian deadlift', 3, 8, 12, 120],
      ['0586', 'Lying leg curl', 3, 10, 15, 90],
      ['0585', 'Leg extension', 2, 10, 15, 75],
      ['0605', 'Machine standing calf raise', 3, 12, 15, 75]
    ] }
  ]
}
export const SCHEDULES = { none: [], mwf: [1, 3, 5], tts: [2, 4, 6] }

export function installedDays(S) {
  return MUSCLE_SPLIT.days.map(day => (S.routines || []).find(r => r.tvTemplate?.id === MUSCLE_SPLIT.id && r.tvTemplate.day === day.key) || null)
}

// Called inside the existing store's cloned-draft update. Append only; never replace an
// existing routine, active workout, log, day override, or occupied calendar assignment.
export function addMuscleSplit(S, { makeId, schedule = 'none' } = {}) {
  if (typeof makeId !== 'function') throw new Error('Routine ID generator required')
  if (!Object.hasOwn(SCHEDULES, schedule)) throw new Error('Unknown schedule')
  S.routines ||= []
  S.week ||= {}
  let added = 0
  const usedIds = new Set(S.routines.map(r => r.id))
  const routines = MUSCLE_SPLIT.days.map(day => {
    const existing = S.routines.find(r => r.tvTemplate?.id === MUSCLE_SPLIT.id && r.tvTemplate.day === day.key)
    if (existing) return existing
    const id = makeId()
    if (typeof id !== 'string' || !id || usedIds.has(id)) throw new Error('Routine ID must be unique')
    usedIds.add(id)
    const routine = {
      id, name: day.name, emoji: day.emoji, prog: 'double',
      tvTemplate: { id: MUSCLE_SPLIT.id, version: MUSCLE_SPLIT.version, day: day.key },
      tvWarmup: MUSCLE_SPLIT.warmup, tvEffort: MUSCLE_SPLIT.effort,
      ex: day.exercises.map(([exerciseId, , sets, repsMin, reps, restSec]) => ({
        id: exerciseId, sets, repsMin, reps, restSec, mode: 'reps', prog: 'double',
        weight: 0, loadRequired: true
      }))
    }
    S.routines.push(routine); added++
    return routine
  })
  const assigned = [], kept = []
  SCHEDULES[schedule].forEach((weekday, index) => {
    if (!S.week[weekday] || S.week[weekday] === routines[index].id) {
      S.week[weekday] = routines[index].id; assigned.push(weekday)
    } else kept.push(weekday)
  })
  return { added, assigned, kept, routineIds: routines.map(r => r.id) }
}

export function restForEntry(entry, fallback) {
  const rest = entry?.target?.restSec
  return Number.isInteger(rest) && rest >= 0 && rest <= 600 ? rest : fallback
}
export function needsWorkingLoad(entry, setIndex) {
  return entry?.target?.loadRequired === true && !(Number(entry.sets?.[setIndex]?.w) > 0)
}
