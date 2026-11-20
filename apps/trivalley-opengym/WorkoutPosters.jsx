import {useEffect,useRef,useState} from 'react'
import {useNavigate,useParams} from 'react-router-dom'
import {useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {uid} from '../lib/format.js'
import {exOr} from '../lib/exercises.js'
import {startFlow} from '../sheets.jsx'
import {QUICK_POSTERS,posterExercise,posterRoutine,savedPosterRoutine,installPoster} from '../lib/tv-learning.js'
import {RoutinePosterPreview} from '../components/WorkoutPoster.jsx'
import PosterSketch from '../components/PosterSketch.jsx'

export default function WorkoutPosters(){
 const nav=useNavigate(),{slug}=useParams(),heading=useRef(null),S=useStore(s=>s.S),update=useStore(s=>s.update),[error,setError]=useState('')
 const poster=QUICK_POSTERS.find(p=>p.key===slug),saved=poster&&savedPosterRoutine(S,slug),routine=poster&&(saved||posterRoutine(slug))
 useEffect(()=>{setError('');heading.current?.focus()},[slug])
 const save=(start=false)=>{
  if(start&&useStore.getState().S.active){setError('A workout is already in progress. Resume it before starting another.');return}
  try{
   let result
   update(draft=>{result=installPoster(draft,slug,uid);if(start)draft.tvWorkoutView='poster'})
   if(start)startFlow(result.id)
   else useUI.getState().toast(result.added?'Saved to My routines. Your training days are unchanged.':'This workout is already saved. Your edits are kept.')
  }catch(e){setError(e.message)}
 }
 if(slug&&!poster)return <main className="tv-learning"><h1 ref={heading} tabIndex={-1}>Workout poster not found</h1><button className="btn" onClick={()=>nav('/posters')}>Back to workout posters</button></main>
 if(poster){
  const edited=saved&&JSON.stringify(saved.ex)!==JSON.stringify(poster.ex)
  return <main className="tv-learning tv-poster-page" data-testid="tv-quick-poster-detail">
   <p className="tv-eyebrow">TRAIN WITH NICK · SHORT WORKOUT</p><h1 ref={heading} tabIndex={-1}>{routine.name}</h1>
   {edited?<p>Your saved version includes edits. Review its exercises and targets below before starting.</p>:<><p className="tv-resource-lead">{poster.summary}</p><dl className="tv-poster-brief"><div><dt>Time</dt><dd>{poster.time}</dd></div><div><dt>Bring</dt><dd>{poster.equipment}</dd></div><div><dt>For</dt><dd>{poster.audience}</dd></div></dl></>}
   <p className="small muted">Begin gently and adjust the targets to your ability. These are standalone sessions, not instructions to add extra training every day.</p>
   {S.active&&<aside className="tv-resource-note" role="status"><strong>Your current workout is still open.</strong><p>You can preview this poster without changing it.</p><button className="btn" onClick={()=>nav('/workout')}>Resume current workout</button></aside>}
   <RoutinePosterPreview routine={routine} exerciseResolver={saved?exOr:posterExercise} onClose={()=>nav('/posters')} startDisabled={!!S.active||!routine.ex.length} onStart={()=>save(true)}/>
   <div className="tv-resource-actions">{!saved?<button className="btn" onClick={()=>save(false)}>Save workout to My routines</button>:<><p className="small">Saved in My routines · your edits are kept.</p><button className="btn" onClick={()=>nav('/plan/r/'+saved.id)}>Edit my saved workout</button></>}</div>
   {error&&<p role="alert">{error}</p>}
   <details className="tv-resource-note"><summary>Exercise references</summary><p>Original TriValley programming and movement references. Some posters use generated Nick likeness illustrations, not real recordings. The references explain the movement; they do not prescribe this exact session.</p><ul>{[...new Map(poster.ex.map(c=>{const d=posterExercise(c.id);return [d.source,d]})).values()].map(d=><li key={d.source}><a href={d.source} target="_blank" rel="noopener noreferrer">{d.n} reference (opens a new tab)</a></li>)}</ul></details>
  </main>
 }
 return <main className="tv-learning" data-testid="tv-quick-posters">
  <button className="tv-text-action" onClick={()=>nav('/library')}>← Exercise Library</button><p className="tv-eyebrow">TRIVALLEY.FIT · WORKOUT POSTERS</p><h1 ref={heading} tabIndex={-1}>See the plan. Then train.</h1>
  <p className="tv-resource-lead">Choose a short session, preview every movement, then start when you are ready. Reading a poster does not start the clock or change your week.</p>
  <div className="tv-quick-poster-cards">{QUICK_POSTERS.map(p=><article className="card tv-quick-poster-card" key={p.key}>
   <span className="tv-eyebrow">{p.tag}</span><h2>{p.name}</h2><p className="small">{p.time} · {p.level}</p>
   <PosterSketch ex={posterExercise(p.ex[0].id)} compact/>
   <p>{p.summary}</p><p className="small muted">{p.equipment}</p><button className="btn primary" onClick={()=>nav('/posters/'+p.key)}>Preview {p.name}</button>
  </article>)}</div>
  <button className="tv-text-action" onClick={()=>nav('/learn/start-your-routine')}>New to training? Read my starting guide →</button>
 </main>
}
