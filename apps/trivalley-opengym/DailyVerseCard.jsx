import {useEffect, useState} from 'react'
import {localDayKey, verseForLocalDay, VERSE_PREF_KEY, VERSE_SEEN_KEY} from './DailyVerse.jsx'

// The optional daily reading is inline below Today's workout, not a global popup.
// Once displayed it is marked shown for that local day, preserving the existing preference.
function todayNotSeen() {
  try {
    return localStorage.getItem(VERSE_PREF_KEY) !== 'false'
      && localStorage.getItem(VERSE_SEEN_KEY) !== localDayKey()
  } catch { return false }
}
export default function DailyVerseCard() {
  const [visible, setVisible] = useState(todayNotSeen)
  const verse = verseForLocalDay()
  useEffect(() => {
    if (!visible) return
    try { localStorage.setItem(VERSE_SEEN_KEY, localDayKey()) } catch {}
  }, [visible])
  useEffect(() => {
    const refresh = () => setVisible(todayNotSeen())
    const preference = () => setVisible(todayNotSeen())
    window.addEventListener('focus', refresh)
    window.addEventListener('tv:verse-preference', preference)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('tv:verse-preference', preference)
    }
  }, [])
  if (!visible) return null
  return <aside className="tv-home-verse-card" data-testid="tv-daily-verse"
    aria-label="Optional daily Bible verse" role="region">
    <div className="tv-home-verse-row">
      <span className="tv-verse-kicker">DAILY INSPIRATION · OPTIONAL</span>
      <button type="button" className="tv-home-verse-dismiss"
        data-testid="tv-verse-dismiss" aria-label="Dismiss today's Bible verse"
        onClick={() => setVisible(false)}>Dismiss</button>
    </div>
    <strong>{verse.title}</strong>
    <p className="tv-verse-quote">“{verse.quote}”</p>
    <span className="tv-verse-ref">{verse.ref} · KJV</span>
    <button type="button" className="tv-home-verse-read"
      onClick={() => {setVisible(false); window.dispatchEvent(new Event('tv:verse-open'))}}>
      Read reflection
    </button>
  </aside>
}
