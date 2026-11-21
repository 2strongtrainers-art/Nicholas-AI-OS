// Original poster helpers. Times are wall-clock elapsed time, including rests.
export function elapsedSeconds(start, end, now = Date.now()) {
  if (!Number.isFinite(start) || start <= 0) return null
  const until = end == null ? now : end
  if (!Number.isFinite(until) || until < start) return null
  return Math.floor((until - start) / 1000)
}
export function posterClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Not recorded'
  const n = Math.floor(seconds), s = String(n % 60).padStart(2, '0')
  return n >= 3600 ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${s}` : `${Math.floor(n / 60)}:${s}`
}
export function posterSetLabel(mode, set, unit = '') {
  const num = v => Number.isFinite(v) && v >= 0 ? String(v) : '—'
  const load = set.w > 0 ? `${num(set.w)} ${unit || 'logged units'}` : 'no added load'
  if (mode === 'cardio') return `${num(set.min)} min · ${num(set.speed)} km/h`
  if (mode === 'time') return `${posterClock(set.sec)} hold · ${load}`
  return `${num(set.r)} reps · ${load}`
}
