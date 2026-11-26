import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { SWAPS, swapExercise, weightConvention, nextSessionMessage } from '../lib/tv-workout-tools.js'

export function WeightGuidance({ex, plan, target, unit}) {
 const guide=weightConvention(ex)
 return <details className="tv-load-guide" data-testid="tv-load-guide"><summary>How to log weight · {guide.label}</summary><p>{guide.text}</p>{plan&&<p data-testid="tv-next-load"><strong>My next-step guidance: </strong>{nextSessionMessage(plan,target,unit)}</p>}<p className="small muted">Keep your existing logging convention for old records. The app does not convert or relabel those numbers.</p></details>
}
export function ExerciseSwap({entry,index,routineId,activeId}) {
 const [open,setOpen]=useState(false),[choice,setChoice]=useState(''),[error,setError]=useState('')
 const S=useStore(s=>s.S), update=useStore(s=>s.update), options=SWAPS[entry.id]||[]
 if(!options.length||!routineId&&!activeId)return null
 const performed=!!activeId&&entry.sets?.some(s=>s.done)
 const blocked=performed || !!S.active&&(!activeId||S.active.id!==activeId)
 const confirm=()=>{try{update(s=>swapExercise(s,{scope:activeId?'active':'routine',ownerId:activeId||routineId,index,fromId:entry.id,toId:choice}));setOpen(false);useUI.getState().toast('Exercise replaced. Choose a fresh working weight.')}catch(e){setError(e.message)}}
 return <div className="tv-exercise-swap" data-testid="tv-exercise-swap">
  <button type="button" className="tv-text-action" disabled={blocked||!routineId&&!activeId} onClick={()=>{setOpen(!open);setChoice('');setError('')}}>Equipment busy? Replace exercise</button>
  {performed&&<p className="small muted">Logged sets stay intact. Add another exercise if you need to change movements now.</p>}
  {open&&<section className="tv-swap-choices" aria-label={'Replace '+exOr(entry.id).n}>
   <p>Choose an equipment alternative you already know. Sets, reps and rest stay; the old weight is cleared and automatic increases are turned off for the replacement. Your history stays unchanged.</p>
   {options.map(option=><label key={option.id}><input type="radio" name={'swap-'+index} value={option.id} checked={choice===option.id} onChange={()=>setChoice(option.id)}/><span><strong>{exOr(option.id).n}</strong><small>{option.note}</small></span></label>)}
   <p className="small muted">This changes {activeId?'this session only':'this saved routine for future sessions'}. A replacement is not a solution for pain; stop and ask me for help if a movement hurts.</p>
   <div className="tv-program-card-buttons"><button type="button" className="btn primary" disabled={!choice} onClick={confirm}>Confirm replacement</button><button type="button" className="btn" onClick={()=>setOpen(false)}>Keep original</button></div>
   {error&&<p role="alert">{error}</p>}
  </section>}
 </div>
}
