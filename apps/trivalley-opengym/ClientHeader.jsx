import {useEffect,useRef} from 'react'
import {useNavigate} from 'react-router-dom'

export default function ClientHeader() {
  const menu=useRef(null), nav=useNavigate()
  const close=()=>{if(menu.current)menu.current.open=false}
  useEffect(()=>{
    const outside=e=>{if(menu.current?.open&&!menu.current.contains(e.target))close()}
    document.addEventListener('pointerdown',outside)
    return ()=>document.removeEventListener('pointerdown',outside)
  },[])
  return <header className="tv-v4-topbar tv-client-header" aria-label="TriValley.fit">
    <span className="tv-topbar-brand"><span className="tv-knot" aria-hidden="true"><img src="./trivalley-triquetra.png" width="28" height="28" alt="" /></span>TRIVALLEY.FIT</span>
    <div className="tv-topbar-actions">
      <a href="https://donate.stripe.com/bJe3cw6LUfnw8Z1biqf3a02" target="_blank" rel="noopener noreferrer" className="tv-support-link" aria-label="Donate: optional one-time support for Nick’s work, opens Stripe in a new tab">Donate</a>
      <details className="tv-client-more" ref={menu} data-testid="tv-client-more" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close();menu.current?.querySelector('summary')?.focus()}}}>
        <summary>More</summary>
        <div className="tv-client-more-panel">
          <button type="button" onClick={()=>{close();nav('/settings')}}>Settings & backups</button>
          <button type="button" data-testid="tv-daily-verse-trigger" onClick={()=>{close();window.dispatchEvent(new Event('tv:verse-open'))}}>Daily verse</button>
          <a href="__TV_SOURCE_URL__" target="_blank" rel="noopener noreferrer" aria-label="Modified OpenGym corresponding source, AGPL 3.0" onClick={close}>Source · AGPL</a>
        </div>
      </details>
    </div>
  </header>
}
