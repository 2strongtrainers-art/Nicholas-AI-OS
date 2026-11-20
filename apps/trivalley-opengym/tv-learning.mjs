import {ILLUSTRATED_EXERCISES, ILLUSTRATED_POSTERS} from './tv-illustrated-presets.mjs'
// Original TriValley lessons and short sessions. No archived graphics or guest copy is republished.
export const LEARNING_REVIEW_DATE = '2026-11-20'
export const TRAINING_SOURCE = 'https://acsm.org/resistance-training-guidelines-update-2026/'
export const LABEL_SOURCE = 'https://www.fda.gov/food/nutrition-facts-label/serving-size-nutrition-facts-label'
export const LESSONS = [
 {slug:'start-your-routine',title:'Start your routine',kicker:'A first step you can repeat',intro:'I want your first session to leave you confident about coming back. Choose a workout that fits the equipment, time and movements you are comfortable with today.',sections:[
  ['Choose your session','Use Programs for the gym split, or try a short bodyweight poster. Preview the full exercise list before you start. A short poster is a standalone option; it is not a complete weekly training plan.'],
  ['Practise before you push','Begin with a few minutes of easy movement and a light practice of the movements you picked. Use a smaller range or easier variation when needed. If an exercise hurts, stop and ask for help.'],
  ['Record what happened','Start the workout when you are ready. Adjust each set to what you actually did, then log it. Finish the session so the app can show your record next time. I do not automatically receive your workout log.']
 ],takeaway:'Pick a session you can repeat, rather than trying to prove everything in one workout.',action:{label:'Preview a short workout',to:'/posters'},source:TRAINING_SOURCE},
 {slug:'set-a-useful-goal',title:'Set a useful goal',kicker:'Give this week a clear direction',intro:'Start with one thing you want your training to help you do. Then choose an action you can control this week.',sections:[
  ['Name the outcome','Your outcome might be feeling more capable in the gym, building strength or getting back into a routine. Be specific about what success would look like for you.'],
  ['Choose a repeatable action','A practical action could be attending two planned sessions or logging every set you perform. Choose a target that fits your real schedule and current ability. Write it in your own calendar or notes. Reading this guide does not change your app schedule.'],
  ['Review and adjust','At the end of the week, look at what you completed and what got in the way. Keep what worked and change one obstacle. If the target was too ambitious, make the next action easier to repeat.']
 ],takeaway:'Use an outcome for direction and a manageable action for your next step.',action:{label:'Review my training days',to:'/plan'},source:TRAINING_SOURCE},
 {slug:'stay-consistent',title:'Stay consistent',kicker:'Build a routine that survives real life',intro:'You will have busy days. I want you to have a practical way back to training when your week changes.',sections:[
  ['Remove a small obstacle','Set out what you need, choose a convenient time and know which workout you plan to do. If equipment is busy, review an alternative before changing the exercise. A different machine needs its own load.'],
  ['Make a manageable backup plan','A shorter session can be an option when it fits your ability and recovery. If you stop partway through, save the actual work as a partial session. Do not mark unperformed sets complete to make the week look better.'],
  ['Return without making up a debt','A missed session is information about the plan. Resume with a sensible workload rather than squeezing missed training into one exhausting day. Check how you feel and ask me to help adjust the plan when needed.']
 ],takeaway:'Aim for an honest record and a repeatable next session.',action:{label:'View my recorded progress',to:'/stats'},source:TRAINING_SOURCE},
 {slug:'learn-a-movement',title:'Learn a movement',kicker:'Understand one cue at a time',intro:'Before adding effort, I want you to understand the setup and the movement. A clear, controlled practice is more useful than rushing through a picture.',sections:[
  ['Find the setup','Read the exercise name, equipment and instructions. Notice the support points: feet, hands, bench or floor. Choose a position and range you can control. Ask for a demonstration if the instructions are unclear.'],
  ['Practise a single cue','Use a light load or easier variation and focus on one instruction, such as a steady torso or a controlled return. Breathe throughout. You can stop, reset and practise again; the timer is not a reason to keep going with poor control.'],
  ['Use illustrations as a reference','The Main 16 use generated likeness illustrations. Short posters use simple movement sketches. Neither is a recording of you or a personal technique assessment. Written cues and a coach’s feedback matter more than matching a sketch exactly.']
 ],takeaway:'Understand the setup, practise with control, then decide whether you are ready for more.',action:{label:'Explore exercise instructions',to:'/library'},source:'https://www.acefitness.org/resources/everyone/exercise-library/'},
 {slug:'progress-and-recover',title:'Progress and recover',kicker:'Use your record to choose the next step',intro:'Progress can mean an extra controlled rep, a steadier movement or a routine you can keep doing. More weight is one tool, not the only one.',sections:[
  ['Compare like with like','Compare the same exercise, equipment, logging convention and units. For dumbbells, enter one dumbbell’s weight. A machine’s displayed setting does not transfer directly to a different machine.'],
  ['Treat suggestions as suggestions','The gym split can suggest changes from your recorded sets. Check the target against your technique and the weights available. The short bodyweight posters start with automatic increases off; adjust their targets deliberately when you are ready.'],
  ['Leave room to recover','Give yourself time between demanding sessions. If you feel unusually fatigued or a movement hurts, reduce or stop the work and ask for help. These short posters are options, not instructions to add extra training every day.']
 ],takeaway:'Make the next step deliberate, using your actual record and how you are moving.',action:{label:'Review my programs',to:'/plan'},source:TRAINING_SOURCE}
]

