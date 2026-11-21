import {createWixMemberLogin} from "./coach-login-wix.mjs";
const OAUTH_CLIENT="d61ad4ca-bfe1-4792-b1d6-099567dd79d0";
const CALLBACK="https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com/coach-login.html";
const API="https://kszzvzysxwetwapbhzgy.supabase.co/functions/v1/trivalley-coaching-api";
const el=id=>document.getElementById(id);
const login=createWixMemberLogin({clientId:OAUTH_CLIENT,redirectUri:CALLBACK});
let token=null;
function status(text,kind="") {
  const box=el("status");
  box.textContent=text;
  box.className=kind;
}
function cleanup() {
  history.replaceState(null,"",CALLBACK);
}
async function apiGet(path) {
  if(!token)throw new Error("No authenticated member session");
  const response=await fetch(API+path,{
    method:"GET",
    headers:{authorization:"Bearer "+token,accept:"application/json"},
    credentials:"omit",cache:"no-store",redirect:"error"
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok) {
    const reason=typeof body.error==="string"&&/^[A-Z_]{2,45}$/.test(body.error)?body.error:"REQUEST_DENIED";
    throw new Error("HTTP_"+response.status+"_"+reason);
  }
  return body;
}

// Exact 3-day split IDs copied from the pinned TriValley guest-app programme.
// These are opt-in, private owner drafts only; creation sends no invitations or assignments.
const PILOT_DAYS=[
  {
    "title": "Back & Biceps",
    "description": "TriValley 3-Day Muscle Split: vertical and horizontal pulls, rear shoulders and curls. Private pilot draft.",
    "exercises": [
      [
        "2330",
        3,
        8,
        12,
        120
      ],
      [
        "0861",
        3,
        8,
        12,
        120
      ],
      [
        "0383",
        2,
        12,
        15,
        75
      ],
      [
        "0294",
        3,
        10,
        12,
        75
      ],
      [
        "0313",
        2,
        10,
        12,
        75
      ]
    ]
  },
  {
    "title": "Chest & Triceps",
    "description": "TriValley 3-Day Muscle Split: chest, shoulders and triceps. Private pilot draft.",
    "exercises": [
      [
        "0289",
        3,
        8,
        12,
        120
      ],
      [
        "0314",
        3,
        8,
        12,
        120
      ],
      [
        "0405",
        2,
        8,
        12,
        120
      ],
      [
        "0334",
        2,
        12,
        15,
        75
      ],
      [
        "0200",
        3,
        10,
        15,
        75
      ],
      [
        "0194",
        2,
        10,
        15,
        75
      ]
    ]
  },
  {
    "title": "Legs",
    "description": "TriValley 3-Day Muscle Split: lower-body strength and posterior chain. Private pilot draft.",
    "exercises": [
      [
        "0739",
        3,
        8,
        12,
        120
      ],
      [
        "1459",
        3,
        8,
        12,
        120
      ],
      [
        "0586",
        3,
        10,
        15,
        90
      ],
      [
        "0585",
        2,
        10,
        15,
        75
      ],
      [
        "0605",
        3,
        12,
        15,
        75
      ]
    ]
  }
];
async function apiPost(path,payload) {
  if(!token)throw new Error("NO_SESSION");
  const response=await fetch(API+path,{
    method:"POST",
    headers:{"authorization":"Bearer "+token,"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    credentials:"omit",cache:"no-store",redirect:"error"
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok){
    const code=typeof body.error==="string"&&/^[A-Z_]{2,45}$/.test(body.error)?body.error:"REQUEST_DENIED";
    throw new Error("HTTP_"+response.status+"_"+code);
  }
  return body;
}
function makeEntry(program) {
  const item=document.createElement("li");
  item.className="program-entry";
  const title=document.createElement("strong");
  title.textContent=program.title;
  const details=document.createElement("small");
  details.textContent=program.exercises.length+" exercises · "+(program.status==="published"?"Published, unassigned":"Private draft");
  item.append(title,details);
  if(program.status==="draft"){
    const publish=document.createElement("button");
    publish.className="secondary";
    publish.type="button";
    publish.textContent="Publish for future assignment";
    publish.addEventListener("click",async()=>{
      if(!window.confirm("Publish "+program.title+"? This does not assign it to any client."))return;
      publish.disabled=true;
      try{
        await apiPost("/v1/coach/programs/"+encodeURIComponent(program.id)+"/publish",{});
        el("programNotice").textContent=program.title+" published privately. No client has been assigned.";
        await refreshPrograms();
      }catch{
        el("programNotice").textContent="Publish was blocked. Your other programs were not changed.";
        publish.disabled=false;
      }
    });
    item.append(publish);
  }
  return item;
}
async function refreshPrograms(){
  const response=await apiGet("/v1/coach/programs");
  if(!Array.isArray(response.programs))throw Error("INVALID_PROGRAM_LIST");
  const programs=response.programs;
  coachPrograms=programs;
  populatePublished();
  el("programList").replaceChildren(...programs.map(makeEntry));
  const complete=PILOT_DAYS.every(day=>programs.some(p=>p.title===day.title));
  el("createSplit").disabled=complete;
  el("createSplit").textContent=complete?"Three-day split saved":"Create my three private drafts";
  el("programNotice").textContent=programs.length
    ?programs.length+" saved private coaching program"+(programs.length===1?"":"s")+"."
    :"No private programs yet. Create your three drafts when ready.";
  return programs;
}
el("createSplit").addEventListener("click",async()=>{
  const button=el("createSplit");
  button.disabled=true;
  el("programNotice").textContent="Saving your private training drafts...";
  let created=0;
  try{
    const current=await apiGet("/v1/coach/programs");
    if(!Array.isArray(current.programs))throw Error("INVALID_PROGRAM_LIST");
    const present=new Set(current.programs.map(p=>p.title));
    for(const day of PILOT_DAYS) {
      if(present.has(day.title))continue;
      const exercises=day.exercises.map(([exerciseId,sets,low,high,restSeconds])=>({
        exerciseId,sets,reps:high,restSeconds,
        coachCue:"Target "+low+"–"+high+" controlled reps, adjust effort to recovery."
      }));
      await apiPost("/v1/coach/programs",{
        title:day.title,description:day.description,exercises
      });
      created++;
    }
    await refreshPrograms();
    status(created+" new private program drafts saved. No clients assigned.","success");
  }catch{
    el("programNotice").textContent="Could not finish creating all drafts. Saved drafts are kept; refresh and retry to avoid duplicates.";
    button.disabled=false;
  }
});

// Portable off-provider backup; only encrypted ciphertext is saved to a local file.
// Server never sees the passphrase, and this page never stores it or the backup in localStorage.
const BACKUP_TYPE="trivalley-encrypted-owner-backup-v1";
const BACKUP_AAD=new TextEncoder().encode(BACKUP_TYPE);
const BACKUP_ITERATIONS=350000;
function toBase64(bytes) {
  const chunks=[];
  for(let i=0;i<bytes.length;i+=8192)
    chunks.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
  return btoa(chunks.join(""));
}
function fromBase64(value) {
  if(typeof value!=="string"||value.length>16000000||!/^[a-zA-Z0-9+/]*={0,2}$/.test(value))
    throw new Error("INVALID_BACKUP_ENCODING");
  return Uint8Array.from(atob(value),c=>c.charCodeAt(0));
}
async function backupKey(passphrase,salt) {
  const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(passphrase),
    {name:"PBKDF2"},false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:BACKUP_ITERATIONS,hash:"SHA-256"},
    material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
function askPassphrase({confirmation=false}={}) {
  const passphrase=window.prompt("Enter a private backup passphrase (at least 16 characters). It is not sent to TriValley or stored anywhere.");
  if(!passphrase||passphrase.length<16||passphrase.length>256)throw new Error("PASSPHRASE_LENGTH");
  if(confirmation&&window.prompt("Re-enter the exact backup passphrase to confirm.")!==passphrase)
    throw new Error("PASSPHRASE_MISMATCH");
  return passphrase;
}
function validBackup(data) {
  return data&&data.format==="trivalley-coaching-private-backup-v1"&&
    data.siteId==="9e6343d9-5a1c-45e2-8596-f73408e38402"&&
    Number.isSafeInteger(data.revision)&&data.revision>=0&&
    data.payload&&typeof data.payload==="object"&&
    ["programs","programVersions","assignments","workouts","checkins",
     "deletionRequests","exerciseCatalog"].every(k=>Array.isArray(data.payload[k]))&&
    Array.isArray(data.memberships)&&Array.isArray(data.ownerAliases)&&Array.isArray(data.audit);
}
async function refreshRecovery(){
  const r=await apiGet("/v1/coach/recovery-points");
  const points=Array.isArray(r.recoveryPoints)?r.recoveryPoints:[];
  const current=Number(r.currentRevision);
  if(!Number.isSafeInteger(current))throw new Error("INVALID_RECOVERY_STATE");
  el("recoveryPoints").textContent="Database revision "+current+" · "+
    points.length+" recoverable in-database revision"+(points.length===1?"":"s")+".";
}
el("backupNow").addEventListener("click",async()=>{
  const button=el("backupNow");
  button.disabled=true;
  const box=el("backupResult");
  try{
    if(!crypto?.subtle||!crypto?.getRandomValues)throw new Error("ENCRYPTION_NOT_AVAILABLE");
    const passphrase=askPassphrase({confirmation:true});
    box.textContent="Fetching and encrypting your private backup...";
    const backup=await apiGet("/v1/coach/backup");
    if(!validBackup(backup))throw new Error("INVALID_BACKUP_PAYLOAD");
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const key=await backupKey(passphrase,salt);
    const plain=new TextEncoder().encode(JSON.stringify(backup));
    const sealed=new Uint8Array(await crypto.subtle.encrypt(
      {name:"AES-GCM",iv,additionalData:BACKUP_AAD},key,plain));
    const packageData={
      format:BACKUP_TYPE,version:1,kdf:"PBKDF2-SHA256",
      iterations:BACKUP_ITERATIONS,cipher:"AES-256-GCM",
      siteId:backup.siteId,revision:backup.revision,
      createdAt:new Date().toISOString(),
      salt:toBase64(salt),iv:toBase64(iv),ciphertext:toBase64(sealed)
    };
    const fileName="trivalley-coaching-"+new Date().toISOString().slice(0,10)+
      "-rev"+backup.revision+".tvfitbackup";
    const file=new File([JSON.stringify(packageData)],fileName,{type:"application/json"});
    let shared=false;
    if(typeof navigator.share==="function"&&navigator.canShare?.({files:[file]})){
      try{await navigator.share({files:[file],title:"Encrypted TriValley coaching backup"});shared=true}
      catch{/* User cancelled share or Safari blocked it: offer a normal file download. */}
    }
    if(!shared){
      const url=URL.createObjectURL(file);
      const a=document.createElement("a");
      a.href=url;a.download=fileName;document.body.append(a);a.click();a.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    }
    box.textContent="Encrypted backup created for revision "+backup.revision+
      ". Save the file outside Supabase, then verify it below. Keep your passphrase safe.";
    await refreshRecovery();
  }catch{
    box.textContent="Backup was not exported. No data or password was saved by this page. Check the passphrase and sign-in, then retry.";
  }finally{button.disabled=false}
});
el("verifyBackup").addEventListener("click",async()=>{
  const button=el("verifyBackup");
  const box=el("backupResult");
  button.disabled=true;
  try{
    const file=el("backupFile").files?.[0];
    if(!file||file.size>14000000||file.size<50)throw new Error("INVALID_BACKUP_FILE");
    const packaged=JSON.parse(await file.text());
    if(packaged?.format!==BACKUP_TYPE||packaged.version!==1||
      packaged.kdf!=="PBKDF2-SHA256"||packaged.iterations!==BACKUP_ITERATIONS||
      packaged.cipher!=="AES-256-GCM"||
      packaged.siteId!=="9e6343d9-5a1c-45e2-8596-f73408e38402")
      throw new Error("INVALID_BACKUP_FORMAT");
    const salt=fromBase64(packaged.salt),iv=fromBase64(packaged.iv);
    if(salt.length!==16||iv.length!==12)throw new Error("INVALID_BACKUP_FORMAT");
    const passphrase=askPassphrase();
    const key=await backupKey(passphrase,salt);
    const plain=await crypto.subtle.decrypt(
      {name:"AES-GCM",iv,additionalData:BACKUP_AAD},key,
      fromBase64(packaged.ciphertext));
    const data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(plain));
    if(!validBackup(data)||data.revision!==packaged.revision)
      throw new Error("INVALID_BACKUP_CONTENTS");
    box.textContent="Backup verified locally: revision "+data.revision+
      ", "+data.memberships.length+" account records, "+
      data.payload.workouts.length+" workout entries. No data was uploaded or restored.";
  }catch{
    box.textContent="Backup check failed. It may be the wrong passphrase, wrong file, or damaged data. Nothing was uploaded or restored.";
  }finally{button.disabled=false}
});

// Server-only membership and consent checks control all owner invitation/assignment writes.
// Public client onboarding is disabled until the backup/privacy release gates are approved.
let coachPrograms=[],enrolledClients=[],releaseGate=null,lastInvite=null;
function textNode(tag,text,className){
  const node=document.createElement(tag);
  node.textContent=text;
  if(className)node.className=className;
  return node;
}
function populatePublished(){
  const select=el("publishedProgram");
  select.replaceChildren();
  const blank=textNode("option","Choose a published program");blank.value="";select.append(blank);
  for(const p of coachPrograms.filter(p=>p.status==="published")){
    const opt=textNode("option",p.title);opt.value=p.id;select.append(opt);
  }
  eligibleAssignment();
}
function eligibleAssignment(){
  const ready=Boolean(el("clientSelect").value&&el("publishedProgram").value);
  el("assignClient").disabled=!ready;
  el("loadCheckins").disabled=!el("clientSelect").value;
}
el("clientSelect").addEventListener("change",eligibleAssignment);
el("publishedProgram").addEventListener("change",eligibleAssignment);
async function refreshClientGate(){
  const data=await apiGet("/v1/coach/release-status");
  releaseGate=data;
  const open=data.enrollment_enabled===true&&data.privacy_approved===true&&data.backup_verified===true;
  el("createInvite").disabled=!open;
  el("clientGate").textContent=open
    ?"Private enrollment is enabled. Invitations require an approved Wix member and explicit consent."
    :"Enrollment locked: privacy approval "+(data.privacy_approved?"present":"pending")+
      ", verified off-provider backup "+(data.backup_verified?"present":"pending")+
      ". Workout sync "+(data.workout_sync_enabled?"enabled":"disabled")+".";
}
async function refreshClientRoster(){
  const [roster,invites]=await Promise.all([
    apiGet("/v1/coach/enrolled-clients"),
    apiGet("/v1/coach/invitations")
  ]);
  if(!Array.isArray(roster.clients)||!Array.isArray(invites.invitations))
    throw Error("INVALID_ROSTER");
  enrolledClients=roster.clients;
  const select=el("clientSelect"),prior=select.value;
  select.replaceChildren();
  const blank=textNode("option","Choose a consenting enrolled client");blank.value="";select.append(blank);
  for(const client of enrolledClients){
    const opt=textNode("option",client.display_name||"Wix member");
    opt.value=client.id;select.append(opt);
  }
  if(enrolledClients.some(c=>c.id===prior))select.value=prior;
  eligibleAssignment();
  const list=el("invitationList");list.replaceChildren();
  const entries=invites.invitations.slice(0,20);
  if(!entries.length)list.append(textNode("p","No invitations issued."));
  for(const inv of entries){
    const row=textNode("div",inv.label+" · "+inv.state+" · expires "+String(inv.expires_at).slice(0,10),"program-entry");
    if(inv.state==="pending"){
      const cancel=textNode("button","Revoke invitation","secondary");
      cancel.type="button";
      cancel.addEventListener("click",async()=>{
        if(!window.confirm("Revoke this pending invitation?"))return;
        cancel.disabled=true;
        try{
          await apiPost("/v1/coach/invitations/"+encodeURIComponent(inv.id)+"/revoke",{});
          await refreshClientRoster();
        }catch{
          el("assignmentNotice").textContent="Invitation could not be revoked. Review its status before reusing.";
          cancel.disabled=false;
        }
      });
      row.append(cancel);
    }
    list.append(row);
  }
}
el("refreshClients").addEventListener("click",async()=>{
  try{await refreshClientGate();await refreshPrograms();await refreshClientRoster()}
  catch{el("assignmentNotice").textContent="Roster temporarily unavailable. Client access remains protected."}
});
el("createInvite").addEventListener("click",async()=>{
  if(!releaseGate?.enrollment_enabled)return;
  const button=el("createInvite");button.disabled=true;
  el("inviteOutput").textContent="Generating a private invitation...";
  try{
    const label=el("inviteLabel").value.trim();
    const data=await apiPost("/v1/coach/invitations",{label});
    if(typeof data.invitation?.code!=="string"||data.invitation.code.length!==43)
      throw new Error("INVALID_INVITE_RESPONSE");
    const code=data.invitation.code;
    lastInvite=code;
    const message=textNode("span","One-time code: "+code+". Expires in 48 hours. Share privately, not in public posts.");
    const copy=textNode("button","Copy invitation code","secondary");
    copy.type="button";
    copy.addEventListener("click",async()=>{
      try{await navigator.clipboard.writeText(code);
        el("assignmentNotice").textContent="Code copied. Send privately to the invited Wix member."
      }catch{el("assignmentNotice").textContent="Copy unavailable. Select the code manually."}
    });
    el("inviteOutput").replaceChildren(message,document.createTextNode(" "),copy);
    await refreshClientRoster();
  }catch{
    el("inviteOutput").textContent="No invite issued. Enrollment may still be locked or an invite limit reached.";
  }finally{button.disabled=!releaseGate?.enrollment_enabled}
});
el("assignClient").addEventListener("click",async()=>{
  const clientId=el("clientSelect").value,programId=el("publishedProgram").value;
  if(!clientId||!programId)return;
  const program=coachPrograms.find(p=>p.id===programId);
  if(!window.confirm("Assign "+(program?.title||"program")+" to this opted-in client?"))return;
  el("assignClient").disabled=true;
  try{
    const result=await apiPost("/v1/coach/assignments",{clientId,programId});
    el("assignmentNotice").textContent=(result.assignment?.reused?"Assignment already existed.":"Assignment created.")+
      " The enrolled client can now view this program in their private portal.";
    await refreshClientRoster();
  }catch{
    el("assignmentNotice").textContent="Assignment denied. Confirm client consent, published program and coach permissions.";
  }finally{eligibleAssignment()}
});
el("loadCheckins").addEventListener("click",async()=>{
  const clientId=el("clientSelect").value;
  if(!clientId)return;
  const list=el("checkinList");list.textContent="Loading private check-ins...";
  try{
    const result=await apiGet("/v1/coach/clients/"+encodeURIComponent(clientId)+"/checkins");
    list.replaceChildren();
    if(!Array.isArray(result.items)||!result.items.length)
      list.append(textNode("p","No check-ins received for this assigned client."));
    for(const record of result.items||[]){
      const item=textNode("div",undefined,"program-entry");
      item.append(textNode("strong","Week "+record.weekOf+" · rating "+record.completionRating+"/5"),
        textNode("small",record.comment||"No comment"),
        textNode("small","Status: "+record.reviewStatus));
      if(record.reviewStatus==="pending"){
        const review=textNode("button","Mark reviewed","secondary");
        review.type="button";
        review.addEventListener("click",async()=>{
          const note=window.prompt("Review note for this client (optional, max 500 characters):","");
          if(note===null)return;
          if(note.length>500){el("assignmentNotice").textContent="Review note too long.";return}
          review.disabled=true;
          try{
            await apiPost("/v1/coach/checkins/"+encodeURIComponent(record.id)+"/review",{reviewNote:note});
            el("loadCheckins").click();
          }catch{el("assignmentNotice").textContent="Review could not be recorded.";review.disabled=false}
        });
        item.append(review);
      }
      list.append(item);
    }
  }catch{
    list.replaceChildren(textNode("p","Check-ins unavailable. Only currently assigned clients are accessible."));
  }
});

async function showCoach() {
  const me=await apiGet("/v1/me");
  if(me?.member?.role!=="coach")throw new Error("This member is not approved for the coaching role");
  el("identity").textContent="Verified coach · "+me.member.displayName;
  const response=await apiGet("/v1/coach/clients");
  const count=Array.isArray(response.clients)?response.clients.length:0;
  el("clientCount").textContent=String(count);
  el("login-panel").hidden=true;
  el("workspace").hidden=false;
  status("Wix member and protected coaching API verified. No client records have been migrated.","success");
  try{await refreshPrograms()}catch{
    el("programNotice").textContent="Private programme library is currently unavailable. Coaching login still verified.";
  }
  try{await refreshRecovery()}catch{
    el("recoveryPoints").textContent="Recovery-point status unavailable. Do not rely on this project as your only backup.";
  }
  try{await refreshClientGate();await refreshClientRoster()}catch{
    el("clientGate").textContent="Enrollment controls unavailable. Client enrollment remains blocked.";
  }
}
el("login").addEventListener("click",async()=>{
  el("login").disabled=true;
  status("Preparing Wix verification...");
  try {
    const flow=await login.begin();
    window.location.assign(flow.loginUrl);
  } catch {
    status("Wix sign-in could not start. Your session is unchanged.","error");
    el("login").disabled=false;
  }
});
el("reload").addEventListener("click",async()=>{
  try {
    await showCoach();
  } catch {
    status("Member verification or private API was denied. Access remains blocked.","error");
  }
});
el("endSession").addEventListener("click",()=>{
  token=null;
  login.cancel();
  el("programList").replaceChildren();
  el("workspace").hidden=true;
  el("login-panel").hidden=false;
  el("login").disabled=false;
  status("This page's session ended. Wix may remain signed in on its own website.");
});
function hasWixResult() {
  const params=new URLSearchParams(window.location.hash.slice(1));
  return params.has("code")||params.has("error")||params.has("state");
}
function reportIncompleteReturn() {
  if(!login.hasPending?.())return;
  login.cancel();
  el("login").disabled=false;
  status("Wix returned without a sign-in result (WIX_RETURN_MISSING). Coaching access is still locked. Tap Continue securely with Wix to try again.","error");
}
window.addEventListener("pageshow",event=>{
  if(event.persisted&&!hasWixResult())reportIncompleteReturn();
});
(async()=>{
  if(!hasWixResult()) {
    reportIncompleteReturn();
    return;
  }
  status("Checking Wix member and secure coaching permissions...");
  let stage="wix";
  try {
    const member=await login.complete(window.location.href);
    cleanup();
    token=member.accessToken;
    status("Wix member verified; checking private owner permissions...");
    stage="api";
    await showCoach();
  } catch(e) {
    token=null;
    cleanup();
    el("login").disabled=false;
    const safeApiCode=typeof e?.message==="string"&&/^HTTP_\d{3}_[A-Z_]{2,45}$/.test(e.message)
      ?e.message:"API_CHECK_FAILED";
    const message=stage==="wix"
      ?"Wix sign-in could not be completed or validated (WIX_MEMBER_CHECK). Use a Wix Member login for 1strongtrainer or 2strongtrainers, not the Wix editor admin session."
      :"Wix sign-in completed, but the private coaching API rejected it ("+safeApiCode+"). Access remains blocked. Share only this error code for troubleshooting, never a token.";
    status(message,"error");
  }
})();