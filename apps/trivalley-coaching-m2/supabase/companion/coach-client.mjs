import {createWixMemberLogin,hasWixCallbackResult,installWixCallbackObserver} from "./coach-login-wix.mjs";
import {createOfflineWorkoutQueue} from "./coach-offline-queue.mjs";
import {validateOfflineQueue,mergeOfflineQueues} from "./coach-offline-backup.mjs";
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
  el("offlineExport").disabled=false;
  el("offlineImport").disabled=false;
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
  el("offlineExport").disabled=true;
  el("offlineImport").disabled=true;
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
  if(offlineImportBusy||!queue||!accessToken||!pilot?.syncEnabled)return;
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
// Reuse one idempotency key for identical check-in retries, even after a page reload.
// Persist only a SHA-256 fingerprint and event UUID, not the comment or Wix token.
async function pendingCheckinId(payload){
  const key="tv-checkin-id-v1:"+SITE_ID+":"+memberId;
  const bytes=new TextEncoder().encode(JSON.stringify(payload));
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)))
    .map(v=>v.toString(16).padStart(2,"0")).join("");
  try{
    const prior=JSON.parse(sessionStorage.getItem(key)||"null");
    if(prior&&prior.digest===digest&&
      typeof prior.id==="string"&&/^[0-9a-f-]{36}$/i.test(prior.id)&&
      Number.isFinite(prior.createdAt)&&Date.now()-prior.createdAt>=0&&
      Date.now()-prior.createdAt<24*60*60*1000)
      return {id:prior.id,key};
  }catch{/* sessionStorage unavailable; retry still uses current page state. */}
  const id=crypto.randomUUID();
  try{sessionStorage.setItem(key,JSON.stringify({id,digest,createdAt:Date.now()}))}
  catch{/* No token or plaintext comment is stored. */}
  return {id,key};
}
el("submitCheckin").addEventListener("click",async()=>{
  const item=selected();if(!item||!pilot?.syncEnabled)return;
  el("submitCheckin").disabled=true;
  try{
    const attention=el("attentionType").value;
    const note=el("comment").value.trim();
    const comment=((attention?"[Attention: "+attention+"] ":"")+note).slice(0,500);
    const payload={assignmentId:item.assignment.id,
      weekOf:monday(),completionRating:Number(el("rating").value),
      comment,requestReview:el("requestReview").checked||Boolean(attention)};
    const event=await pendingCheckinId(payload);
    await request("/v1/me/checkins",{method:"POST",
      body:{checkinId:event.id,...payload}});
    try{sessionStorage.removeItem(event.key)}catch{}
    el("comment").value="";el("attentionType").value="";el("requestReview").checked=false;
    say(attention
      ?"Your "+attention.toLowerCase()+" flag was sent to Nick's Needs Attention list."
      :"Private weekly check-in received by your coach.","success");
  }catch{say("Check-in was not accepted. Retry without changing the fields; the same event ID will be reused.","error")}
  finally{el("submitCheckin").disabled=false}
});
// Encrypted portable backups are created entirely on the client's device.
// No Wix credentials, encryption key, or private queue is sent to any server.
const QUEUE_BACKUP_FORMAT="trivalley-pending-queue-v1";
const QUEUE_AD=new TextEncoder().encode(QUEUE_BACKUP_FORMAT);
let offlineImportBusy=false;
function queueBase64(bytes){
  const chunks=[];
  for(let i=0;i<bytes.length;i+=8192)
    chunks.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
  return btoa(chunks.join(""));
}
function unqueueBase64(str){
  if(typeof str!=="string"||str.length>12000000||
     !/^[A-Za-z0-9+/]*={0,2}$/.test(str))throw new Error("INVALID_ENCRYPTED_FILE");
  return Uint8Array.from(atob(str),c=>c.charCodeAt(0));
}
async function queueKey(passphrase,salt){
  const base=await crypto.subtle.importKey("raw",
    new TextEncoder().encode(passphrase),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey(
    {name:"PBKDF2",salt,iterations:350000,hash:"SHA-256"},
    base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
function queuePassphrase(confirm=false){
  const passphrase=window.prompt("Enter a backup password of at least 16 characters. Keep it separately; we cannot recover it for you.");
  if(typeof passphrase!=="string"||passphrase.length<16||passphrase.length>256)
    throw new Error("INVALID_PASSPHRASE");
  if(confirm&&window.prompt("Re-enter the backup password to confirm.")!==passphrase)
    throw new Error("BACKUP_PASSWORD_MISMATCH");
  return passphrase;
}
async function offerFile(file){
  if(typeof navigator.share==="function"&&navigator.canShare?.({files:[file]})){
    try{await navigator.share({files:[file],title:"Encrypted pending TriValley workouts"});return}
    catch{/* Fall back to download if user cancelled or share is unavailable. */}
  }
  const url=URL.createObjectURL(file),link=document.createElement("a");
  link.href=url;link.download=file.name;document.body.append(link);
  link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function offlineNotice(text){el("offlineBackupStatus").textContent=text}
el("offlineExport").addEventListener("click",async()=>{
  if(!accessToken||!memberId||!queue)return;
  const button=el("offlineExport");button.disabled=true;
  try{
    if(!crypto?.subtle||!crypto?.getRandomValues)throw Error("CRYPTO_UNAVAILABLE");
    const records=validateOfflineQueue(await queue.snapshot());
    if(!records.length){offlineNotice("No unsynced workouts to back up.");return}
    const passphrase=queuePassphrase(true);
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const secret=await queueKey(passphrase,salt);
    const plain=new TextEncoder().encode(JSON.stringify({
      format:QUEUE_BACKUP_FORMAT,siteId:SITE_ID,memberId,
      savedAt:new Date().toISOString(),records
    }));
    const ciphertext=new Uint8Array(await crypto.subtle.encrypt(
      {name:"AES-GCM",iv,additionalData:QUEUE_AD},secret,plain));
    const packaged={format:QUEUE_BACKUP_FORMAT,version:1,
      iterations:350000,kdf:"PBKDF2-SHA256",cipher:"AES-256-GCM",
      salt:queueBase64(salt),iv:queueBase64(iv),ciphertext:queueBase64(ciphertext)};
    const filename="trivalley-pending-"+new Date().toISOString().slice(0,10)+".tvqueue";
    await offerFile(new File([JSON.stringify(packaged)],filename,{type:"application/json"}));
    offlineNotice(records.length+" unsynced workout(s) encrypted for this Wix member. Confirm the file was saved and keep its password safe.");
  }catch{
    offlineNotice("No encrypted backup was confirmed. The original unsynced workouts remain on this device.");
  }finally{button.disabled=!accessToken}
});
el("offlineImport").addEventListener("click",async()=>{
  if(!accessToken||!memberId||!queue||offlineImportBusy)return;
  const button=el("offlineImport");button.disabled=true;offlineImportBusy=true;
  try{
    if(!crypto?.subtle)throw Error("CRYPTO_UNAVAILABLE");
    const file=el("offlineRestoreFile").files?.[0];
    if(!file||file.size<60||file.size>9000000)
      throw Error("INVALID_BACKUP_FILE");
    const data=JSON.parse(await file.text());
    if(data?.format!==QUEUE_BACKUP_FORMAT||data.version!==1||
       data.kdf!=="PBKDF2-SHA256"||data.cipher!=="AES-256-GCM"||
       data.iterations!==350000)throw Error("INVALID_BACKUP_FORMAT");
    const salt=unqueueBase64(data.salt),iv=unqueueBase64(data.iv);
    if(salt.length!==16||iv.length!==12)throw Error("INVALID_BACKUP_FORMAT");
    const secret=await queueKey(queuePassphrase(),salt);
    const buffer=await crypto.subtle.decrypt(
      {name:"AES-GCM",iv,additionalData:QUEUE_AD},secret,
      unqueueBase64(data.ciphertext));
    const payload=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(buffer));
    if(payload?.format!==QUEUE_BACKUP_FORMAT||payload.siteId!==SITE_ID||
       payload.memberId!==memberId)throw Error("WRONG_WIX_MEMBER");
    const imported=validateOfflineQueue(payload.records);
    const existing=await queue.snapshot();
    const merged=mergeOfflineQueues(existing,imported);
    if(!window.confirm("Recover "+imported.length+" saved workout(s) into this device? Existing sessions and conflicts are preserved. No workout will be sent automatically.")){
      offlineNotice("Recovery cancelled. Nothing was changed.");return
    }
    await storageFor(memberId).write(merged);
    queue=createQueue(memberId);
    await updateQueue();
    offlineNotice("Recovered "+(merged.length-existing.length)+" additional local workout(s). All data stays on this device until you choose Sync.");
    el("offlineRestoreFile").value="";
  }catch{
    offlineNotice("Recovery blocked: the file, password, member identity, or session data did not validate. Existing workouts were not changed.");
  }finally{offlineImportBusy=false;button.disabled=!accessToken}
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
function reportIncompleteReturn(){
  el("signInButton").disabled=false;
  say("Wix returned without a complete sign-in result (WIX_RETURN_MISSING). A later valid return will be checked automatically; otherwise start a fresh sign-in.","error");
}
async function handleWixReturn(callbackUrl){
  try{
    say("Verifying Wix member authentication...");
    cleanCallback(); // Remove the return parameters before any network request.
    const member=await login.complete(callbackUrl);
    accessToken=member.accessToken;
    try{await refresh()}
    catch(e){
      if(e.status===401||e.status===404)await showInvite();
      else throw e;
    }
  }catch{
    login.cancel();accessToken=null;cleanCallback();
    el("signIn").hidden=false;el("signInButton").disabled=false;
    say("Wix or private coaching verification could not complete. Start a fresh login.","error");
  }
}
const wixReturnObserver=installWixCallbackObserver({
  target:window,hasPending:login.hasPending,
  onResult:handleWixReturn,onIncomplete:reportIncompleteReturn
});
(async()=>{
  if(await wixReturnObserver.inspect()||login.hasPending()||accessToken)return;
  // Do not overwrite an authentication status if the user started signing in
  // while the anonymous pilot-status request was in flight.
  const isAnonymous=()=>!accessToken&&!login.hasPending()&&!hasWixCallbackResult(location.href);
  try{
    const p=await pilotStatus();
    if(!p.enrollmentEnabled&&isAnonymous())say("Pilot infrastructure is active; client enrollment and workout submission are currently locked.");
  }catch{
    if(isAnonymous())say("Coaching pilot status is unavailable. No new client data can be submitted.","error");
  }
})();
