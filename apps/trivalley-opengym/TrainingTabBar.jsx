import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import Icon from './Icon.jsx'

// Stable components preserve keyboard focus when saved workout state changes.
function TrainingTab({ active, icon, to, label, navigate }) {
  return <button className={active ? 'on' : ''} aria-current={active ? 'page' : undefined} onClick={() => navigate(to)}><Icon name={icon} /><span>{label}</span></button>
}
export default function TabBar() {
  const nav = useNavigate(), loc = useLocation()
  const active = useStore(s => s.S.active), user = useStore(s => s.user), guest = useStore(s => s.isGuest())
  if (!user && !guest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k => cur === k || (cur === 'history' && k === 'stats') || (cur === 'settings' && k === 'home')
  return <nav id="tabbar" aria-label="Primary training navigation">
    <TrainingTab active={on('home')} icon="house" to="/home" label="Today" navigate={nav} />
    <TrainingTab active={on('plan')} icon="calendar" to="/plan" label="Programs" navigate={nav} />
    <button className={'start' + (active ? ' rec' : '') + (on('workout') ? ' on' : '')} aria-current={on('workout') ? 'page' : undefined} onClick={() => nav('/workout')}><span className="cir"><Icon name={active ? 'play' : 'dumbbell'} /></span><span>{active ? 'Resume' : 'Train'}</span></button>
    <TrainingTab active={on('stats')} icon="chart" to="/stats" label="Progress" navigate={nav} />
    <TrainingTab active={on('library')} icon="list" to="/library" label="Library" navigate={nav} />
  </nav>
}
