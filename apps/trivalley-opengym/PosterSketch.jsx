import {posterExercise} from '../lib/tv-learning.js'

// Original inline SVG movement schematics. No archive artwork, photos or external assets.
function Pose({type,phase,right}){
 const raised=phase===1
 let head,paths=[],extra=null
 if(type==='squat'){
  head=raised?[111,44]:[90,22]
  paths=raised?['M105 60 L72 88 L110 102 L93 133 L115 133','M104 65 L138 76 L155 76']:['M90 38 L90 86 L89 132 L111 132','M90 52 L104 77 L119 82']
 }else if(type==='bridge'){
  head=[24,117];paths=['M37 119 L75 '+(raised?94:124)+' L111 73 L139 133 L158 133','M39 121 L78 129']
 }else if(type==='calf'){
  head=[83,raised?16:24];paths=raised?['M83 32 L83 82 L80 119 L97 133 L115 133','M84 49 L108 65 L145 65']:['M83 40 L83 90 L80 133 L115 133','M84 57 L108 65 L145 65'];extra=<path d="M145 15 V134"/>
 }else if(type==='plank'){
  head=[27,76];paths=['M42 85 L92 99 L'+(raised?'153 115 L162 133':'120 133 L153 133'),'M44 86 L44 132 L17 132']
 }else if(type==='side'){
  head=[34,52];paths=['M45 68 L90 '+(raised?98:127)+' L132 133 L114 133','M48 72 L48 132 L21 132','M47 76 L74 83'];
 }else if(type==='wall'){
  head=raised?[114,35]:[84,29];paths=raised?['M113 51 L87 91 L63 133 L81 133','M113 55 L126 76 L157 58']:['M84 45 L75 87 L63 133 L81 133','M86 51 L121 58 L157 58'];extra=<path d="M157 16 V134"/>
 }else{
  head=[92,23];paths=raised?['M92 39 L92 86 L115 105 L119 133 L136 133','M92 86 L67 92 L58 113 L75 113','M92 51 L116 66 L127 49','M92 51 L67 71 L55 61']:['M92 39 L92 86 L71 105 L67 133 L50 133','M92 86 L117 92 L127 113 L110 113','M92 51 L68 66 L57 49','M92 51 L117 71 L129 61']
 }
 return <g transform={right?'translate(180 0) scale(-1 1)':undefined} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><circle cx={head[0]} cy={head[1]} r="11"/>{paths.map((d,i)=><path key={i} d={d}/>)}{extra}</g>
}
export default function PosterSketch({ex,compact=false,collapsible=false}){
 const d=posterExercise(ex?.id)
 if(!d||ex?.tvPosterVersion!==1||ex.n!==d.n)return null
 const labels=d.pose==='plank'?['Knees down option','Hold with control']:d.pose==='side'?['Supported setup','Lift and hold']:d.pose==='march'?['One step','Then the other']:['Set up','Move with control']
 const figure=<figure className={'tv-poster-sketch'+(compact?' tv-sketch-compact':'')} data-testid="tv-poster-sketch">
  <svg viewBox="0 0 390 165" role="img" aria-label={d.n+': '+labels.join(', then ')+'. Read the written cues for setup and easier options.'}>
   <path d="M10 140 H185 M205 140 H380" stroke="currentColor" strokeOpacity=".25"/>
   <g transform="translate(5 0)"><Pose type={d.pose} phase={0} right={d.id.endsWith('right')}/></g><g transform="translate(200 0)"><Pose type={d.pose} phase={1} right={d.id.endsWith('right')}/></g>
   <g fill="currentColor" fontSize="12" textAnchor="middle"><text x="98" y="160">1 · {labels[0]}</text><text x="293" y="160">2 · {labels[1]}</text></g>
  </svg>
  {!compact&&<figcaption>Movement sketch · use the written cues. This is a reference, not a video or a personal form check.</figcaption>}
 </figure>
 return collapsible?<details className="tv-movement-reference"><summary>View movement sketch</summary>{figure}</details>:figure
}

export function PosterSessionGuide({template}){
 if(template?.id!=='trivalley-quick-posters')return null
 const text=template.day==='easy-circuit'?'Circuit order: complete set 1 on each card from top to bottom, then rest 60 seconds. Repeat using set 2 on each card. Take time to change position; each timer measures the movement, not the transition.':template.day==='plank-practice'?'Each side has its own entry and timer. Record the left and right holds separately, and end each hold before you lose control.':'Complete the two sets for each exercise before moving to the next card. Use bodyweight only to begin.'
 return <aside className="tv-resource-note" data-testid="tv-poster-session-guide"><strong>Your short-session guide</strong><p>{text}</p></aside>
}
