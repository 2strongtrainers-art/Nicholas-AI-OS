import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'

export default function StartGuide() {
 const nav=useNavigate(),S=useStore(s=>s.S),[notice,setNotice]=useState('')
 const returning=!!S.active||S.tvSetupDone||(S.workouts||[]).some(w=>(w.entries||[]).some(e=>e.sets?.length))
 const share=new URL('./',location.href.split('#')[0]).href+'#/start'
 return <main className="narrow tv-start-guide" data-testid="tv-start-guide">
  <header className="tv-start-heading"><div><p className="tv-eyebrow">TRAIN WITH NICK</p><h1>Let’s make your first workout simple.</h1></div><img src="./assets/tv-coach-portrait.webp" width="64" height="64" alt="Nick Kaplan, your TriValley.fit coach"/></header>
  <p>I’ll help you choose a workout, learn its movements and record your work. No account or payment required.</p>
  <button className="btn primary tv-start-main" onClick={()=>nav(S.active?'/workout':returning?'/plan':'/plan?setup=1')}>{S.active?'Resume my workout':returning?'Go to my workouts':'Set up my training'}</button>
  <p className="small muted">Saved on this device only. I don’t automatically receive your logs.</p>
  <details className="tv-first-steps"><summary>How your first workout works</summary>
  <ol className="tv-start-steps"><li><strong>Choose your workout.</strong><span>Preview my 3-Day Muscle Split and check its equipment and who it suits. Keep your existing routine if you already have one.</span></li><li><strong>Check your setup and practice.</strong><span>Read Setup, Do this, Avoid and Make it easier. Start with a controlled practice load; an illustration isn’t a recorded demonstration.</span></li><li><strong>Record your work.</strong><span>Enter your actual weight and reps. Mark a set only after performing it. Your next visit can build on your own records.</span></li></ol>
  </details>
  <details className="tv-start-options"><summary>Looking for something else?</summary><button className="btn" onClick={()=>nav('/library')}>Learn my main 16 movements</button><button className="btn" onClick={()=>nav('/calculators')}>Understand my nutrition or training numbers</button></details>
  <section className="card tv-storage-explained" aria-label="Where your workouts are saved"><h2>Your records belong to this device</h2><p>Your workout history stays in this browser on this device. I don’t automatically receive or monitor it. There is no account-based cloud sync or automatic server backup.</p><p>Before clearing browser data or changing phones, export a backup in Settings and finish saving it in Files. Safari and an installed Home Screen app may use separate storage; check your records after installation.</p><button className="btn" onClick={()=>nav('/settings')}>Open backup & installation help</button></section>
  <details className="card tv-friend-trial"><summary>Try the app on your iPhone</summary><ol><li>Open this link in Safari, then preview a workout and its movement notes.</li><li>When you actually train, enter your load and reps and mark the performed set.</li><li>Leave and reopen the app. Check that your own record remains.</li><li>Export a backup and verify that you can find it in Files.</li><li>Use More → Report a problem or idea if a control, instruction or save is confusing.</li></ol><p>This is a test checklist, not a claim that your phone has passed. No test result is sent automatically.</p><button className="btn" onClick={()=>nav('/feedback?screen=%2Fstart')}>Prepare my feedback</button></details>
  <details className="card"><summary>Share the app with a friend</summary><p>Send the app link, not an exported workout backup. Your friend starts with their own browser’s records.</p><a href={share}>{share}</a><button className="btn" onClick={async()=>{try{await navigator.clipboard.writeText(share);setNotice('App link copied. Choose who to send it to in your own messaging app.')}catch{setNotice('Copy is unavailable. Press and hold the app link above to copy it.')}}}>Copy app link</button><p role="status">{notice}</p></details>
 </main>
}
