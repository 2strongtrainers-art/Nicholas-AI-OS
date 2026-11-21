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