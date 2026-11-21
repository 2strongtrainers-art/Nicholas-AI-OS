// TriValley Coaching: private, deny-by-default Wix-member staging API.
// Runtime credentials are supplied by Supabase, never stored in Git or sent to clients.
// Production rollout is gated by real Wix-member site binding + end-to-end acceptance.
import postgres from "npm:postgres@3.4.3";
import {CoachingService,InMemoryCoachingStore,CoachingError} from "./domain.mjs";
import {makeWixMemberVerifier} from "./wix-verify.mjs";
import {makeWixOAuthTokenBinding} from "./wix-token-info.mjs";

const SITE_ID="9e6343d9-5a1c-45e2-8596-f73408e38402";
const HOST_NAME="trivalley-coaching-api";
const MAX_BODY=48*1024;
const ORIGINS=new Set([
  "https://www.trivalley.fit",
  "https://trivalley.fit",
  "https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com"
]);
const DB_URL=Deno.env.get("SUPABASE_DB_URL");
const sql=DB_URL?postgres(DB_URL,{max:2,prepare:false,idle_timeout:10,connect_timeout:5}):null;
const MAP_KEYS=["programs","programVersions","assignments","workouts","checkins","deletionRequests"];

function send(body,status=200,origin=null) {
  const headers={
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",
    "Referrer-Policy":"no-referrer",
    "Vary":"Origin, Authorization"
  };
  if(origin&&ORIGINS.has(origin)){
    headers["Access-Control-Allow-Origin"]=origin;
    headers["Access-Control-Allow-Headers"]="authorization, content-type";
    headers["Access-Control-Allow-Methods"]="GET, POST, OPTIONS";
  }
  return new Response(JSON.stringify(body),{status,headers});
}
function pathFor(req) {
  const path=new URL(req.url).pathname;
  const at=path.indexOf("/"+HOST_NAME);
  return at>=0 ? (path.slice(at+HOST_NAME.length+1)||"/") : path;
}
async function jsonBody(req) {
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type")||""))
    throw new CoachingError(415,"CONTENT_TYPE","Expected application/json");
  if(Number(req.headers.get("content-length")||"0")>MAX_BODY)
    throw new CoachingError(413,"BODY_TOO_LARGE","Request too large");
  if(!req.body) throw new CoachingError(400,"INVALID_JSON","Request body required");
  const reader=req.body.getReader();
  const decoder=new TextDecoder("utf-8",{fatal:true});
  let size=0,text="";
  try {
    while(true) {
      const {value,done}=await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size>MAX_BODY) {
        await reader.cancel();
        throw new CoachingError(413,"BODY_TOO_LARGE","Request too large");
      }
      text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();
    const obj=JSON.parse(text);
    if(!obj||typeof obj!=="object"||Array.isArray(obj))
      throw new Error("Not an object");
    return obj;
  }catch(e){
    if(e instanceof CoachingError)throw e;
    throw new CoachingError(400,"INVALID_JSON","Expected a JSON object");
  }finally{reader.releaseLock()}
}
function decodeSnapshot(json,members) {
  if(!json||typeof json!=="object"||Array.isArray(json))throw new Error("Bad snapshot");
  const store=new InMemoryCoachingStore();
  for(const name of MAP_KEYS) {
    const value=json[name];
    if(!Array.isArray(value)||value.length>20000)throw new Error("Bad snapshot maps");
    for(const pair of value)if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=="string")
      throw new Error("Bad snapshot entries");
    store[name]=new Map(value);
  }
  if(!Array.isArray(json.exerciseCatalog)||json.exerciseCatalog.length>5000)
    throw new Error("Bad exercise catalog");
  store.exerciseCatalog=new Set(json.exerciseCatalog);
  store.audit=[];
  for(const row of members){
    store.members.set(row.member_id,{
      id:row.member_id,orgId:row.org_id,role:row.role,
      status:row.status,displayName:row.display_name
    });
  }
  return store;
}
function encodeSnapshot(store) {
  const value={};
  for(const name of MAP_KEYS)value[name]=Array.from(store[name].entries());
  value.exerciseCatalog=Array.from(store.exerciseCatalog.values());
  return JSON.stringify(value);
}
function dispatch(service,actor,method,path,body) {
  if(method==="GET") {
    if(path==="/v1/me")return {member:service.publicMember(actor)};
    if(path==="/v1/me/assignments")return {items:service.activeAssignments(actor)};
    if(path==="/v1/me/progress")return {progress:service.clientProgress(actor,actor.sub)};
    if(path==="/v1/me/export")return {data:service.clientExport(actor)};
    if(path==="/v1/me/deletion-requests")return {requests:service.ownDeletionRequests(actor)};
    if(path==="/v1/coach/programs")return {programs:service.coachPrograms(actor)};
    if(path==="/v1/coach/clients")return {clients:service.coachClients(actor)};
    let m=path.match(/^\/v1\/coach\/clients\/([^/]+)\/progress$/);
    if(m)return {progress:service.clientProgress(actor,decodeURIComponent(m[1]))};
    m=path.match(/^\/v1\/coach\/clients\/([^/]+)\/checkins$/);
    if(m)return {items:service.coachCheckins(actor,decodeURIComponent(m[1]))};
  }
  if(method==="POST") {
    if(path==="/v1/me/workouts")return service.logWorkout(actor,body);
    if(path==="/v1/me/checkins")return service.submitCheckin(actor,body);
    if(path==="/v1/me/deletion-requests")return service.requestDataDeletion(actor,body);
    if(path==="/v1/coach/programs")return {program:service.createProgram(actor,body)};
    if(path==="/v1/coach/assignments")return {assignment:service.assignProgram(actor,body)};
    let m=path.match(/^\/v1\/coach\/programs\/([^/]+)\/revise$/);
    if(m)return {program:service.reviseProgram(actor,decodeURIComponent(m[1]),body)};
    m=path.match(/^\/v1\/coach\/programs\/([^/]+)\/publish$/);
    if(m)return {program:service.publishProgram(actor,decodeURIComponent(m[1]))};
    m=path.match(/^\/v1\/coach\/checkins\/([^/]+)\/review$/);
    if(m)return service.reviewCheckin(actor,decodeURIComponent(m[1]),body);
    m=path.match(/^\/v1\/coach\/assignments\/([^/]+)\/revoke$/);
    if(m)return {assignment:service.revokeAssignment(actor,decodeURIComponent(m[1]))};
  }
  throw new CoachingError(404,"NOT_FOUND","Endpoint not found");
}
const verifyTokenSite=makeWixOAuthTokenBinding({
  expectedSiteId:SITE_ID,expectedClientId:"d61ad4ca-bfe1-4792-b1d6-099567dd79d0"
});
const verify=makeWixMemberVerifier({
  siteId:SITE_ID,
  verifyTokenSite,
  lookupProvisionedMember:async ({siteId,memberId})=>{
    if(!sql)return null;
    // Raw Wix identity must exist as a direct member or an exact, owner-approved alias.
    // Only the canonical member ID participates in coaching assignments and audit records.
    const rows=await sql.unsafe(
      `select m.org_id::text as org_id, m.role, m.status,
              m.wix_member_id::text as canonical_member_id
         from coaching_private.wix_memberships m
        where m.wix_site_id=$1::uuid and m.wix_member_id=$2::uuid
        union all
       select m.org_id::text as org_id, m.role, m.status,
              m.wix_member_id::text as canonical_member_id
         from coaching_private.owner_member_aliases a
         join coaching_private.wix_memberships m
           on m.wix_site_id=a.wix_site_id
          and m.wix_member_id=a.canonical_member_id
        where a.wix_site_id=$1::uuid and a.alias_member_id=$2::uuid
          and a.enabled=true and m.role='coach' and m.status='active'
        limit 2`,
      [siteId,memberId]
    );
    if(rows.length!==1)return null;
    return {siteId,memberId,orgId:rows[0].org_id,role:rows[0].role,
            status:rows[0].status,canonicalMemberId:rows[0].canonical_member_id};
  }
});
// Invitation code is 256 bits of WebCrypto entropy, stored only as a SHA-256 digest.
const MEMBER_URL="https://www.wixapis.com/members/v1/members/my?fieldSet=FULL";
const CODE_RE=/^[A-Za-z0-9_-]{43}$/;
const ID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hashCode=async code=>Array.from(new Uint8Array(
  await crypto.subtle.digest("SHA-256",new TextEncoder().encode(code))))
  .map(x=>x.toString(16).padStart(2,"0")).join("");