const ace = path => 'https://www.acefitness.org/resources/everyone/exercise-library/' + path
const definition = (key,n,bp,tg,pose,steps,easier,source) => ({id:'tv-poster-v1-'+key,n,bp,tg,eq:'body weight',sm:[],custom:true,tvPosterVersion:1,pose,st:steps,desc:'TriValley bodyweight practice. '+easier,easier,source})
export const POSTER_EXERCISES = [
 definition('squat','Bodyweight squat','upper legs','quads','squat',[
  'Stand with your feet around shoulder width, with toes turned out a little if comfortable. Keep your whole foot supported.',
  'Bend at your hips and knees, lowering only as far as you can control. Let your knees follow the direction of your toes.',
  'Press through your feet to stand. Keep breathing and avoid bouncing at the bottom.'
 ],'Use a shallower bend and light support from a fixed counter. Stop if it hurts.',ace('135/bodyweight-squat/')),
 definition('bridge','Glute bridge','upper legs','glutes','bridge',[
  'Lie on your back with knees bent and feet flat, around hip width. Keep your arms resting beside you.',
  'Gently tighten your trunk and lift your hips until your thighs and torso form a comfortable line.',
  'Lower with control. Avoid arching your lower back to lift higher.'
 ],'Lift your hips a smaller distance and use a comfortable foot position.',ace('49/glute-bridge/')),
 definition('calf','Supported calf raise','lower legs','calves','calf',[
  'Stand on level ground beside a wall or fixed counter. Use light hand support for balance.',
  'Raise both heels slowly while keeping your weight over the balls of your feet.',
  'Lower your heels gently to the floor. Avoid bouncing or rolling onto the outer edges of your feet.'
 ],'Use a smaller heel lift and firmer support. Keep both feet on level ground.',ace('experience/beginner/?page=7')),
 definition('plank','Forearm plank','waist','abs','plank',[
  'Place your forearms on a mat with elbows under shoulders. Extend your legs, or keep your knees down for an easier hold.',
  'Keep a comfortable line through your trunk without letting the lower back sag. Breathe normally.',
  'End the hold before you lose control. Lower your knees and reset; record the seconds you actually held.'
 ],'Keep your knees on the mat or use a shorter hold.',ace('32/front-plank/')),
 definition('side-left','Kneeling side plank — left','waist','abs','side',[
  'Lie on your left side with knees bent. Place your left elbow under your shoulder and keep your lower knee supported on the mat.',
  'Lift your hips a comfortable distance, keeping your head and trunk aligned. Breathe throughout the hold.',
  'Lower gently before your position changes. This entry is the left side; the right side has its own entry and timer.'
 ],'Use a shorter hold or lift your hips a smaller distance. Stop if your shoulder hurts.',ace('100/side-plank-modified/')),
 definition('side-right','Kneeling side plank — right','waist','abs','side',[
  'Lie on your right side with knees bent. Place your right elbow under your shoulder and keep your lower knee supported on the mat.',
  'Lift your hips a comfortable distance, keeping your head and trunk aligned. Breathe throughout the hold.',
  'Lower gently before your position changes. This entry is the right side; the left side has its own entry and timer.'
 ],'Use a shorter hold or lift your hips a smaller distance. Stop if your shoulder hurts.',ace('100/side-plank-modified/')),
 definition('wall-push','Wall push-up','chest','pectorals','wall',[
  'Face a fixed wall and place your hands around shoulder height, slightly wider than your shoulders. Step back a comfortable distance.',
  'Bend your elbows to bring your chest toward the wall, keeping your trunk steady.',
  'Press away with control. Keep your feet supported and avoid flaring your elbows straight out.'
 ],'Stand closer to the wall and use a smaller bend.',ace('equipment/no-equipment/')),
 definition('march','Easy march in place','cardio','cardiovascular system','march',[
  'Stand tall on a clear, level surface beside a fixed support if needed.',
  'Alternate lifting your feet a comfortable distance without jumping. Move at a pace where you can speak comfortably.',
  'Keep the steps controlled. Slow down or stop if you feel unsteady or unusually breathless.'
 ],'Use smaller steps, move more slowly and hold a fixed support.',TRAINING_SOURCE)
]
POSTER_EXERCISES.push(...ILLUSTRATED_EXERCISES)
export const posterExercise = id => POSTER_EXERCISES.find(e=>e.id===id) || null
const id = key => 'tv-poster-v1-' + key
const cfg = (key,sets,value,mode='reps',restSec=60,sg) => ({id:id(key),sets,...(mode==='time'?{sec:value}:{reps:value}),mode,weight:0,prog:'off',restSec,tvPoster:true,...(sg?{sg}:{})})
export const QUICK_POSTERS = [
 {key:'lower-body',name:'Lower-body basics',tag:'Controlled bodyweight practice',level:'Start easy',time:'10–15 min estimated',equipment:'Level floor, optional mat and fixed support',audience:'Adults comfortable standing and getting to the floor.',summary:'Squat, bridge and calf raise. Complete each exercise’s sets before moving on.',ex:[cfg('squat',2,8),cfg('bridge',2,10),cfg('calf',2,12)]},
 {key:'plank-practice',name:'Plank practice',tag:'A short core sequence',level:'Floor-based core practice',time:'6–10 min estimated',equipment:'Mat and clear floor space',audience:'Adults comfortable supporting themselves on forearms and knees.',summary:'Forearm hold, then left and right kneeling side holds. Each side has its own timer and log.',ex:[cfg('plank',2,15,'time',30),cfg('side-left',2,10,'time',30),cfg('side-right',2,10,'time',30)]},
 {key:'easy-circuit',name:'Move & reset',tag:'A simple timed circuit',level:'Low-impact option',time:'8–12 min estimated',equipment:'Fixed wall, level floor and clear space',audience:'Adults comfortable standing, squatting and pushing against a wall.',summary:'Two rounds: 30 seconds of squats, wall push-ups and easy marching, in that order. Take time to change position; rest 60 seconds after each round.',ex:[cfg('squat',2,30,'time',0,'tv-easy-circuit'),cfg('wall-push',2,30,'time',0,'tv-easy-circuit'),cfg('march',2,30,'time',60,'tv-easy-circuit')]}
]
QUICK_POSTERS.push(...ILLUSTRATED_POSTERS)
export function savedPosterRoutine(S,key) {
 return (S.routines||[]).find(r=>r.tvTemplate?.id==='trivalley-quick-posters'&&r.tvTemplate.day===key)||null
}
export function posterRoutine(key,routineId='preview-poster-'+key) {
 const p=QUICK_POSTERS.find(p=>p.key===key)
 if(!p)throw Error('That workout poster is not available.')
 return {id:routineId,name:p.name,emoji:'dumbbell',prog:'off',tvTemplate:{id:'trivalley-quick-posters',version:1,day:key},tvWarmup:'Start with 2–3 minutes of easy movement and practise a few gentle repetitions. Warm-up is separate from the targets below.',tvEffort:'Move with control and keep breathing. Use an easier option or shorter set when needed. Stop if a movement hurts. These are general short sessions, not a personal assessment or a full weekly program.',ex:p.ex.map(x=>({...x}))}
}
// Called only after an explicit Save/Start action in the existing cloned-draft store update.
export function installPoster(S,key,makeId) {
 const template=posterRoutine(key)
 const existing=savedPosterRoutine(S,key)
 const definitions=(existing?existing.ex:template.ex).map(c=>posterExercise(c.id)).filter(Boolean)
 for(const d of definitions) {
  const prev=(S.customEx||[]).find(x=>x.id===d.id)
  if(prev&&(prev.tvPosterVersion!==1||prev.n!==d.n||prev.pose!==d.pose))throw Error('A saved exercise uses the same ID. Keep your data and ask for help before adding this poster.')
 }
 if(existing){
  const missing=definitions.filter(d=>!(S.customEx||[]).some(x=>x.id===d.id))
  if(missing.length)S.customEx=[...(S.customEx||[]),...missing.map(d=>JSON.parse(JSON.stringify(d)))]
  return {id:existing.id,added:false}
 }
 if(typeof makeId!=='function')throw Error('A routine ID generator is required.')
 const routineId=makeId()
 if(typeof routineId!=='string'||!routineId||(S.routines||[]).some(r=>r.id===routineId))throw Error('The routine ID must be unique.')
 const missing=definitions.filter(d=>!(S.customEx||[]).some(x=>x.id===d.id))
 S.customEx=[...(S.customEx||[]),...missing.map(d=>JSON.parse(JSON.stringify(d)))]
 S.routines=[...(S.routines||[]),posterRoutine(key,routineId)]
 return {id:routineId,added:true}
}
// User-supplied label arithmetic only: no food database assumptions or daily target assignment.
export function proteinPortion({servingGrams,proteinGrams,wantedProtein}) {
 const inputs=[servingGrams,proteinGrams,wantedProtein]
 if(inputs.some(x=>String(x??'').trim()===''))throw Error('Enter all three amounts from your label and your chosen protein amount.')
 const [s,p,w]=inputs.map(Number)
 if(![s,p,w].every(Number.isFinite)||s<=0||s>2000||p<=0||p>s||w<=0||w>200)throw Error('Use positive amounts: serving up to 2,000 g, protein no greater than the serving weight, and chosen protein up to 200 g.')
 const servings=w/p,foodGrams=s*servings
 if(foodGrams>10000)throw Error('That calculation gives an unusually large portion. Check the label units and amounts.')
 return {servings,foodGrams,wantedProtein:w}
}
