import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { feedbackText } from '../lib/tv-workout-tools.js'

export default function AppFeedback() {
 const loc=useLocation(),[category,setCategory]=useState('Navigation'),[details,setDetails]=useState(''),[notice,setNotice]=useState('')
 const text=feedbackText({category,details,route:new URLSearchParams(loc.search).get('screen')||'/feedback',version:'5.14.0',browser:navigator.userAgent})
 const mail='mailto:2strongtrainers@gmail.com?subject='+encodeURIComponent('TriValley app feedback · '+category)+'&body='+encodeURIComponent(text)
 return <section className="narrow tv-feedback"><h1>Help me improve your training app</h1><p>Tell me where you got stuck or what would make your next workout easier.</p>
  <label htmlFor="tv-feedback-category">What is this about?</label><select id="tv-feedback-category" value={category} onChange={e=>setCategory(e.target.value)}>{['Navigation','Exercise instructions','Weight or rep logging','Timer','Saved workout or backup','Accessibility','Other'].map(x=><option key={x}>{x}</option>)}</select>
  <label htmlFor="tv-feedback-details">What happened, and what did you expect?</label><textarea id="tv-feedback-details" rows={5} maxLength={2000} value={details} onChange={e=>setDetails(e.target.value)} placeholder="I was on… I tapped… I expected…"/>
  <p className="small muted">Only your message, app version, screen and browser information are included. Workout records and weight entries are not attached. Please leave personal health details out.</p>
  <details><summary>Review what you will send</summary><pre data-testid="tv-feedback-preview">{text}</pre></details>
  <div className="tv-feedback-actions"><a className="btn primary" href={mail} aria-disabled={!details.trim()} onClick={e=>{if(!details.trim()){e.preventDefault();setNotice('Describe the issue first.')}else setNotice('Your email app opens a draft. Review it and tap Send there.')}}>Open email draft</a><button type="button" className="btn" disabled={!details.trim()} onClick={async()=>{try{await navigator.clipboard.writeText(text);setNotice('Report copied. Paste it into your email or message to Nick.')}catch{setNotice('Copy is unavailable. Select the report text below, or use Open email draft.')}}}>Copy report</button></div>
  <p role="status">{notice}</p><p className="small muted">Opening a draft or copying a report does not submit it. Contact: <a href="mailto:2strongtrainers@gmail.com">2strongtrainers@gmail.com</a>.</p>
 </section>
}
