import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { ACTIVITY_FACTORS, CALCULATORS, EXTERNAL_RESOURCES, MET_ACTIVITIES, calculateFitness, convertCalculatorInputs } from '../lib/tv-calculators.js'

const labels = {age:'Age (years)',weight:'Body weight',height:'Height',lift:'Weight lifted',reps:'Performed reps (1–10)',bodyFat:'Known body-fat estimate (%)',minutes:'Activity duration (minutes)',met:'Published MET value',carbPercent:'Carbohydrates (%)',proteinPercent:'Protein (%)',fatPercent:'Fat (%)'}
const format = value => typeof value === 'number' ? value.toLocaleString(undefined,{maximumFractionDigits:1}) : value
export default function FitnessCalculators() {
 const nav=useNavigate(), initialUnit=useStore(s=>s.S.unit)
 const [unit,setUnit]=useState(initialUnit==='kg'?'kg':'lb'), [selected,setSelected]=useState('calories')
 const [category,setCategory]=useState('All'), [query,setQuery]=useState(''), [values,setValues]=useState({activity:'1.2',goal:'maintain',ratio:'goal',metActivity:'02054'})
 const [result,setResult]=useState(null),[error,setError]=useState('')
 const resultHeading=useRef(null),formHeading=useRef(null),browse=useRef(null)
 const tool=CALCULATORS.find(tool=>tool.id===selected)
 const set=(key,value)=>{setValues(previous=>({...previous,[key]:value}));setResult(null);setError('')}
 const select=id=>{setSelected(id);setResult(null);setError('');if(browse.current)browse.current.open=false;requestAnimationFrame(()=>formHeading.current?.focus())}
 const numbers=(key)=>{
  const suffix=key==='weight'||key==='lift'?' ('+unit+')':key==='height'?' ('+(unit==='lb'?'total inches':'cm')+')':''
  const label=labels[key]+suffix
  return <label key={key} className="tv-calc-field" htmlFor={'tv-calc-'+key}><span>{label}</span><input id={'tv-calc-'+key} name={key} type="number" inputMode={key==='age'||key==='reps'?'numeric':'decimal'} step={key==='age'||key==='reps'?'1':'any'} value={values[key]??''} onChange={event=>set(key,event.target.value)} autoComplete="off" />
   {key==='height'&&unit==='lb'&&<small>Use total inches: 5 ft 10 in = 70 in; 6 ft = 72 in.</small>}
   {key==='bodyFat'&&<small>Use a measurement or estimate you already have. This app does not measure body fat.</small>}
  </label>
 }
 const choose=(key,label,options)=> <label className="tv-calc-field" htmlFor={'tv-calc-'+key}><span>{label}</span><select id={'tv-calc-'+key} value={values[key]??''} onChange={event=>set(key,event.target.value)}><option value="" disabled>Choose…</option>{options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 const filtered=CALCULATORS.filter(tool=>(category==='All'||tool.category===category)&&(tool.name+' '+tool.summary).toLowerCase().includes(query.toLowerCase()))
 const submit=event=>{
  event.preventDefault();setError('');setResult(null)
  try {setResult(calculateFitness(selected,values,unit));requestAnimationFrame(()=>resultHeading.current?.focus())}
  catch(error){setError(error.message)}
 }
 return <main className="tv-calculators" data-testid="tv-calculators">
  <button className="tv-text-action" onClick={()=>nav('/library')}>Back to exercise library</button>
  <header className="tv-calc-heading"><div><p className="tv-eyebrow">COACHED BY NICK · KNOW YOUR NUMBERS</p><h1>Fitness calculators</h1><p>I’ll help you turn your numbers into useful starting estimates.</p></div><img src="./assets/tv-coach-portrait.webp" width="58" height="58" alt="Nick Kaplan, TriValley.fit coach" /></header>
  <p className="tv-calc-intro">13 calculators in this app · 4 clearly marked external resources. Original TriValley tools, independently implemented from published methods; no Bodybuilding.com affiliation.</p>
  <div className="tv-calc-privacy">Your entries stay in this open calculator screen and are cleared when you leave. They are not sent to a server, added to your training records or passed to source websites.</div>
  <label className="tv-calc-search">Find a calculator<input type="search" value={query} onChange={event=>{setQuery(event.target.value);if(browse.current)browse.current.open=true}} placeholder="Try macros, protein or strength" /></label>
  <div className="tv-calc-categories" role="group" aria-label="Calculator categories">{['All','Nutrition','Body composition','Training','References'].map(value=><button key={value} aria-pressed={category===value} onClick={()=>{setCategory(value);if(browse.current)browse.current.open=true}}>{value}</button>)}</div>
  <label className="tv-calc-picker">Choose your calculator<select aria-label="Choose your calculator" value={selected} onChange={event=>select(event.target.value)}>{CALCULATORS.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
  <div className="tv-calc-layout"><details ref={browse} className="tv-calc-choices"><summary>Browse calculators & descriptions</summary><section aria-label="Calculator choices">
   <p role="status">{filtered.length} calculator{filtered.length===1?'':'s'}</p>
   <div className="tv-calc-card-grid">{filtered.map(item=><button type="button" key={item.id} className={'tv-calc-card'+(selected===item.id?' selected':'')} aria-pressed={selected===item.id} data-testid={'tv-calc-open-'+item.id} onClick={()=>select(item.id)}><span>{item.category}</span><strong>{item.name}</strong><small>{item.summary}</small></button>)}</div>
   {!filtered.length&&<p>No matching calculators. Try another word or select All.</p>}
  </section></details>
  <section className="tv-calc-form-card" aria-label="Calculator input and results">
   <h2 ref={formHeading} tabIndex={-1}>{tool.name}</h2><p>{tool.summary}</p>
   <fieldset className="tv-calc-units"><legend>Measurement units</legend>{[['lb','lb / inches'],['kg','kg / cm']].map(([value,label])=><button type="button" key={value} aria-pressed={unit===value} onClick={()=>{setValues(previous=>convertCalculatorInputs(previous,unit,value));setUnit(value);setResult(null);setError('')}}>{label}</button>)}</fieldset>
   <form noValidate onSubmit={submit} data-testid="tv-calculator-form"><div className="tv-calc-fields">
    {tool.fields.map(field=>field==='sex'?<div key={field}>{choose('sex','Equation coefficient',[['male','Male coefficient'],['female','Female coefficient']])}<p className="small muted">This coefficient is part of the published formula, not an identity label. Individual physiology may not fit either estimate well.</p></div>
     :field==='activity'?<div key={field}>{choose('activity','Usual activity',ACTIVITY_FACTORS.map(([value,label])=>[value,label+' · ×'+value]))}</div>
     :field==='goal'?<div key={field}>{choose('goal','Calorie goal',[['maintain','Maintain · estimated TDEE'],['lose','Loss example · 15% below TDEE'],['gain','Gain example · TDEE + 500 kcal']])}</div>
     :field==='ratio'?<div key={field}>{choose('ratio','Macro split',[['goal','Use goal-based split'],['custom','Enter custom percentages']])}{values.ratio==='custom'&&<div className="tv-calc-fields">{['carbPercent','proteinPercent','fatPercent'].map(numbers)}</div>}</div>
     :field==='metActivity'?<div key={field}>{choose('metActivity','Activity / intensity',MET_ACTIVITIES.map(([id,met,label])=>[id,label+(met?' · '+met+' MET':'')]))}{values.metActivity==='custom'&&numbers('met')}</div>
     :numbers(field))}
   </div><button className="btn primary tv-calc-submit" type="submit">Calculate my estimate</button>
   <button className="btn tv-calc-reset" type="button" onClick={()=>{setValues({activity:'1.2',goal:'maintain',ratio:'goal',metActivity:'02054'});setResult(null);setError('')}}>Clear my calculator entries</button>
   {error&&<p role="alert" className="tv-calc-error">{error}</p>}</form>
   {result&&<section className="tv-calc-result" data-testid="tv-calc-result" aria-label="Calculator result"><h3 ref={resultHeading} tabIndex={-1}>Your starting estimate</h3><p>{result.explanation}</p><dl>{result.rows.map((row,index)=><div key={index}><dt>{row.label}</dt><dd>{format(row.value)} <small>{row.unit}</small></dd></div>)}</dl>
    <p className="small">Rounded for display. No training or nutrition setting has been changed.</p>
    <details><summary>Formula, assumptions & sources</summary><p>{result.method}</p>{result.notes.map(note=><p key={note}>{note}</p>)}<ul>{result.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{source.label} (opens a new tab)</a></li>)}</ul></details>
   </section>}
   <p className="small muted">For adults. These tools estimate group-based values; they do not measure metabolism, diagnose a condition or prescribe treatment. I want you to compare estimates with actual progress and seek qualified guidance when needed.</p>
  </section></div>
  <details className="tv-calc-external"><summary>4 external resources · not calculators inside this app</summary><p>These entries complete the verified retailer catalog map. No formula or medical result is supplied here.</p>{EXTERNAL_RESOURCES.map(resource=><article key={resource.id}><h3>{resource.name}</h3><p>{resource.note}</p><a href={resource.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open external resource (new tab)</a></article>)}<p className="small">Catalog checked November 20, 2026: both current listing pages plus the separately indexed protein page. Archived or unlisted historical tools may exist; exhaustive historical coverage is unverified. Exercise burn includes seven selected 2024 MET presets and a custom MET input, rather than copying the retailer’s activity menu.</p></details>
 </main>
}
