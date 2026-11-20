import {useEffect,useRef,useState} from 'react'
import {useNavigate,useParams} from 'react-router-dom'
import {LESSONS,LABEL_SOURCE,proteinPortion,LEARNING_REVIEW_DATE} from '../lib/tv-learning.js'

export function LibraryLearningLinks(){
 const nav=useNavigate()
 return <section className="tv-resource-links" aria-label="Learn and workout posters" data-testid="tv-resource-links">
  <button type="button" onClick={()=>nav('/learn')}><strong>Learn with Nick</strong><span>5 short guides · protein portions →</span></button>
  <button type="button" onClick={()=>nav('/posters')}><strong>Workout posters</strong><span>7 short sessions · illustrations, timers & logging →</span></button>
 </section>
}
function ProteinPortions(){
 const [values,setValues]=useState({servingGrams:'',proteinGrams:'',wantedProtein:''}),[result,setResult]=useState(null),[error,setError]=useState('')
 const output=useRef(null)
 const change=(key,value)=>{setValues(v=>({...v,[key]:value}));setResult(null);setError('')}
 const calculate=e=>{e.preventDefault();try{setResult(proteinPortion(values));setError('')}catch(e){setResult(null);setError(e.message)}}
 useEffect(()=>{if(result)output.current?.focus()},[result])
 return <>
  <p className="tv-resource-lead">Use the label on the food you actually have. I want you to distinguish the weight of the food from the grams of protein it contains.</p>
  <ol className="tv-label-steps"><li><b>1</b><span>Find the serving weight in grams.</span></li><li><b>2</b><span>Find grams of protein per serving.</span></li><li><b>3</b><span>Scale to the protein amount you choose.</span></li></ol>
  <p>Check whether the label describes the food dry, cooked, drained or prepared. Use that same state when weighing it. A label’s serving size is not a recommendation for how much you should eat.</p>
  <form className="tv-portion-form" onSubmit={calculate} noValidate data-testid="tv-portion-form">
   {[['servingGrams','Serving weight on label (g)'],['proteinGrams','Protein per serving (g)'],['wantedProtein','Protein amount I want to calculate (g)']].map(([key,label])=><label key={key} htmlFor={'tv-portion-'+key}>{label}<input id={'tv-portion-'+key} type="text" inputMode="decimal" autoComplete="off" value={values[key]} onChange={e=>change(key,e.target.value)} aria-describedby="tv-portion-help"/></label>)}
   <p className="small muted" id="tv-portion-help">Use the protein grams, not the protein % Daily Value. These entries stay on this screen and clear when you leave.</p>
   <button type="submit" className="btn primary">Calculate my portion</button>
   {error&&<p role="alert">{error}</p>}
   {result&&<section className="tv-portion-result" ref={output} tabIndex={-1} aria-label="Protein portion result" data-testid="tv-portion-result"><h2>About {Math.round(result.foodGrams*10)/10} g of food</h2><p>That is about {Math.round(result.servings*100)/100} label servings for {result.wantedProtein} g of protein.</p><p className="small">Label arithmetic is approximate. This does not set a daily protein goal or change your nutrition targets.</p></section>}
  </form>
  <details className="tv-resource-note"><summary>See a worked example</summary><p>If a 200 g pot lists 20 g of protein, a 25 g protein amount works out to 1.25 pots, or 250 g of that food. This is an invented label example, not a verified food or a serving recommendation.</p></details>
  <a href={LABEL_SOURCE} target="_blank" rel="noopener noreferrer">How to read serving sizes · FDA (opens a new tab)</a>
 </>
}
export default function Learn(){
 const nav=useNavigate(),{slug}=useParams(),heading=useRef(null)
 useEffect(()=>{heading.current?.focus()},[slug])
 const lesson=LESSONS.find(l=>l.slug===slug),protein=slug==='protein-portions'
 if(slug&&!lesson&&!protein)return <section className="tv-learning"><h1 ref={heading} tabIndex={-1}>Guide not found</h1><button className="btn" onClick={()=>nav('/learn')}>Back to Learn</button></section>
 return <main className="tv-learning" data-testid="tv-learning">
  <button className="tv-text-action" onClick={()=>nav(slug?'/learn':'/library')}>{slug?'← All learning guides':'← Exercise Library'}</button>
  <p className="tv-eyebrow">TRAIN WITH NICK · PRACTICAL GUIDES</p>
  <h1 ref={heading} tabIndex={-1}>{protein?'Protein portions':lesson?.title||'Learn with Nick'}</h1>
  {!slug?<>
   <p className="tv-resource-lead">A little understanding makes your next session easier. Start with the guide that answers your question today.</p>
   <div className="tv-lesson-grid">{LESSONS.map((l,i)=><button key={l.slug} className="tv-lesson-link" onClick={()=>nav('/learn/'+l.slug)} data-testid={'tv-lesson-'+i}><span className="tv-eyebrow">GUIDE {i+1} · ABOUT 1–2 MIN</span><strong>{l.title}</strong><span>{l.kicker}</span><span className="tv-resource-action">Read guide →</span></button>)}</div>
   <section className="card tv-resource-feature"><h2>Turn a label into a useful portion</h2><p>Calculate food weight from the protein on your own food’s label.</p><button className="btn" onClick={()=>nav('/learn/protein-portions')}>Open protein portions</button></section>
   <button className="tv-text-action" onClick={()=>nav('/posters')}>Put it into practice · workout posters →</button>
  </>:protein?<ProteinPortions/>:<article className="tv-lesson-article" data-testid="tv-lesson-article">
   <p className="tv-resource-lead">{lesson.intro}</p>
   {lesson.sections.map(([title,text])=><section key={title}><h2>{title}</h2><p>{text}</p></section>)}
   <aside className="tv-lesson-takeaway"><strong>Take this into your next session</strong><p>{lesson.takeaway}</p></aside>
   <button className="btn primary" onClick={()=>nav(lesson.action.to)}>{lesson.action.label}</button>
   <details className="tv-resource-note"><summary>Further reading</summary><a href={lesson.source} target="_blank" rel="noopener noreferrer">Training reference (opens a new tab)</a><p className="small muted">Original TriValley guide · updated {LEARNING_REVIEW_DATE}. General education; ask me to adapt your training when you need individual help.</p></details>
  </article>}
 </main>
}
