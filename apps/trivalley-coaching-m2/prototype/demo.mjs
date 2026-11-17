// Owner-facing synthetic coaching preview. No network calls, accounts or real clients.
// The persona toggle intentionally demonstrates UX only; NOT authentication.
import {CoachingService,InMemoryCoachingStore} from './domain.mjs';
import {createOfflineWorkoutQueue} from './offline-queue.mjs';

const choices=[
  {id:'bench',name:'Dumbbell Bench Press'},
  {id:'row',name:'Single-Arm Dumbbell Row'},
  {id:'squat',name:'Goblet Squat'},
  {id:'plank',name:'Front Plank'}
];
const store=new InMemoryCoachingStore();
const coach={sub:'synthetic-coach',orgId:'demo-organization',role:'coach'};
const client={sub:'synthetic-client',orgId:'demo-organization',role:'client'};
store.seedMember({id:coach.sub,orgId:coach.orgId,role:coach.role,displayName:'Sample Coach'});
store.seedMember({id:client.sub,orgId:client.orgId,role:client.role,displayName:'Sample Client'});
choices.forEach(x=>store.seedExercise(x.id));
const svc=new CoachingService({store});
const initial=svc.createProgram(coach,{
  title:'Foundation Strength — Sample',
  description:'An illustrative two-movement workout, not individualized coaching.',
  exercises:[
    {exerciseId:'squat',sets:3,reps:10,restSeconds:90,coachCue:'Use controlled range of motion'},
    {exerciseId:'row',sets:3,reps:10,restSeconds:75,coachCue:'Keep a stable torso'}
  ]
});
svc.publishProgram(coach,initial.id);
svc.assignProgram(coach,{clientId:client.sub,programId:initial.id});
let currentRole='coach',offline=false,notice='',stored=[];
const queue=createOfflineWorkoutQueue({
  read:async()=>structuredClone(stored),
  write:async next=>{stored=structuredClone(next)},
  send:async payload=>{
    if(offline)throw new Error('Simulated offline device');
    const result=svc.logWorkout(client,payload);
    return {status:201,data:result};
  }
});
const app=document.querySelector('#app');
if(!app)throw new Error('Missing synthetic demo root');
const safe=s=>String(s??'').replace(/[&<>"']/g,v=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[v]);
const exerciseName=id=>choices.find(x=>x.id===id)?.name||'Movement';
const btn=(id,label,cls='')=>'<button type="button" class="btn '+cls+'" data-action="'+id+'">'+safe(label)+'</button>';
const count=(label,n)=>'<div class="metric"><strong>'+n+'</strong><span>'+safe(label)+'</span></div>';
const asDate=iso=>new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric'});
function active(){return svc.activeAssignments(client)}
function chosen(){return active().at(-1)}
function progress(){return svc.clientProgress(client,client.sub)}
function header(){
  return '<header><img src="../trivalley-triquetra.png" alt="" width="44" height="44">'+
    '<div><div class="eyebrow">TRIVALLEY.FIT / COACHING SYSTEM</div>'+
    '<h1>Training Command Center</h1><div class="sub">Milestone 2 · Interactive sample experience</div></div></header>'+
    '<div class="notice" role="status"><strong>DEMONSTRATION ONLY.</strong> These are invented sample records.'+
    ' Switching personas is not real authentication. No client information is transmitted or saved.</div>'+
    '<div class="tabs" role="tablist" aria-label="Choose synthetic demo persona">'+
      '<button class="tab" data-action="coach" role="tab" aria-controls="persona-content" aria-selected="'+(currentRole==='coach')+'">Coach demo</button>'+
      '<button class="tab" data-action="client" role="tab" aria-controls="persona-content" aria-selected="'+(currentRole==='client')+'">Client demo</button>'+
    '</div>';
}
function coachView(){
  const p=progress(),checkins=svc.coachCheckins(coach,client.sub);
  return '<div class="stack" id="persona-content" role="tabpanel">'+
    '<div class="grid">'+count('Sample active clients',svc.coachClients(coach).length)+
      count('Sessions logged',p.totalWorkouts)+
      count('Check-ins pending',p.checkinsAwaitingReview)+
      count('Current assignments',active().length)+'</div>'+
    '<div class="columns"><div class="card"><div class="row"><h2>Assigned training</h2><span class="pill">Coach view</span></div>'+
      active().map(x=>'<div class="table-line">'+
        '<strong>'+safe(x.program?.title)+'</strong> <span class="pill">v'+x.assignment.programVersion+'</span>'+
        '<p class="sub">'+x.program.exercises.length+' exercises · assigned '+asDate(x.assignment.assignedAt)+'</p>'+
        '</div>').join('')+
    '</div>'+
    '<div class="card"><h2>Create a sample program</h2>'+
      '<form id="create-program"><label for="new-title">Program name</label>'+
      '<input id="new-title" name="title" maxlength="90" required value="Upper Strength Sample">'+
      '<label for="new-exercise">Exercise</label><select id="new-exercise" name="exercise">'+
      choices.map(x=>'<option value="'+x.id+'">'+safe(x.name)+'</option>').join('')+'</select>'+
      '<div class="grid"><div><label for="new-sets">Sets</label><input id="new-sets" name="sets" type="number" min="1" max="12" value="3" required></div>'+
      '<div><label for="new-reps">Reps</label><input id="new-reps" name="reps" type="number" min="1" max="60" value="10" required></div></div>'+
      '<button type="submit" class="btn primary full-submit">Publish and assign to sample client</button></form>'+
    '</div></div>'+
    '<div class="card"><div class="row"><h2>Client progress</h2><span class="pill">Read-only history</span></div>'+
      '<div class="grid">'+count('Completed sessions',p.totalWorkouts)+count('Performed sets',p.totalLoggedSets)+'</div>'+
      '<p class="sub">'+(p.completedWorkoutDates.length?'Most recent: '+p.completedWorkoutDates.at(-1):'No sample workouts logged yet')+'</p></div>'+
    '<div class="card"><h2>Coaching check-ins</h2>'+
      (checkins.length?checkins.map(x=>'<div class="table-line">'+
        '<div class="row"><strong>Week of '+safe(x.weekOf)+'</strong><span class="pill">'+safe(x.reviewStatus)+'</span></div>'+
        '<p>'+safe(x.comment||'No additional comments')+'</p>'+
        '<p class="sub">Self-reported satisfaction: '+x.completionRating+'/5</p>'+
        (x.reviewStatus==='pending'?'<label for="review-'+x.id+'">Private coach review note</label>'+
          '<input id="review-'+x.id+'" data-review-note="'+x.id+'" maxlength="500" placeholder="Coaching note">'+
          '<button type="button" class="btn primary" data-action="review" data-checkin="'+x.id+'">Mark reviewed</button>':
          '<p class="sub">Reviewed: '+safe(x.reviewNote||'No note')+'</p>')+
      '</div>').join(''):'<p class="sub">No sample check-in has been submitted yet.</p>')+'</div>'+
    '</div>';
}
function clientView(){
  const assigned=chosen(),p=progress();
  return '<div class="stack" id="persona-content" role="tabpanel">'+
    '<div class="grid">'+count('Sessions completed',p.totalWorkouts)+count('Performed sets',p.totalLoggedSets)+'</div>'+
    '<div class="card">'+
      '<div class="row"><h2>Your assigned program</h2><span class="pill">Client view</span></div>'+
      (assigned?'<h3>'+safe(assigned.program.title)+'</h3><p class="sub">Program version '+assigned.assignment.programVersion+'</p>'+
      assigned.program.exercises.map(ex=>'<div class="exercise"><div><strong>'+safe(exerciseName(ex.exerciseId))+'</strong>'+
        '<small>'+ex.sets+' sets × '+ex.reps+' reps · '+ex.restSeconds+'s rest</small></div>'+
        '<span class="pill">Assigned</span></div>').join('')+
      '<p class="sub">This is an illustrative plan, not a personalized prescription.</p>':
      '<p>No active sample program assigned.</p>')+
    '</div>'+
    '<div class="card"><h2>Log a sample workout</h2><p class="sub">A completed session enters an offline queue and only appears to the coach after synchronization.</p>'+
      '<label class="check"><input type="checkbox" id="simulate-offline" data-action="offline" '+(offline?'checked':'')+'>'+
        'Simulate no internet connection</label>'+
      '<p class="sub">Connection: '+(offline?'Offline (simulated)':'Online (simulated)')+'</p>'+
      '<div class="row"><button type="button" class="btn primary" data-action="log-workout"'+(!assigned?' disabled':'')+
        '>Complete sample workout</button>'+
      '<button type="button" class="btn" data-action="sync">Synchronize queue</button></div>'+
      '<p class="sub" data-testid="queued-count">Unsynchronized sample sessions: '+stored.length+'</p>'+
    '</div>'+
    '<div class="card"><h2>Submit a coaching check-in</h2>'+
      '<form id="checkin-form"><label for="checkin-rating">How did training go?</label>'+
      '<select id="checkin-rating" name="rating"><option value="5">Very well (5)</option><option value="4">Well (4)</option>'+
      '<option value="3">Okay (3)</option><option value="2">Challenging (2)</option><option value="1">Very difficult (1)</option></select>'+
      '<label for="checkin-note">Feedback for your coach</label><textarea id="checkin-note" name="comment" maxlength="500" placeholder="Sample feedback only"></textarea>'+
      '<button type="submit" class="btn primary"'+(!assigned?' disabled':'')+'>Submit sample check-in</button></form></div>'+
    '<div class="card"><h2>Access your sample data</h2><p class="sub">Exports and deletion requests are simulated, without server-side data.</p>'+
      '<div class="row">'+btn('export','Export sample records')+btn('delete-request','Request sample data deletion')+'</div></div>'+
  '</div>';
}
function render() {
  app.innerHTML='<div class="shell">'+header()+
    '<div class="status" id="status" role="status" aria-live="polite">'+safe(notice)+'</div>'+
    (currentRole==='coach'?coachView():clientView())+
    '<p class="footer">Prototype reference · No client logins, payments, confidential notes or external APIs.'+
    ' The real coaching platform must pass independent identity, authorization and data-retention reviews.</p></div>';
  for(const el of app.querySelectorAll('[data-action]')) {
    const action=el.dataset.action;
    if(action==='offline')el.addEventListener('change',()=>{offline=el.checked;notice=offline?'Simulation: offline mode':'Simulation: online mode';render()});
    else el.addEventListener('click',()=>{void handle(action,el)});
  }
  app.querySelector('#create-program')?.addEventListener('submit',ev=>{ev.preventDefault();void createProgram(ev.currentTarget)});
  app.querySelector('#checkin-form')?.addEventListener('submit',ev=>{ev.preventDefault();void submitCheckin(ev.currentTarget)});
}
function show(msg){notice=msg;render()}
async function createProgram(form) {
  try{
    const v=new FormData(form);
    const exerciseId=String(v.get('exercise')),title=String(v.get('title'));
    const sets=Number(v.get('sets')),reps=Number(v.get('reps'));
    const p=svc.createProgram(coach,{title,exercises:[{exerciseId,sets,reps,restSeconds:90}]});
    svc.publishProgram(coach,p.id);svc.assignProgram(coach,{programId:p.id,clientId:client.sub});
    show('Synthetic program published and assigned to the sample client.');
  }catch(e){show('Validation: '+e.message)}
}
async function submitCheckin(form) {
  try{
    const values=new FormData(form),assigned=chosen();
    const now=new Date();
    const monday=new Date(now);monday.setUTCDate(now.getUTCDate()-((now.getUTCDay()+6)%7));
    const weekOf=monday.toISOString().slice(0,10);
    svc.submitCheckin(client,{
      checkinId:crypto.randomUUID(),assignmentId:assigned.assignment.id,weekOf,
      completionRating:Number(values.get('rating')),comment:String(values.get('comment')||''),
      requestReview:true
    });
    show('Sample check-in submitted; switch to Coach demo to review it.');
  }catch(e){show('Validation: '+e.message)}
}
async function handle(action,el) {
  try{
    if(action==='coach'||action==='client'){currentRole=action;show('');return}
    if(action==='log-workout'){
      const assigned=chosen();if(!assigned)throw new Error('No assigned program');
      const payload={
        sessionId:crypto.randomUUID(),assignmentId:assigned.assignment.id,
        performedAt:new Date().toISOString(),durationMinutes:32,
        sets:assigned.program.exercises.map(ex=>({
          exerciseId:ex.exerciseId,setIndex:1,reps:ex.reps,weight:0,unit:'lb',rir:2
        }))
      };
      await queue.enqueue(payload);
      if(!offline)await queue.flush();
      show(offline?'Sample session saved to unsynchronized queue.':'Sample session synchronized; switch to Coach demo to see progress.');
      return;
    }
    if(action==='sync'){
      const summary=await queue.flush();
      show('Queue: '+summary.acknowledged+' synchronized, '+summary.remaining+' remaining.');return;
    }
    if(action==='review'){
      const id=el.dataset.checkin;
      const reviewNote=app.querySelector('[data-review-note="'+id+'"]')?.value||'Reviewed in demonstration';
      svc.reviewCheckin(coach,id,{reviewNote});
      show('Sample check-in reviewed and recorded.');return;
    }
    if(action==='export'){
      const data=svc.clientExport(client);
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='trivalley-synthetic-client-export.json';
      a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      show('Generated synthetic data export.');return;
    }
    if(action==='delete-request'){
      svc.requestDataDeletion(client,{requestId:crypto.randomUUID(),confirmation:'REQUEST_MY_DATA_DELETION'});
      show('Synthetic deletion request recorded for review; no records deleted.');return;
    }
  }catch(e){show('Operation blocked: '+e.message)}
}
render();
