// Equipment substitutions are explicit choices for the included Main 16.
// They are not pain/rehabilitation prescriptions and never rewrite performed work.
export const SWAPS = {
 '2330': [{id:'0579', note:'Machine vertical pull; adjust the seat and thigh support.'}],
 '0861': [{id:'0293', note:'Dumbbell row; hold the hip hinge steady. This requires more trunk control.'}],
 '0383': [{id:'0602', note:'Seated machine rear-shoulder fly; adjust the seat to line up the handles.'}],
 '0294': [{id:'0031', note:'Barbell curl; record the bar and plates together.'}],
 '0313': [{id:'0165', note:'Cable rope hammer curl; keep the neutral grip.'}],
 '0289': [{id:'0577', note:'Machine chest press; adjust the seat and use its own load.'}],
 '0314': [{id:'1299', note:'Incline machine chest press; use the machine’s own setup and load.'}],
 '0405': [{id:'0603', note:'Machine shoulder press; adjust the seat and keep the back supported.'}],
 '0334': [{id:'0178', note:'Single-arm cable lateral raise; perform the target reps on each side.'}],
 '0200': [{id:'0201', note:'Cable pushdown with a straight attachment; keep the elbows still.'}],
 '0194': [{id:'2188', note:'Seated dumbbell extension; use one dumbbell held with both hands.'}],
 '0739': [{id:'1760', note:'Goblet squat; a free-weight squat option rather than a machine equivalent. Choose a controlled depth.'}],
 '1459': [{id:'0085', note:'Barbell Romanian deadlift; record the total bar and plates.'}],
 '0586': [{id:'0599', note:'Seated leg curl; adjust the backrest and pads for the new position.'}],
 '0585': [{id:'1760', note:'Goblet squat; a compound quad exercise rather than an isolation equivalent. Review the extra squat volume.'}],
 '0605': [{id:'0417', note:'Dumbbell standing calf raise; use a stable setup and controlled movement.'}]
}
export function weightConvention(ex) {
 const eq=String(ex?.eq||'').toLowerCase(), name=String(ex?.n||'').toLowerCase()
 if (['2188','0430'].includes(ex?.id)) return {label:'One shared dumbbell', text:'Enter the weight of the single dumbbell you hold with both hands.'}
 if (eq.includes('dumbbell')) return {label:'Per dumbbell', text:'Enter one dumbbell’s weight. Two 25 lb dumbbells are logged as 25 lb, not 50 lb. For one-arm work, use the working dumbbell’s weight and complete both sides.'}
 if (eq.includes('barbell')) return {label:'Bar + all plates', text:'Enter the total weight of the bar plus plates on both sides. Example: a 45 lb bar and two 10 lb plates = 65 lb.'}
 if (eq.includes('cable')) return {label:'Displayed cable load', text:'Use the selected weight shown on the cable stack. For one-arm work, log that side’s selected load and complete both sides. Compare progress on the same machine.'}
 if (eq.includes('machine') || eq.includes('sled')) return {label:'Machine-specific load', text:'For a weight stack, enter its displayed setting. For a plate-loaded machine, count the added plates on both sides. Keep the same machine and loading convention; do not copy another exercise’s weight.'}
 if (eq==='body weight') return {label:'Added weight only',text:'Log 0 for bodyweight-only work, or the external weight added. Body weight is recorded separately.'}
 return {label:'Consistent equipment load',text:'Record the external load you actually use and keep the same convention each session. Previous saved numbers are not converted.'}
}
export function swapExercise(S, {scope, ownerId, index, fromId, toId}) {
 if (!Number.isInteger(index)||index<0||!SWAPS[fromId]?.some(x=>x.id===toId)) throw Error('This exercise replacement is not available.')
 if (scope==='active') {
  const A=S.active
  if (!A || A.id!==ownerId || A.entries?.[index]?.id!==fromId) throw Error('Your session changed. Reopen the replacement choices.')
  if (A.entries.some((e,i)=>i!==index&&e.id===toId)) throw Error('That exercise is already in this session.')
  const entry=A.entries[index]
  if (entry.sets?.some(s=>s.done)) throw Error('You have logged sets here. Keep them and add another exercise instead.')
  const target={...entry.target,id:toId,weight:0,loadRequired:true,prog:'off'}
  // All old loads, progression plans and equipment-specific settings are discarded.
  delete target.inc
  const sets=entry.sets.map(s=>({...s,w:0,done:false}))
  A.entries[index]={id:toId,sg:entry.sg,target,sets,plan:{policy:'off',kind:'first'},tvSwappedFrom:fromId}
  return
 }
 if (scope==='routine') {
  const R=S.routines?.find(r=>r.id===ownerId)
  if (!R || R.ex?.[index]?.id!==fromId) throw Error('Your routine changed. Reopen the replacement choices.')
  if (S.active?.routineId===ownerId) throw Error('Finish the active session before changing its saved routine.')
  if (R.ex.some((e,i)=>i!==index&&e.id===toId)) throw Error('That exercise is already in this routine.')
  const cfg={...R.ex[index],id:toId,weight:0,loadRequired:true,prog:'off',tvSwapSince:Date.now()};delete cfg.inc
  R.ex[index]=cfg
  return
 }
 throw Error('Unknown replacement location.')
}
export function nextSessionMessage(plan, target, unit='lb') {
 if (!plan || plan.kind==='first') return 'Start with a light practice set. Choose a working load you can control, leaving about 2–3 good reps in reserve.'
 if (plan.kind==='off') return 'Use the targets you chose. Automatic increases are off for this exercise.'
 const fields=[]
 if(Number.isFinite(plan.weight))fields.push(plan.weight+' '+unit)
 if(Number.isFinite(plan.reps))fields.push(plan.reps+' reps')
 if(Number.isFinite(plan.sec))fields.push(plan.sec+' seconds')
 const reason=plan.kind==='up'?'Your recorded sets earned an increase.':plan.kind==='deload'?'The saved progression policy suggests a lighter target.':'Keep building controlled reps before increasing the load.'
 return reason+(fields.length?' Suggested target: '+fields.join(' · ')+'.':'')+' Match it to the weights available; this is a suggestion, not a required load.'
}
export function feedbackText({category='Navigation',details='',route='',version='',browser=''}) {
 const safeRoute=String(route).split('?')[0].slice(0,80)
 return ['TriValley Training Companion feedback','Category: '+String(category).slice(0,50),'App: '+String(version).slice(0,30),'Screen: '+safeRoute,'Browser: '+String(browser).slice(0,220),'','What happened / what I expected:',String(details).slice(0,2000),'','No workout history, body weights, lifting values or account data are attached automatically.'].join('\n')
}

export function freshSwapLoad(S,cfg,now=Date.now()) {
 if(!Number.isFinite(cfg.tvSwapSince))return false
 return !(S.workouts||[]).some(w=>Number.isFinite(w.end)&&w.end>=cfg.tvSwapSince&&w.end<=now&&w.unit===S.unit&&(w.entries||[]).some(e=>e.id===cfg.id&&(e.sets||[]).some(set=>set.done&&set.w>0)))
}