async function verifiedUnprovisionedMember(token){
  const scope=await verifyTokenSite({token,expectedSiteId:SITE_ID});
  if(!scope||scope.identityType!=="member"||!ID_RE.test(scope.memberId))return null;
  const ctrl=new AbortController();
  const stop=setTimeout(()=>ctrl.abort(),4000);
  try{
    const res=await fetch(MEMBER_URL,{
      headers:{Authorization:token,Accept:"application/json"},
      signal:ctrl.signal,redirect:"error"
    });
    if(!res.ok)return null;
    const str=await res.text();
    if(str.length>65536)return null;
    const info=JSON.parse(str).member;
    if(!info||info.id!==scope.memberId||info.status!=="APPROVED")return null;
    const name=typeof info.profile?.nickname==="string"
      ?info.profile.nickname.trim().slice(0,80):"Coaching Member";
    return {memberId:info.id,displayName:name||"Coaching Member"};
  }catch{return null}finally{clearTimeout(stop)}
}
async function redeemInvitation(token,body) {
  if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body).some(k=>!["code","noticeVersion","consent"].includes(k))||
    typeof body.code!=="string"||!CODE_RE.test(body.code)||
    typeof body.noticeVersion!=="string"||body.consent!==true)
    throw new CoachingError(422,"INVALID_INVITATION","Valid invitation code and consent required");
  // Gate BEFORE any provider call, even for a valid member: no enrollment while off.
  const gates=await sql.unsafe(
    "select c.enrollment_enabled, c.privacy_notice_version from coaching_private.release_controls c join coaching_private.organizations o on o.id=c.org_id where o.wix_site_id=$1::uuid",
    [SITE_ID]
  );
  if(gates.length!==1||!gates[0].enrollment_enabled)
    throw new CoachingError(423,"ENROLLMENT_DISABLED","Client onboarding remains locked");
  const member=await verifiedUnprovisionedMember(token);
  if(!member)throw new CoachingError(401,"UNAUTHENTICATED","Approved Wix member required");
  const digest=await hashCode(body.code);
  return sql.begin(async tx=>{
    const controls=await tx.unsafe(
      "select c.org_id::text, c.enrollment_enabled,c.privacy_notice_version,c.privacy_approved_at,c.backup_verified_at from coaching_private.release_controls c join coaching_private.organizations o on c.org_id=o.id where o.wix_site_id=$1::uuid for update of c",
      [SITE_ID]
    );
    const gate=controls[0];
    if(!gate?.enrollment_enabled||!gate.privacy_approved_at||!gate.backup_verified_at)
      throw new CoachingError(423,"ENROLLMENT_DISABLED","Client onboarding remains locked");
    if(body.noticeVersion!==gate.privacy_notice_version)
      throw new CoachingError(422,"NOTICE_VERSION","Review the current consent notice before proceeding");
    const existing=await tx.unsafe(
      "select wix_member_id from coaching_private.wix_memberships where wix_site_id=$1::uuid and wix_member_id=$2::uuid union all select alias_member_id from coaching_private.owner_member_aliases where wix_site_id=$1::uuid and alias_member_id=$2::uuid",
      [SITE_ID,member.memberId]
    );
    if(existing.length)throw new CoachingError(409,"ACCOUNT_EXISTS","This Wix member is already provisioned");
    const invitations=await tx.unsafe(
      "select id,coach_id from coaching_private.invitations where org_id=$1::uuid and code_digest=$2 and state='pending' and expires_at>now() for update",
      [gate.org_id,digest]
    );
    if(invitations.length!==1)throw new CoachingError(404,"INVITATION_INVALID","Invalid or expired invitation");
    await tx.unsafe(
      "insert into coaching_private.wix_memberships(org_id,wix_site_id,wix_member_id,role,status,display_name) values ($1::uuid,$2::uuid,$3::uuid,'client','active',$4)",
      [gate.org_id,SITE_ID,member.memberId,member.displayName]
    );
    await tx.unsafe(
      "insert into coaching_private.client_consents(wix_site_id,wix_member_id,org_id,notice_version) values ($1::uuid,$2::uuid,$3::uuid,$4)",
      [SITE_ID,member.memberId,gate.org_id,body.noticeVersion]
    );
    await tx.unsafe(
      "update coaching_private.invitations set state='redeemed',claimed_at=now(),claimed_member_id=$2::uuid where id=$1::uuid",
      [invitations[0].id,member.memberId]
    );
    await tx.unsafe(
      "insert into coaching_private.audit_events(org_id,actor_id,action,resource_id) values ($1::uuid,$2::uuid,'CLIENT_OPTED_IN',$3)",
      [gate.org_id,member.memberId,String(invitations[0].id)]
    );
    return {enrolled:true,memberId:member.memberId};
  });
}

