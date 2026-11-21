import {createWixMemberLogin} from "./coach-login-wix.mjs";
import {createOfflineWorkoutQueue} from "./coach-offline-queue.mjs";
const CLIENT_ID="d61ad4ca-bfe1-4792-b1d6-099567dd79d0";
const CALLBACK="https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com/coach-client.html";
const API="https://kszzvzysxwetwapbhzgy.supabase.co/functions/v1/trivalley-coaching-api";
const SITE_ID="9e6343d9-5a1c-45e2-8596-f73408e38402";
const KNOWN={
"2330":"Cable lat pulldown","0861":"Cable seated row","0383":"Dumbbell reverse fly",
"0294":"Dumbbell biceps curl","0313":"Dumbbell hammer curl",
"0289":"Dumbbell bench press","0314":"Dumbbell incline bench press",
"0405":"Dumbbell seated shoulder press","0334":"Dumbbell lateral raise",
"0200":"Cable rope pushdown","0194":"Cable overhead rope triceps extension",
"0739":"Leg press","1459":"Dumbbell Romanian deadlift",
"0586":"Lying leg curl","0585":"Leg extension","0605":"Machine standing calf raise"
};
const el=id=>document.getElementById(id);
const login=createWixMemberLogin({clientId:CLIENT_ID,redirectUri:CALLBACK});
let accessToken=null,memberId=null,queue=null,assigned=[],pilot=null;
function say(message,level=""){
  const s=el("status");s.textContent=message;s.className="status"+(level?" "+level:"");
}
function cleanCallback(){history.replaceState(null,"",CALLBACK)}
async function request(path,{method="GET",body}={}){
  if(!accessToken)throw new Error("NOT_LOGGED_IN");
  const response=await fetch(API+path,{
    method,headers:{"authorization":"Bearer "+accessToken,accept:"application/json",
      ...(body===undefined?{}:{"content-type":"application/json"})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    credentials:"omit",cache:"no-store",redirect:"error"
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error("API_DENIED"),{status:response.status,
    code:typeof data.error==="string"?data.error:"REQUEST_DENIED"});
  return data;
}
async function pilotStatus(){
  const res=await fetch(API+"/pilot-status",{cache:"no-store",credentials:"omit"});
  if(!res.ok)throw new Error("PILOT_STATUS_UNAVAILABLE");
  const data=await res.json();
  if(!data||typeof data.enrollmentEnabled!=="boolean"||typeof data.syncEnabled!=="boolean")
    throw new Error("INVALID_PILOT_STATUS");
  pilot=data;
  return data;
}
const openDb=(()=>{
  let once;
  return ()=>once||=(new Promise((resolve,reject)=>{
    if(!indexedDB)return reject(new Error("OFFLINE_STORAGE_UNAVAILABLE"));
    const req=indexedDB.open("trivalley-coaching-queue-v1",1);
    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains("queues"))req.result.createObjectStore("queues");
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(new Error("OFFLINE_STORAGE_UNAVAILABLE"));
  }));
})();
function storageFor(member){
  const key=SITE_ID+":"+member;
  return {
    read:async()=>new Promise(async(resolve,reject)=>{
      try{
        const db=await openDb(),tx=db.transaction("queues","readonly");
        const req=tx.objectStore("queues").get(key);
        req.onsuccess=()=>resolve(req.result||[]);
        req.onerror=()=>reject(new Error("OFFLINE_READ_FAILED"));
      }catch{reject(new Error("OFFLINE_READ_FAILED"))}
    }),
    write:async(value)=>new Promise(async(resolve,reject)=>{
      try{
        const db=await openDb(),tx=db.transaction("queues","readwrite");
        tx.objectStore("queues").put(value,key);
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(new Error("OFFLINE_WRITE_FAILED"));
        tx.onabort=()=>reject(new Error("OFFLINE_WRITE_FAILED"));
      }catch{reject(new Error("OFFLINE_WRITE_FAILED"))}
    })
  };
}
function createQueue(member){
  return createOfflineWorkoutQueue({
    ...storageFor(member),
    send:async payload=>{
      if(!accessToken||!pilot?.syncEnabled)return {status:423};
      try{
        const res=await fetch(API+"/v1/me/workouts",{
          method:"POST",headers:{authorization:"Bearer "+accessToken,"content-type":"application/json"},
          body:JSON.stringify(payload),credentials:"omit",cache:"no-store",redirect:"error"
        });
        const data=await res.json().catch(()=>({}));
        return {status:res.status,data};
      }catch{throw new Error("NETWORK_UNAVAILABLE")}
    }
  });
}
async function updateQueue(){
  if(!queue)return;
  const list=await queue.snapshot();
  const conflicts=list.filter(x=>x.status==="conflict").length;
  const blocked=list.filter(x=>x.status==="needs_review").length;
  const pending=list.filter(x=>x.status==="pending").length;
  el("queueStatus").textContent=pending+" pending saved workouts, "+conflicts+" conflict(s), "+
    blocked+" needing review. Local records remain until acknowledged by the server.";
}
function make(tag,text,className){
  const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;
  if(className)e.className=className;
  return e;
}
function selected(){
  return assigned.find(x=>x.assignment.id===el("assignmentSelect").value)||null;
}
function buildForm(){
  const item=selected();
  const root=el("setsForm");root.replaceChildren();
  if(!item)return;
  const program=item.program;
  for(const ex of program.exercises){
    const holder=make("div",undefined,"exercise");
    const heading=make("strong",KNOWN[ex.exerciseId]||"Exercise "+ex.exerciseId);
    const desc=make("div",ex.sets+" prescribed working sets · "+ex.reps+" target reps · "+ex.restSeconds+"s rest");
    desc.className="small";holder.append(heading,desc);
    for(let index=1;index<=ex.sets;index++){
      const line=make("div",undefined,"setline");
      line.dataset.exerciseId=ex.exerciseId;line.dataset.setIndex=String(index);
      line.append(make("div","Set "+index,"setindex"));
      for(const [kind,label,value] of [["reps","Reps",String(ex.reps)],["weight","Weight (lb)","0"]]){
        const wrap=make("div");
        const name=make("label",label);
        const input=make("input");
        input.type="number";input.required=true;input.inputMode="decimal";input.value=value;
        input.min="0";input.max=kind==="reps"?"120":"1500";input.step=kind==="reps"?"1":"0.5";
        input.className="input-"+kind;input.setAttribute("aria-label",(KNOWN[ex.exerciseId]||ex.exerciseId)+" set "+index+" "+label);
        wrap.append(name,input);line.append(wrap);
      }
      holder.append(line);
    }
    root.append(holder);
  }
}
function renderAssignments(){
  const list=el("assignments"),select=el("assignmentSelect");list.replaceChildren();select.replaceChildren();
  if(!assigned.length){
    list.append(make("p","No training programs have been assigned yet. Your coach will assign a published program when enrollment is ready."));
  }
  for(const item of assigned){
    if(!item?.assignment||!item?.program)continue;
    const p=item.program;
    const box=make("article",undefined,"assignment");
    box.append(make("strong",p.title),make("p",p.exercises.length+" exercises · version "+p.version+" · assigned by your coach"));
    list.append(box);
    const opt=make("option",p.title);opt.value=item.assignment.id;select.append(opt);
  }
  buildForm();
}
async function refresh(){
  const user=await request("/v1/me");
  if(user.member?.role!=="client")throw new Error("NOT_A_CLIENT");
  if(typeof user.member.id!=="string")throw new Error("MISSING_CLIENT_ID");
  if(memberId!==user.member.id){
    memberId=user.member.id;queue=createQueue(memberId);
  }
  const [plans,progress,status]=await Promise.all([
    request("/v1/me/assignments"),request("/v1/me/progress"),pilotStatus()
  ]);
  assigned=Array.isArray(plans.items)?plans.items:[];
  el("assignmentCount").textContent=String(assigned.length);
  el("workoutCount").textContent=String(progress.progress?.totalWorkouts||0);
  const sync=status.syncEnabled===true;
  el("syncLabel").textContent=sync
    ?"Offline-first workout logging is available. Save locally, then sync when connected."
    :"Client workout syncing is disabled until privacy, backup and pilot acceptance are approved.";
  el("saveWorkout").disabled=!sync||!assigned.length;
  el("syncWorkouts").disabled=!sync;
  el("submitCheckin").disabled=!sync||!assigned.length;
  renderAssignments();
  await updateQueue();
  el("training").hidden=false;el("enroll").hidden=true;el("signIn").hidden=true;
  say("Approved Wix member and private coaching account verified.","success");
}
async function showInvite(){
  const p=await pilotStatus();
  el("signIn").hidden=true;el("training").hidden=true;el("enroll").hidden=false;
  el("join").disabled=!p.enrollmentEnabled;
  el("consentVersion").textContent=p.enrollmentEnabled
    ?"Consent notice version: "+p.noticeVersion+". Your coach must send a private invitation code."
    :"Enrollment remains closed. Ask your coach when the secure pilot will open.";
  say(p.enrollmentEnabled
    ?"Wix member verified. A private invitation and your consent are required."
    :"Your Wix member sign-in succeeded, but coaching enrollment is not yet enabled.");
}
el("signInButton").addEventListener("click",async()=>{
  el("signInButton").disabled=true;
  say("Opening Wix member sign-in...");
  try{
    const redirect=await login.begin();
    window.location.assign(redirect.loginUrl);
  }catch{
    el("signInButton").disabled=false;say("Wix member sign-in could not start.","error");
  }
});
el("join").addEventListener("click",async()=>{
  if(!pilot?.enrollmentEnabled||!el("consent").checked){
    say("Review the privacy notice and explicitly accept before joining.","error");return;
  }
  el("join").disabled=true;
  try{
    const body={code:el("inviteCode").value.trim(),noticeVersion:pilot.noticeVersion,consent:true};
    await request("/v1/enroll/redeem",{method:"POST",body});
    el("inviteCode").value="";
    await refresh();
  }catch{
    say("Invitation invalid or enrollment not approved. No client data was created.","error");
  }finally{el("join").disabled=!pilot?.enrollmentEnabled}
});
el("assignmentSelect").addEventListener("change",buildForm);
el("refresh").addEventListener("click",async()=>{
  try{await refresh()}catch{say("Cannot access training records. Session or assignment may have changed.","error")}
});
el("logout").addEventListener("click",()=>{
  accessToken=null;memberId=null;queue=null;assigned=[];
  login.cancel();el("training").hidden=true;el("enroll").hidden=true;
  el("signIn").hidden=false;el("signInButton").disabled=false;
  say("Browser session ended. Pending local workouts, if any, remain on this device.");
});
el("saveWorkout").addEventListener("click",async()=>{
  if(!queue||!pilot?.syncEnabled){say("Sync isn't yet enabled for client data.","error");return}
  const item=selected();if(!item)return;
  try{
    const durationMinutes=Number(el("duration").value);
    if(!Number.isInteger(durationMinutes)||durationMinutes<1||durationMinutes>360)
      throw new Error("INVALID_DURATION");
    const sets=[];
    for(const row of el("setsForm").querySelectorAll(".setline")){
      const reps=Number(row.querySelector(".input-reps").value);
      const weight=Number(row.querySelector(".input-weight").value);
      if(!Number.isInteger(reps)||reps<0||reps>120||
        !Number.isFinite(weight)||weight<0||weight>1500)
        throw new Error("INVALID_SET");
      sets.push({exerciseId:row.dataset.exerciseId,
        setIndex:Number(row.dataset.setIndex),reps,weight,unit:"lb",rir:null});
    }
    if(!sets.length||sets.length>250)throw new Error("INVALID_SET_COUNT");
    const workout={sessionId:crypto.randomUUID(),assignmentId:item.assignment.id,
      performedAt:new Date().toISOString(),durationMinutes,sets};
    await queue.enqueue(workout);
    await updateQueue();
    say("Workout safely saved on this device. Sync when connected.","success");
    if(navigator.onLine)await syncNow();
  }catch{say("Could not save workout. Check all set values and device storage.","error")}
});
async function syncNow(){
  if(!queue||!accessToken||!pilot?.syncEnabled)return;
  const report=await queue.flush({max:20});
  await updateQueue();
  if(report.acknowledged>0){
    say(report.acknowledged+" workout(s) synchronized and acknowledged by the private server.","success");
    const progress=await request("/v1/me/progress");
    el("workoutCount").textContent=String(progress.progress?.totalWorkouts||0);
  }else if(report.blocked||report.conflicts){
    say("Some local sessions require coach review. Do not delete local data.","error");
  }else if(report.transient) say("Network unavailable. Your workout stays saved on this device.");
}
el("syncWorkouts").addEventListener("click",async()=>{
  try{await syncNow()}catch{say("Sync could not complete. Your queued sessions were not deleted.","error")}
});
window.addEventListener("online",()=>{
  if(pilot?.syncEnabled&&queue&&accessToken)syncNow().catch(()=>{});
});
function monday(){
  const d=new Date();const offset=(d.getUTCDay()+6)%7;
  d.setUTCDate(d.getUTCDate()-offset);
  return d.toISOString().slice(0,10);
}
el("submitCheckin").addEventListener("click",async()=>{
  const item=selected();if(!item||!pilot?.syncEnabled)return;
  el("submitCheckin").disabled=true;
  try{
    const body={checkinId:crypto.randomUUID(),assignmentId:item.assignment.id,
      weekOf:monday(),completionRating:Number(el("rating").value),
      comment:el("comment").value.slice(0,500),
      requestReview:el("requestReview").checked};
    await request("/v1/me/checkins",{method:"POST",body});
    el("comment").value="";el("requestReview").checked=false;
    say("Private weekly check-in received by your coach.","success");
  }catch{say("Check-in was not accepted. Please check your connection before retrying.","error")}
  finally{el("submitCheckin").disabled=false}
});
function saveFile(text,filename){
  const blob=new Blob([text],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}
el("exportMine").addEventListener("click",async()=>{
  if(!window.confirm("Your export contains private workout information and is not password-encrypted. Save it securely on your device."))return;
  try{
    const data=await request("/v1/me/export");
    saveFile(JSON.stringify(data.data,null,2),"trivalley-my-training-"+new Date().toISOString().slice(0,10)+".json");
    el("privacyStatus").textContent="Your export was generated. Confirm it was saved in Files.";
  }catch{el("privacyStatus").textContent="Export unavailable; no client data was changed."}
});
el("deleteMine").addEventListener("click",async()=>{
  if(!window.confirm("Request removal of your coaching data? The coach must review the request; this does not instantly erase records."))return;
  try{
    const result=await request("/v1/me/deletion-requests",{method:"POST",
      body:{requestId:crypto.randomUUID(),confirmation:"REQUEST_MY_DATA_DELETION"}});
    el("privacyStatus").textContent="Deletion request submitted. Status: "+(result.record?.status||"pending_owner_review")+
      ". Contact TriValley.fit for handling and confirmation.";
  }catch{el("privacyStatus").textContent="Deletion request could not be submitted. Contact TriValley.fit directly."}
});
window.addEventListener("pageshow",event=>{
  if(event.persisted&&!location.hash.includes("code=")&&login.hasPending?.()){
    login.cancel();say("Wix returned without a complete sign-in result. Try signing in again.","error");
  }
});
(async()=>{
  try{const p=await pilotStatus();if(!p.enrollmentEnabled) say("Pilot infrastructure is active; client enrollment and workout submission are currently locked.");}
  catch{say("Coaching pilot status is unavailable. No new client data can be submitted.","error")}
  const params=new URLSearchParams(location.hash.slice(1));
  if(!params.has("code")&&!params.has("error"))return;
  try{
    say("Verifying Wix member authentication...");
    const member=await login.complete(location.href);
    cleanCallback();accessToken=member.accessToken;
    try{await refresh()}
    catch(e){
      if(e.status===401||e.status===404)await showInvite();
      else throw e;
    }
  }catch{
    accessToken=null;cleanCallback();
    el("signIn").hidden=false;el("signInButton").disabled=false;
    say("Wix or private coaching verification could not complete. Start a fresh login.","error");
  }
})();
