import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { EXDB, BODYPARTS, allExercises, equipmentOf } from '../lib/exercises.js'
import { bestWeightFor } from '../lib/history.js'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { Thumb } from '../components/Media.jsx'
import { exerciseDetailSheet, addToRoutineSheet, customExSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

// Favorites live in the same local-first gym_state_v1 document as workouts.
// They are therefore included in the existing JSON backup and restore flow.
const textOf = value => String(value || '').toLowerCase()
const searchable = ex => [ex.n, ex.bp, ex.tg, ex.eq, ex.desc, ...(Array.isArray(ex.st) ? ex.st : [])]
  .map(textOf).join(' ')
const preferredParts = ['abs', 'back', 'chest', 'upper legs', 'shoulders']

export default function Library() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [query, setQuery] = useState('')
  const [bodyPart, setBodyPart] = useState('')
  const [equipment, setEquipment] = useState('')
  const [mode, setMode] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [shown, setShown] = useState(40)

  const favorites = Array.isArray(S.favoriteExercises) ? S.favoriteExercises : []
  const favoriteIds = new Set(favorites)
  const planIds = new Set((S.routines || []).flatMap(r => (r.ex || []).map(ex => ex.id)))
  const recentIds = [...new Set((S.workouts || []).slice(-20).reverse()
    .flatMap(w => (w.entries || []).map(en => en.id).reverse()))]
  const recentRank = new Map(recentIds.map((id, i) => [id, i]))
  const fullLibrary = allExercises(S)
  const knownIds = new Set(fullLibrary.map(ex => ex.id))
  const quickParts = preferredParts.map(label => BODYPARTS.find(bp => textOf(bp) === label)).filter(Boolean)

  const counts = {
    all: fullLibrary.length,
    favorites: favorites.filter(id => knownIds.has(id)).length,
    plan: [...planIds].filter(id => knownIds.has(id)).length,
    recent: recentIds.filter(id => knownIds.has(id)).length,
  }
  const collection = fullLibrary.filter(ex =>
    mode === 'all' || (mode === 'favorites' && favoriteIds.has(ex.id)) ||
    (mode === 'plan' && planIds.has(ex.id)) ||
    (mode === 'recent' && recentRank.has(ex.id))
  )
  const searchText = query.toLowerCase().trim()
  const base = collection.filter(ex =>
    (!bodyPart || ex.bp === bodyPart) &&
    (!searchText || searchable(ex).includes(searchText))
  )
  const equipmentOptions = equipmentOf(base)
  const equipmentOn = equipmentOptions.includes(equipment) ? equipment : ''
  const matching = (equipmentOn ? base.filter(ex => ex.eq === equipmentOn) : base).slice()
  if (mode === 'recent') matching.sort((a, b) => recentRank.get(a.id) - recentRank.get(b.id))
  const visible = matching.slice(0, shown)
  const activeFilters = Number(Boolean(bodyPart)) + Number(Boolean(equipmentOn))

  const resetFilters = () => { setBodyPart(''); setEquipment(''); setQuery(''); setShown(40) }
  const changeMode = value => { setMode(value); resetFilters() }
  const toggleFavorite = id => update(st => {
    const previous = Array.isArray(st.favoriteExercises) ? st.favoriteExercises : []
    st.favoriteExercises = previous.includes(id)
      ? previous.filter(value => value !== id)
      : [...previous, id]
  })
  const changePart = value => { setBodyPart(value); setEquipment(''); setShown(40) }
  const createExercise = () => customExSheet(null, ex => exerciseDetailSheet(ex), query.trim())

  return <div className="tv-library" data-testid="tv-library">
    <div className="hdr tv-library-header">
      <div>
        <div className="tv-library-eyebrow">TRIVALLEY.FIT / TRAINING LIBRARY</div>
        <h1>{t('Exercises')}</h1>
        <div className="sub">{EXDB.length.toLocaleString()} guided exercise references · free to explore</div>
      </div>
    </div>

    <div className="tv-library-search">
      <Icon name="magnifier" />
      <input
        className="input"
        type="search"
        inputMode="search"
        autoComplete="off"
        aria-label="Search exercises, muscles or equipment"
        data-testid="tv-library-search"
        placeholder="Search exercises, muscles, equipment…"
        value={query}
        onChange={event => { setQuery(event.target.value); setShown(40) }}
        onKeyDown={event => { if (event.key === 'Escape') setQuery('') }}
      />
      {query && <button type="button" className="tv-clear-search" aria-label="Clear search"
        data-testid="tv-library-clear" onClick={() => setQuery('')}><Icon name="xmark" /></button>}
    </div>

    <div className="tv-mode-tabs" role="group" aria-label="Choose exercise collection">
      {[
        ['all', 'Explore'], ['favorites', 'Saved'], ['plan', 'In my plan'], ['recent', 'Recent'],
      ].map(([value, label]) =>
        <button key={value} type="button" data-testid={'tv-mode-' + value}
          className={'tv-mode-tab' + (mode === value ? ' active' : '')}
          aria-pressed={mode === value} onClick={() => changeMode(value)}>
          {label}<span>{counts[value]}</span>
        </button>
      )}
    </div>

    <div className="tv-quick-filters" aria-label="Quick muscle filters">
      <button type="button" className={'tv-filter-chip' + (!bodyPart ? ' active' : '')}
        onClick={() => changePart('')}>All muscles</button>
      {quickParts.map(part => <button key={part} type="button"
        className={'tv-filter-chip' + (bodyPart === part ? ' active' : '')}
        onClick={() => changePart(part)}>{t(part)}</button>)}
    </div>

    <div className="tv-library-toolbar">
      <div className="tv-results-count" role="status" aria-live="polite">
        <strong>{matching.length.toLocaleString()}</strong> {matching.length === 1 ? 'exercise' : 'exercises'}
        {activeFilters > 0 && <span> · filtered</span>}
      </div>
      <button type="button" className="tv-filter-trigger" aria-expanded={filtersOpen}
        aria-controls="tv-library-advanced" data-testid="tv-library-filters"
        onClick={() => setFiltersOpen(v => !v)}>
        <Icon name="gear" /> Filters{activeFilters > 0 ? ' (' + activeFilters + ')' : ''}
      </button>
    </div>

    {filtersOpen && <div id="tv-library-advanced" className="tv-advanced-filters">
      <div className="tv-advanced-heading"><strong>Target muscle</strong>
        <button type="button" onClick={resetFilters}>Clear all</button></div>
      <div className="tv-advanced-chips">
        <button type="button" className={'tv-filter-chip' + (!bodyPart ? ' active' : '')}
          onClick={() => changePart('')}>Any muscle</button>
        {BODYPARTS.map(part => <button key={part} type="button"
          className={'tv-filter-chip' + (bodyPart === part ? ' active' : '')}
          onClick={() => changePart(part)}>{t(part)}</button>)}
      </div>
      <div className="tv-advanced-heading"><strong>Available equipment</strong></div>
      <div className="tv-advanced-chips">
        <button type="button" className={'tv-filter-chip' + (!equipmentOn ? ' active' : '')}
          onClick={() => { setEquipment(''); setShown(40) }}>Any equipment</button>
        {equipmentOptions.map(item => <button key={item} type="button"
          className={'tv-filter-chip' + (equipmentOn === item ? ' active' : '')}
          onClick={() => { setEquipment(item); setShown(40) }}>{t(item)}</button>)}
      </div>
    </div>}

    <div className="tv-exercise-list" data-testid="tv-exercise-list">
      {visible.map(ex => {
        const isFavorite = favoriteIds.has(ex.id)
        const best = bestWeightFor(S, ex.id)
        return <article className="tv-exercise-card" key={ex.id} data-ex-id={ex.id}
          data-testid="tv-exercise-card">
          <button type="button" className="tv-exercise-open"
            aria-label={'View form and details for ' + ex.n} onClick={() => exerciseDetailSheet(ex)}>
            <Thumb ex={ex} />
            <span className="tv-exercise-copy">
              <strong className="tv-exercise-name">{ex.n}</strong>
              <span className="tv-exercise-meta">{t(ex.tg || ex.bp || 'Full body')} · {t(ex.eq || 'No equipment')}</span>
              {best > 0 && <span className="tv-exercise-best">Best logged: {fmtNum(best)} {S.unit}</span>}
            </span>
          </button>
          <div className="tv-exercise-actions">
            <button type="button" className={'tv-favorite-button' + (isFavorite ? ' saved' : '')}
              data-testid="tv-favorite-toggle" aria-pressed={isFavorite}
              aria-label={(isFavorite ? 'Remove ' : 'Save ') + ex.n + (isFavorite ? ' from' : ' to') + ' favorites'}
              onClick={() => toggleFavorite(ex.id)}><Icon name={isFavorite ? 'heart' : 'star'} /></button>
            <Button size="sm" variant="tinted" icon="plus"
              onClick={() => addToRoutineSheet(ex)}>Plan</Button>
          </div>
        </article>
      })}
      {matching.length === 0 && <div className="tv-library-empty" role="status">
        <Icon name={mode === 'favorites' ? 'star' : 'magnifier'} size={30} />
        <strong>{mode === 'favorites' && !query ? 'No saved exercises yet' : mode === 'plan' && !query ? 'Your plan is empty' : mode === 'recent' && !query ? 'No workouts logged yet' : 'No exercises match'}</strong>
        <p>{mode === 'favorites' ? 'Save exercises using the star beside a movement.' :
          mode === 'plan' && !query ? 'Create a routine or load the starter training plan.' :
          mode === 'recent' && !query ? 'Finish a workout to see recently trained movements here.' :
          'Try a different name, muscle group, or equipment filter.'}</p>
        {mode === 'plan' && !query
          ? <Button onClick={() => nav('/plan')}>Build my plan</Button>
          : <Button onClick={() => { changeMode('all'); setFiltersOpen(false) }}>Explore all exercises</Button>}
      </div>}
    </div>

    {matching.length > shown && <Button className="tv-load-more"
      onClick={() => setShown(value => value + 40)}>Show more ({matching.length - shown} remaining)</Button>}

    <div className="tv-library-footer">
      <button type="button" className="tv-create-exercise" onClick={createExercise}>
        <Icon name="plus" /> Create a custom exercise
      </button>
      <p>Technique notes are general guidance, not a personalized movement assessment.
        Your saved exercises, plans and workouts remain on this device.</p>
      <a href="https://www.trivalley.fit/" target="_blank" rel="noopener noreferrer">
        Want a plan tailored to you? Explore TriValley.fit coaching
      </a>
    </div>
  </div>
}
