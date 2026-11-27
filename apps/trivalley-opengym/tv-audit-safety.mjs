// Conservative safeguards: existing numbers never acquire a different unit label.
export function hasWeightData(S) {
  const positive = n => Number.isFinite(n) && n > 0
  return !!(S.bodyweight?.length || positive(S.targetW) || Object.values(S.exWeights || {}).some(x => positive(x?.w)) ||
    (S.workouts || []).some(w => positive(w.bw) || w.entries?.some(e => positive(e.topW) || e.sets?.some(s => positive(s.w)))) ||
    S.active?.entries?.some(e => e.sets?.some(s => positive(s.w))) || positive(S.active?.bw) ||
    (S.routines || []).some(r => r.ex?.some(e => positive(e.weight))))
}
export function recoverRest(raw, activeId, now = Date.now()) {
  try {
    const timer = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!activeId || timer?.sessionId !== activeId || !Number.isFinite(timer.endsAt) ||
        !Number.isFinite(timer.total) || timer.total <= 0 || timer.total > 86400 ||
        timer.endsAt <= now || timer.endsAt > now + 86400000) return null
    return { ...timer, left: Math.max(1, Math.ceil((timer.endsAt - now) / 1000)) }
  } catch { return null }
}
