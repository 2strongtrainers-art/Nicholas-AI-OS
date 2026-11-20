// Returning trainees should not be asked to repeat first-use onboarding.
export function showGettingStarted(S) {
  const trained = (S.workouts || []).some(w => (w.entries || []).some(e => Array.isArray(e.sets) && e.sets.length > 0))
  const hasPlan = (S.routines || []).some(r => r.ex?.length)
  return !S.tvSetupDone && !S.active && !trained && !hasPlan
}

export function contentHeight(viewportHeight, dockTop, keyboard = false) {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return 0
  return Math.max(0, Math.min(viewportHeight, keyboard ? viewportHeight : dockTop - 8))
}
