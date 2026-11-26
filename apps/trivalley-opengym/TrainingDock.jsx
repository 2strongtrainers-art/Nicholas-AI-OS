import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import TabBar from './TabBar.jsx'
import RestTimer from './RestTimer.jsx'
import { contentHeight } from '../lib/tv-navigation.js'

// The content scrollport ends before this dock. Navigation and running timers
// occupy real reserved space rather than covering exercise fields or actions.
export default function TrainingDock({ onStart }) {
  const ref = useRef(null), loc = useLocation()
  useLayoutEffect(() => {
    const root = document.documentElement, vv = window.visualViewport
    let frame = 0
    const measure = () => {
      const dock = ref.current, app = document.getElementById('app')
      if (!dock || !app) return
      const height = vv?.height || window.innerHeight
      const keyboard = height < 420 && document.activeElement?.matches('input,textarea')
      root.dataset.tvKeyboard = keyboard ? '1' : '0'
      const host = root.dataset.tvFreeHosted === '1' ? 76 : 0
      const top = Math.max(0, height - host - dock.offsetHeight - 8)
      dock.style.top = top + 'px'
      app.style.height = contentHeight(height, top, keyboard) + 'px'
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const size = new ResizeObserver(schedule)
    size.observe(ref.current)
    const host = new MutationObserver(schedule)
    host.observe(root, {attributes:true, attributeFilter:['data-tv-free-hosted']})
    window.addEventListener('resize', schedule)
    vv?.addEventListener('resize', schedule)
    document.addEventListener('focusin', schedule)
    document.addEventListener('focusout', schedule)
    measure()
    return () => { cancelAnimationFrame(frame); size.disconnect(); host.disconnect(); window.removeEventListener('resize', schedule); vv?.removeEventListener('resize', schedule); document.removeEventListener('focusin', schedule); document.removeEventListener('focusout', schedule) }
  }, [loc.pathname, loc.search])
  return <div ref={ref} className="tv-training-dock" data-testid="tv-training-dock"><RestTimer /><TabBar onStart={onStart} /></div>
}