async function handle(req) {
  const origin=req.headers.get("origin");
  try {
    if(origin&&!ORIGINS.has(origin))return send({error:"ORIGIN_DENIED"},403);
    const path=pathFor(req);
    if(req.method==="OPTIONS") {
      if(!origin||!ORIGINS.has(origin))return send({error:"ORIGIN_DENIED"},403);
      const h=new Headers({
        "Access-Control-Allow-Origin":origin,
        "Access-Control-Allow-Headers":"authorization, content-type",
        "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
        "Cache-Control":"no-store","Vary":"Origin"
      });
      return new Response(null,{status:204,headers:h});
    }
    if(req.method==="GET"&&path==="/health") {
      if(!sql)return send({service:"TriValley coaching",stage:"staging",databaseReady:false},503,origin);
      try {
        const rows=await sql.unsafe(
          "select count(*)::int as organizations from coaching_private.organizations where wix_site_id=$1::uuid",
          [SITE_ID]
        );
        if(rows.length!==1||rows[0].organizations!==1)throw new Error("Missing staging organization");
        return send({service:"TriValley coaching",stage:"staging",databaseReady:true,
          authenticatedAccess:"required",clientMigration:false},200,origin);
      }catch{
        return send({service:"TriValley coaching",stage:"staging",databaseReady:false},503,origin);
      }
    }
    if(req.method!=="GET"&&req.method!=="POST")return send({error:"METHOD_NOT_ALLOWED"},405,origin);
    if(!sql)return send({error:"SERVICE_NOT_READY"},503,origin);
    const bearer=/^Bearer ([^\s]{10,4096})$/i.exec(req.headers.get("authorization")||"")?.[1];
    if(!bearer)return send({error:"UNAUTHENTICATED"},401,origin);
    if(req.method==="POST"&&path==="/v1/enroll/redeem"){
      const body=await jsonBody(req);
      return send(await redeemInvitation(bearer,body),201,origin);
    }
    const actor=await verify(bearer);
    if(!actor)return send({error:"UNAUTHENTICATED"},401,origin);
    const body=req.method==="POST"?await jsonBody(req):null;
    const result=await sql.begin(async tx=>{
      // Re-check permissions *inside* the serialized write transaction.
      const rows=await tx.unsafe(
        "select wix_member_id::text as member_id, org_id::text as org_id, role, status, display_name from coaching_private.wix_memberships where org_id=$1::uuid and wix_site_id=$2::uuid and status='active'",
        [actor.orgId,SITE_ID]
      );
      const current=rows.find(row=>row.member_id===actor.sub);
      if(!current||current.role!==actor.role||current.org_id!==actor.orgId)
        throw new CoachingError(401,"UNAUTHENTICATED","Member access revoked");
      const state=await tx.unsafe(
        "select revision, payload from coaching_private.snapshots where org_id=$1::uuid for update",
        [actor.orgId]
      );
      if(state.length!==1)throw new CoachingError(503,"SERVICE_NOT_READY","Coaching state unavailable");

      // Owner-only portable backup export. The browser encrypts with a user-held
      // passphrase before saving; neither password nor client records enter GitHub.
      if(req.method==="GET"&&path==="/v1/coach/backup"){
        if(actor.role!=="coach")throw new CoachingError(403,"COACH_ONLY","Coach account required");
        const members=await tx.unsafe(
          "select wix_site_id::text, wix_member_id::text, org_id::text, role, status, display_name from coaching_private.wix_memberships where org_id=$1::uuid order by wix_member_id",
          [actor.orgId]
        );
        const aliases=await tx.unsafe(
          "select a.wix_site_id::text,a.alias_member_id::text,a.canonical_member_id::text,a.enabled from coaching_private.owner_member_aliases a join coaching_private.wix_memberships m on a.wix_site_id=m.wix_site_id and a.canonical_member_id=m.wix_member_id where m.org_id=$1::uuid order by a.alias_member_id",
          [actor.orgId]
        );
        const audit=await tx.unsafe(
          "select actor_id::text, action, resource_id, occurred_at from coaching_private.audit_events where org_id=$1::uuid order by event_id limit 10001",
          [actor.orgId]
        );
        if(audit.length>10000)throw new CoachingError(413,"EXPORT_LIMIT","Audit export exceeds current pilot limit");
        await tx.unsafe(
          "insert into coaching_private.audit_events(org_id,actor_id,action,resource_id) values ($1::uuid,$2::uuid,'OWNER_BACKUP_EXPORTED',$3)",
          [actor.orgId,actor.sub,String(state[0].revision)]
        );
        return {format:"trivalley-coaching-private-backup-v1",generatedAt:new Date().toISOString(),
          siteId:SITE_ID, orgId:actor.orgId, revision:Number(state[0].revision),
          payload:state[0].payload, memberships:members, ownerAliases:aliases,audit};
      }

      if(req.method==="GET"&&path==="/v1/coach/recovery-points"){
        if(actor.role!=="coach")throw new CoachingError(403,"COACH_ONLY","Coach account required");
        const points=await tx.unsafe(
          "select revision,captured_at,octet_length(payload::text) as bytes from coaching_private.snapshot_revisions where org_id=$1::uuid order by revision desc limit 20",
          [actor.orgId]
        );
        return {currentRevision:Number(state[0].revision),recoveryPoints:points};
      }
      // Pilot release controls prevent collection of actual client workout data
      // before privacy, backup and access acceptance are explicitly enabled.
      if(req.method==="GET"&&path==="/v1/coach/release-status"){
        if(actor.role!=="coach")throw new CoachingError(403,"COACH_ONLY","Coach account required");
        const gates=await tx.unsafe(
          "select enrollment_enabled, workout_sync_enabled,privacy_notice_version,(privacy_approved_at is not null) privacy_approved,(backup_verified_at is not null) backup_verified from coaching_private.release_controls where org_id=$1::uuid",
          [actor.orgId]
        );
        if(gates.length!==1)throw new CoachingError(503,"SERVICE_NOT_READY","Missing release controls");
        return {stage:"staging", ...gates[0], realClientMigration:false};
      }
      const clientWrite=req.method==="POST"&&(path==="/v1/me/workouts"||path==="/v1/me/checkins");
      if(clientWrite) {
        const gate=await tx.unsafe(
          "select workout_sync_enabled from coaching_private.release_controls where org_id=$1::uuid",
          [actor.orgId]
        );
        if(gate.length!==1||!gate[0].workout_sync_enabled)
          throw new CoachingError(423,"CLIENT_SYNC_DISABLED","Client record synchronization remains locked");
      }
      if(req.method==="GET"&&path==="/v1/coach/invitations"){
        if(actor.role!=="coach")throw new CoachingError(403,"COACH_ONLY","Coach account required");
        const invitations=await tx.unsafe(
          "select id::text,label,state,created_at,expires_at,claimed_at from coaching_private.invitations where org_id=$1::uuid and coach_id=$2::uuid order by created_at desc limit 50",
          [actor.orgId,actor.sub]
        );
        return {invitations};
      }
      if(req.method==="POST"&&path==="/v1/coach/invitations"){
        if(actor.role!=="coach")throw new CoachingError(403,"COACH_ONLY","Coach account required");
        if(!body||Object.keys(body).length!==1||typeof body.label!=="string"||
          !/^[A-Za-z0-9 _.-]{2,80}$/.test(body.label))
          throw new CoachingError(422,"VALIDATION","Invitation label must be 2-80 plain characters");
        const gate=await tx.unsafe(
          "select enrollment_enabled,privacy_approved_at,backup_verified_at from coaching_private.release_controls where org_id=$1::uuid for update",
          [actor.orgId]
        );
        if(gate.length!==1||!gate[0].enrollment_enabled||
          !gate[0].privacy_approved_at||!gate[0].backup_verified_at)
          throw new CoachingError(423,"ENROLLMENT_DISABLED","Client onboarding is not yet approved");
        const count=await tx.unsafe(
          "select count(*)::int as n from coaching_private.invitations where org_id=$1::uuid and coach_id=$2::uuid and state='pending' and expires_at>now()",
          [actor.orgId,actor.sub]
        );
        if(count[0].n>=20)throw new CoachingError(429,"INVITE_LIMIT","Too many active invitations");
        const random=crypto.getRandomValues(new Uint8Array(32));
        const raw=Array.from(random,b=>String.fromCharCode(b)).join("");
        const secret=btoa(raw).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
        const digest=await hashCode(secret);
        const entry=await tx.unsafe(
          "insert into coaching_private.invitations(org_id,coach_id,code_digest,label,expires_at) values ($1::uuid,$2::uuid,$3,$4,now()+interval '48 hours') returning id::text,label,expires_at",
          [actor.orgId,actor.sub,digest,body.label]
        );
        await tx.unsafe(
          "insert into coaching_private.audit_events(org_id,actor_id,action,resource_id) values ($1::uuid,$2::uuid,'INVITE_CREATED',$3)",
          [actor.orgId,actor.sub,entry[0].id]
        );
        return {invitation:{...entry[0],code:secret,oneTimeDisplay:true}};
      }
      if(req.method==="POST"&&path.startsWith("/v1/coach/invitations/")&&path.endsWith("/revoke")&&path.split("/").length===6){
        if(actor.role!=="coach")throw new CoachingError(403,"COACH_ONLY","Coach account required");
        if(!body||Object.keys(body).length!==0)
          throw new CoachingError(422,"VALIDATION","No body fields allowed");
        const id=path.split("/")[4];
        if(!ID_RE.test(id))throw new CoachingError(404,"NOT_FOUND","Invitation unavailable");
        const revoked=await tx.unsafe(
          "update coaching_private.invitations set state='revoked' where id=$1::uuid and org_id=$2::uuid and coach_id=$3::uuid and state='pending' returning id",
          [id,actor.orgId,actor.sub]
        );
        if(revoked.length!==1)throw new CoachingError(404,"NOT_FOUND","Invitation unavailable");
        await tx.unsafe(
          "insert into coaching_private.audit_events(org_id,actor_id,action,resource_id) values ($1::uuid,$2::uuid,'INVITE_REVOKED',$3)",
          [actor.orgId,actor.sub,id]
        );
        return {revoked:true};
      }
      const store=decodeSnapshot(state[0].payload,rows);
      const service=new CoachingService({store});
      const data=dispatch(service,actor,req.method,path,body);
      if(req.method==="POST"||store.audit.length){
        const payload=encodeSnapshot(store);
        if(new TextEncoder().encode(payload).byteLength>4000000)
          throw new CoachingError(413,"STORAGE_LIMIT","Private coaching record limit reached");
        // Persist a before-and-after recovery point atomically with the mutation.
        // These *local* snapshots are not an off-provider backup.
        await tx.unsafe(
          "insert into coaching_private.snapshot_revisions(org_id,revision,payload) values ($1::uuid,$2::bigint,$3::jsonb) on conflict(org_id,revision) do nothing",
          [actor.orgId,String(state[0].revision),JSON.stringify(state[0].payload)]
        );
        await tx.unsafe(
          "update coaching_private.snapshots set payload=$2::jsonb, revision=revision+1, updated_at=now() where org_id=$1::uuid",
          [actor.orgId,payload]
        );
        await tx.unsafe(
          "insert into coaching_private.snapshot_revisions(org_id,revision,payload) values ($1::uuid,$2::bigint,$3::jsonb) on conflict(org_id,revision) do nothing",
          [actor.orgId,String(BigInt(state[0].revision)+1n),payload]
        );
        for(const evt of store.audit)await tx.unsafe(
          "insert into coaching_private.audit_events(org_id,actor_id,action,resource_id,occurred_at) values ($1::uuid,$2::uuid,$3,$4,$5::timestamptz)",
          [actor.orgId,evt.actorId,evt.action,evt.resourceId,evt.at]
        );
      }
      return data;
    });
    const created=req.method==="POST"?201:200;
    return send(result,created,origin);
  }catch(e) {
    if(e instanceof CoachingError)
      return send({error:e.code,message:e.message},e.status,origin);
    return send({error:"INTERNAL_ERROR",message:"Operation unavailable"},500,origin);
  }
}
Deno.serve(handle);
