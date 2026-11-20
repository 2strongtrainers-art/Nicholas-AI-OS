import { completedRecords, shiftDay, recentRepProgress } from './tv-training-insights.mjs'

// A labelled rolling seven-calendar-day window. Partial work is visible without
// being credited as a complete session; active/future/empty records never count.
export function weeklyProgress(S, today, now = Date.now()) {
  const start = shiftDay(today, -6), prior = shiftDay(start, -7)
  const records = completedRecords({ ...S, workouts: (S.workouts || []).filter(w => !Number.isFinite(w.end) || w.end <= now) }, today)
  const current = records.filter(w => w.d >= start)
  const previous = records.filter(w => w.d >= prior && w.d < start)
  const full = current.filter(w => w.partial !== true)
  const partial = current.filter(w => w.partial === true)
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = shiftDay(start, index), logged = current.filter(w => w.d === day)
    return { day, full: logged.filter(w => w.partial !== true).length, partial: logged.filter(w => w.partial === true).length }
  })
  const improvement = recentRepProgress({ workouts: records }, today)
  return {
    start, end: today, sessions: full.length, partial: partial.length,
    previousSessions: previous.filter(w => w.partial !== true).length,
    sets: current.reduce((n, w) => n + w.entries.reduce((m, e) => m + (e.sets || []).filter(s => s.done === true).length, 0), 0),
    days, trainedDays: days.filter(d => d.full || d.partial).length,
    improvement: improvement?.day >= start ? improvement : null
  }
}
