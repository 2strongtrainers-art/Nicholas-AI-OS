import { useEffect, useLayoutEffect, useRef } from 'react'
import { useUI } from '../store/useUI.js'

const tabbables = el => [...el.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
  .filter(n => !n.disabled && !n.closest('[inert]') && n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden')

function Sheet({ sheet, top }) {
  const ref = useRef(null)
  const close = () => useUI.getState().closeSheet(sheet.id)
  useLayoutEffect(() => {
    if (!top) return
    const el = ref.current
    const heading = el.querySelector('h3,h2,h1')
    if (heading) { heading.id ||= 'tv-dialog-title-' + sheet.id; el.setAttribute('aria-labelledby', heading.id); el.removeAttribute('aria-label') }
    const focusFirst = () => (el.querySelector('input:not([disabled]), textarea:not([disabled])') || tabbables(el)[0] || el).focus({preventScroll:true})
    focusFirst()
    const onFocus = e => { if (!el.contains(e.target)) focusFirst() }
    const onKey = e => {
      if (e.key === 'Escape' && !sheet.locked) { e.preventDefault(); e.stopPropagation(); close(); return }
      if (e.key !== 'Tab') return
      const nodes = tabbables(el), first = nodes[0], last = nodes.at(-1)
      if (!nodes.length) { e.preventDefault(); el.focus(); return }
      if (e.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement))) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement))) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKey, true); document.removeEventListener('focusin', onFocus)
      requestAnimationFrame(() => {
        const active = document.activeElement
        const focusUnclaimed = !active || active === document.body || active === el || el.contains(active)
        if (focusUnclaimed && !useUI.getState().sheets.some(s => s.id === sheet.id) && sheet.opener?.isConnected) sheet.opener.focus({preventScroll:true})
      })
    }
  }, [sheet.id, top, sheet.locked])
  return <div inert={top ? undefined : true}>
    <div className="mback" aria-hidden="true" onClick={() => { if (!sheet.locked) close() }} />
    <div className={sheet.kind === 'center' ? 'center' : 'sheet'} ref={ref} role="dialog" aria-modal={top ? 'true' : undefined} aria-label="Workout dialog" tabIndex={-1}>
      {!sheet.locked && <button type="button" className="tv-dialog-close" onClick={close}>Close</button>}
      {sheet.render(close)}
    </div>
  </div>
}

export default function Modals() {
  const sheets = useUI(s => s.sheets)
  useEffect(() => {
    if (!sheets.length) return
    const y = window.scrollY || 0, b = document.body.style
    b.position='fixed'; b.top=-y+'px'; b.left='0'; b.right='0'; b.width='100%'
    return () => { b.position=b.top=b.left=b.right=b.width=''; window.scrollTo(0,y) }
  }, [sheets.length > 0])
  if (!sheets.length) return null
  return <div id="modal-root" className="open">{sheets.map((sheet,i) => <Sheet key={sheet.id} sheet={sheet} top={i === sheets.length-1} />)}</div>
}
