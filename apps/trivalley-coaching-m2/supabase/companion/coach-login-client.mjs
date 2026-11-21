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