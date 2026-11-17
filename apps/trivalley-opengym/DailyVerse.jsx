import { useEffect, useRef, useState } from 'react'

// Excerpts from the public-domain King James Version (KJV).
// The gym application underneath each verse is our own reflection, not a Bible quotation.
// All entries ship with the app so the experience works offline without APIs or subscriptions.
export const VERSES = [
  { ref:'1 Corinthians 9:24', title:'Train with purpose', quote:'So run, that ye may obtain.', note:'Bring intention to the next set. Your effort is about growth, not comparing yourself with someone else.' },
  { ref:'Galatians 6:9', title:'Consistency counts', quote:'And let us not be weary in well doing:', note:'Small, faithful actions add up. Keep a sustainable routine, even when results take time.' },
  { ref:'Proverbs 27:17', title:'Stronger together', quote:'Iron sharpeneth iron;', note:'Encourage your training partner. Good coaching and accountability help both people grow.' },
  { ref:'Philippians 4:13', title:'Courage for the day', quote:'I can do all things through Christ which strengtheneth me.', note:'Draw courage from your faith while respecting your body and choosing an appropriate challenge.' },
  { ref:'Isaiah 40:31', title:'Renew your strength', quote:'But they that wait upon the Lord shall renew their strength;', note:'Patience belongs in a training plan. Recovery days are as intentional as training days.' },
  { ref:'Hebrews 12:1', title:'Run your own race', quote:'let us run with patience the race that is set before us,', note:'Focus on steady progress and your own journey, not somebody else’s pace.' },
  { ref:'Proverbs 24:5', title:'Strength and wisdom', quote:'A wise man is strong; yea, a man of knowledge increaseth strength.', note:'Learn the movement first. Thoughtful technique is more valuable than showing off heavier numbers.' },
  { ref:'Matthew 11:28', title:'Permission to rest', quote:'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', note:'Rest is not failure. Make room for recovery, reflection, and peace.' },
  { ref:'Colossians 3:23', title:'Show up wholeheartedly', quote:'And whatsoever ye do, do it heartily, as to the Lord, and not unto men;', note:'Give your session focused attention. Train from conviction instead of chasing approval.' },
  { ref:'2 Timothy 1:7', title:'Steady confidence', quote:'For God hath not given us the spirit of fear;', note:'Meet a new skill with patience and a clear head. Progress is built through manageable challenges.' },
  { ref:'Psalm 28:7', title:'Strength beyond the weight room', quote:'The Lord is my strength and my shield;', note:'Physical performance changes day to day. Remember that your worth is bigger than the numbers.' },
  { ref:'Ecclesiastes 4:9', title:'Help one another', quote:'Two are better than one;', note:'Offer a spot, a kind word, or encouragement. Training communities grow through service.' },
  { ref:'Psalm 46:10', title:'Make space for stillness', quote:'Be still, and know that I am God:', note:'Let a quiet moment be part of the day. Not every worthwhile practice has a rep count.' },
  { ref:'Proverbs 16:3', title:'Put purpose first', quote:'Commit thy works unto the Lord, and thy thoughts shall be established.', note:'Choose a meaningful goal, then pursue it with consistency and humility.' },
  { ref:'1 Corinthians 9:26', title:'Practice with direction', quote:'I therefore so run, not as uncertainly;', note:'Give the session a purpose: practice quality movements, track progress, and make every set count.' },
  { ref:'Galatians 6:2', title:'Lift others', quote:'Bear ye one another’s burdens, and so fulfil the law of Christ.', note:'The best training partners support each other through setbacks, not only personal records.' }
]

export const VERSE_PREF_KEY = 'tv_daily_verse_enabled_v1'
export const VERSE_SEEN_KEY = 'tv_daily_verse_last_shown_v1'

export function localDayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

export function verseForLocalDay(date = new Date()) {
  const days = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
  return VERSES[days % VERSES.length]
}

function isEnabled() {
  try { return localStorage.getItem(VERSE_PREF_KEY) !== 'false' }
  catch { return true }
}

export default function DailyVerse({ active }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(() => new Date())
  const cardRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    if (!active) return undefined
    const showIfNewDay = () => {
      if (!isEnabled()) return
      const today = localDayKey()
      try {
        if (localStorage.getItem(VERSE_SEEN_KEY) === today) return
        localStorage.setItem(VERSE_SEEN_KEY, today)
      } catch { /* Private browsing may block storage: opening still works. */ }
      setDate(new Date())
      setOpen(true)
    }
    const onVisible = () => { if (document.visibilityState === 'visible') showIfNewDay() }
    const onManual = () => { setDate(new Date()); setOpen(true) }
    const onPreference = () => {
      if (!isEnabled()) setOpen(false)
      else showIfNewDay()
    }
    showIfNewDay()
    window.addEventListener('focus', showIfNewDay)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('tv:verse-open', onManual)
    window.addEventListener('tv:verse-preference', onPreference)
    return () => {
      window.removeEventListener('focus', showIfNewDay)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('tv:verse-open', onManual)
      window.removeEventListener('tv:verse-preference', onPreference)
    }
  }, [active])

  useEffect(() => {
    if (!open) return undefined
    const previousFocus = document.activeElement
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => closeRef.current?.focus())
    const onKeyDown = e => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return }
      if (e.key !== 'Tab' || !cardRef.current) return
      const focusable = [...cardRef.current.querySelectorAll('button:not([disabled]), a[href]')]
      if (!focusable.length) { e.preventDefault(); return }
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = oldOverflow
      document.removeEventListener('keydown', onKeyDown)
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus()
    }
  }, [open])

  if (!active || !open) return null
  const verse = verseForLocalDay(date)
  const fullPassage = 'https://www.biblegateway.com/passage/?search=' +
    encodeURIComponent(verse.ref) + '&version=KJV'
  const close = () => setOpen(false)
  const optOut = () => {
    try { localStorage.setItem(VERSE_PREF_KEY, 'false') } catch {}
    setOpen(false)
    window.dispatchEvent(new Event('tv:verse-preference'))
  }

  return (
    <div className="tv-verse-overlay" data-testid="tv-daily-verse"
      onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
      <section ref={cardRef} className="tv-verse-card" role="dialog" aria-modal="true"
        aria-labelledby="tv-verse-title" aria-describedby="tv-verse-reflection">
        <button ref={closeRef} type="button" className="tv-verse-x" onClick={close}
          aria-label="Close daily Bible verse">×</button>
        <div className="tv-verse-kicker">TRIVALLEY.FIT · DAILY FAITH + FITNESS</div>
        <div className="tv-verse-eyebrow">TODAY'S SCRIPTURE</div>
        <h2 id="tv-verse-title">{verse.title}</h2>
        <blockquote className="tv-verse-quote">“{verse.quote}”</blockquote>
        <div className="tv-verse-ref">{verse.ref} · KJV</div>
        <div className="tv-verse-divider" />
        <div className="tv-verse-eyebrow">IN THE GYM</div>
        <p id="tv-verse-reflection" className="tv-verse-reflection">{verse.note}</p>
        <a className="tv-verse-full" href={fullPassage} target="_blank"
          rel="noopener noreferrer">Read the full passage for context</a>
        <button type="button" className="tv-verse-primary" data-testid="tv-verse-dismiss"
          onClick={close}>Continue to workout</button>
        <button type="button" className="tv-verse-optout"
          onClick={optOut}>Don't show this automatically</button>
      </section>
    </div>
  )
}
