import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { uid, DAYN } from '../lib/format.js'
import { hasWeightData } from '../lib/tv-audit-safety.js'
import { setupReview, applySetup } from '../lib/tv-setup.js'
import { showGettingStarted } from '../lib/tv-navigation.js'

export function GettingStarted() {
  const S = useStore(s => s.S), update = useStore(s => s.update), nav = useNavigate()
  if (!showGettingStarted(S)) return null
  return <section className="card tv-get-started" data-testid="tv-get-started" aria-label="Getting started">
    <div className="tv-eyebrow">START HERE</div><h2>A clear plan for your week</h2>
    <p>Set up Nick’s 3-Day Muscle Split, choose your training days and confirm your weight unit.</p>
    <div className="tv-setup-actions"><button type="button" className="btn primary" onClick={() => nav('/plan?setup=1')}>Set up my training</button>
      <button type="button" className="tv-text-action" onClick={() => update(s => {s.tvSetupDone=true})}>Use my existing plan</button></div>
    <p className="small muted">Your current plan stays in place until you confirm changes. Reopen setup from Programs.</p>
  </section>
}

export function ProgramSetup({onClose}) {
  const S = useStore(s => s.S), update = useStore(s => s.update), nav = useNavigate()
  const [schedule,setSchedule] = useState(''), [unit,setUnit] = useState(S.unit)
  const [review,setReview] = useState(null), [error,setError] = useState('')
  const reviewHeading = useRef(null)
  useEffect(()=>{if(review)reviewHeading.current?.focus()},[review])
  const locked = hasWeightData(S)
  const confirm = () => {
    try {
      update(s => {applySetup(s,{schedule,unit,expectedWeek:review.snapshot,makeId:uid})})
      const saved = useStore.getState().storageStatus?.ok !== false
      useUI.getState().toast(saved ? 'Program setup saved. Your next session is ready.' : 'Setup is only in memory. Export a backup before closing.')
      nav('/home')
    } catch(e) {setError(e.message);setReview(null)}
  }
  return <section className="tv-program-setup-guide" data-testid="tv-program-setup-guide" aria-labelledby="tv-setup-heading">
    <h3 id="tv-setup-heading">Choose your training days</h3>
    <p>Back & Biceps · Chest & Triceps · Legs</p>
    {!review ? <>
      <label htmlFor="tv-setup-schedule">Training days</label>
      <select id="tv-setup-schedule" value={schedule} onChange={e=>setSchedule(e.target.value)}>
        <option value="" disabled>Choose your training days</option><option value="mwf">Monday / Wednesday / Friday</option><option value="tts">Tuesday / Thursday / Saturday</option><option value="none">Flexible — choose each session</option>
      </select>
      <details className="tv-unit-options" data-testid="tv-unit-options"><summary>Weights: {unit === 'lb' ? 'pounds (lb)' : 'kilograms (kg)'}</summary>
      <label htmlFor="tv-setup-unit">1. Weight unit</label>
      <select id="tv-setup-unit" value={unit} disabled={locked} onChange={e=>setUnit(e.target.value)}><option value="lb">Pounds (lb)</option><option value="kg">Kilograms (kg)</option></select>
      {locked && <p className="small muted">Your saved weight data keeps this unit locked.</p>}
      </details>
      <div className="tv-setup-actions"><button type="button" className="btn primary" disabled={!schedule} onClick={()=>{setError('');setReview(setupReview(S,schedule))}}>Review my setup</button><button type="button" className="tv-text-action" onClick={onClose}>Close setup</button></div>
    </> : <div data-testid="tv-setup-review" aria-live="polite">
      <h4 ref={reviewHeading} tabIndex="-1">Review your changes</h4><p>Weight unit: <strong>{unit === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}</strong></p>
      {review.rows.length ? <ul>{review.rows.map(row=><li key={row.day}><strong>{DAYN[row.day]}</strong>: {row.from} to {row.to}</li>)}</ul> : <p>{schedule === 'none' ? 'Flexible program: your weekly calendar will stay as it is.' : 'These training days already match the program.'}</p>}
      <p className="small">Only the listed calendar assignments change. Your routines, workout history, notes and any active session are kept.</p>
      <div className="tv-setup-actions"><button type="button" className="btn primary" onClick={confirm}>Confirm program and training days</button><button type="button" className="btn" onClick={()=>setReview(null)}>Back to choices</button></div>
    </div>}
    {error && <p role="alert">{error}</p>}
  </section>
}

export function AppHelp() {
  return <details className="card tv-app-help" data-testid="tv-app-help"><summary>Install the app & protect your workouts</summary>
    <h3>Add the Trinity knot to your iPhone</h3><ol><li>Open this app page in Safari.</li><li>Use Share, then Add to Home Screen.</li><li>Enable Open as Web App if shown, then tap Add.</li></ol>
    <p className="small">In other browsers, use Install or Add to Home Screen when available. A website cannot perform the final installation tap for you.</p>
    <h3>Keep a separate backup</h3><ol><li>In Settings, choose Export a fresh backup.</li><li>Finish saving the JSON file in Files or another safe location.</li><li>Return and tap I saved this backup.</li></ol>
    <p className="small">Your workouts stay in this browser on this device. Before clearing browser data or changing phones, export a backup. Restore it using Import checked backup in Settings; review the replacement confirmation first.</p>
    <p className="small">For offline training, wait until the status above says Offline app cached. Your installed app and browser can have separate storage on iPhone; check your history after installation and import your backup if needed.</p>
  </details>
}
