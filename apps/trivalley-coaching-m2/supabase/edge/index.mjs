// TriValley Coaching: private, deny-by-default Wix-member staging API.
// Runtime credentials are supplied by Supabase, never stored in Git or sent to clients.
// Production rollout is gated by real Wix-member site binding + end-to-end acceptance.
import postgres from "npm:postgres@3.4.3";
import {CoachingService,InMemoryCoachingStore,CoachingError} from "./domain.mjs";
import {makeWixMemberVerifier} from "./wix-verify.mjs";
import {makeWixOAuthTokenBinding} from "./wix-token-info.mjs";
import {eraseClientState} from "./deletion.mjs";
import {requireCoachingOwner} from "./owner-permissions.mjs";
import {validateCoachingBackup} from "./backup-restore.mjs";

const SITE_ID="9e6343d9-5a1c-45e2-8596-f73408e38402";
const HOST_NAME="trivalley-coaching-api";
const MAX_BODY=48*1024;
const MAX_RESTORE_BODY=2*1024*1024;
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
async function jsonBody(req,maxBody=MAX_BODY) {
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type")||""))
    throw new CoachingError(415,"CONTENT_TYPE","Expected application/json");
  if(Number(req.headers.get("content-length")||"0")>maxBody)
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
      if(size>maxBody) {
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

// Postgres-backed rate limiting is autocommitted BEFORE mutation transactions,
// so failed code guesses still count. Only verified Wix member identities are used.
async function consumeMemberBudget(orgId,memberId,scope,maxPerHour){
  if(!ID_RE.test(orgId||"")||!ID_RE.test(memberId||"")||
     !["mutation","invite_redeem"].includes(scope))
    throw new CoachingError(401,"UNAUTHENTICATED","Verified member required");
  const rows=await sql.unsafe(
    `insert into coaching_private.request_limits(org_id,wix_member_id,scope,window_start,attempts)
       values($1::uuid,$2::uuid,$3,date_trunc('hour',now()),1)
     on conflict(org_id,wix_member_id,scope,window_start)
       do update set attempts=least(coaching_private.request_limits.attempts+1,1000000)
     returning attempts`,
    [orgId,memberId,scope]
  );
  if(rows.length!==1||!Number.isInteger(rows[0].attempts))
    throw new CoachingError(503,"RATE_LIMIT_UNAVAILABLE","Request safeguards unavailable");
  if(rows[0].attempts>maxPerHour)
    throw new CoachingError(429,"RATE_LIMIT","Too many requests; retry after the hourly window");
}

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
    "select c.org_id::text, c.enrollment_enabled, c.privacy_notice_version from coaching_private.release_controls c join coaching_private.organizations o on o.id=c.org_id where o.wix_site_id=$1::uuid",
    [SITE_ID]
  );
  if(gates.length!==1||!gates[0].enrollment_enabled)
    throw new CoachingError(423,"ENROLLMENT_DISABLED","Client onboarding remains locked");
  const member=await verifiedUnprovisionedMember(token);
  if(!member)throw new CoachingError(401,"UNAUTHENTICATED","Approved Wix member required");
  await consumeMemberBudget(gates[0].org_id,member.memberId,"invite_redeem",10);
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
    if(req.method==="GET"&&path==="/pilot-status"){
      if(!sql)return send({stage:"staging",enrollmentEnabled:false,syncEnabled:false},503,origin);
      try{
        const gates=await sql.unsafe(
          "select c.enrollment_enabled,c.workout_sync_enabled,c.privacy_notice_version from coaching_private.release_controls c join coaching_private.organizations o on c.org_id=o.id where o.wix_site_id=$1::uuid",
          [SITE_ID]
        );
        if(gates.length!==1)throw new Error("Missing release controls");
        return send({stage:"staging",enrollmentEnabled:gates[0].enrollment_enabled,
          syncEnabled:gates[0].workout_sync_enabled,
          noticeVersion:gates[0].privacy_notice_version,
          noRealClientMigration:true},200,origin);
      }catch{return send({stage:"staging",enrollmentEnabled:false,syncEnabled:false},503,origin)}
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
    if(req.method==="POST")
      await consumeMemberBudget(actor.orgId,actor.sub,"mutation",240);
    const body=req.method==="POST"?await jsonBody(req,path==="/v1/coach/restore-drill"?MAX_RESTORE_BODY:MAX_BODY):null;
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
        requireCoachingOwner(actor);
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
        requireCoachingOwner(actor);
        const points=await tx.unsafe(
          "select revision,captured_at,octet_length(payload::text) as bytes from coaching_private.snapshot_revisions where org_id=$1::uuid order by revision desc limit 20",
          [actor.orgId]
        );
        return {currentRevision:Number(state[0].revision),recoveryPoints:points};
      }
      // Pilot release controls prevent collection of actual client workout data
      // before privacy, backup and access acceptance are explicitly enabled.
      // Explicit owner-only release approvals. These controls never accept user role flags.
      if(req.method==="POST"&&path==="/v1/coach/backup-receipt"){
        if(actor.role!=="coach"||actor.sub!=="4d122d05-0633-461b-ab06-4c642199e75a")
          throw new CoachingError(403,"OWNER_ONLY","Canonical coaching owner required");
        if(!body||Object.keys(body).sort().join(",")!=="confirmedOffsite,digest,revision"||
          body.confirmedOffsite!==true||!Number.isSafeInteger(body.revision)||
          !Number.isSafeInteger(Number(state[0].revision))||
          body.revision!==Number(state[0].revision)||
          typeof body.digest!=="string"||!new RegExp("^[0-9a-f]{64}$").test(body.digest))
          throw new CoachingError(422,"BACKUP_RECEIPT_INVALID","Verify a current encrypted backup first");
        await tx.unsafe(
          "update coaching_private.release_controls set backup_verified_at=now(),backup_revision=$2::bigint,backup_file_sha256=$3,reviewed_at=now() where org_id=$1::uuid",
          [actor.orgId,String(body.revision),body.digest]
        );
        await tx.unsafe(
          "insert into coaching_private.audit_events(org_id,actor_id,action,resource_id) values ($1::uuid,$2::uuid,'OFFSITE_BACKUP_ATTESTED',$3)",
          [actor.orgId,actor.sub,String(body.revision)]
        );
        return {backupAttested:true,revision:body.revision,
          notice:"A verified local decrypt and owner assertion were recorded; offsite storage remains the owner's responsibility."};
      }
      if(req.method==="POST"&&path==="/v1/coach/restore-drill"){
        if(actor.role!=="coach"||actor.sub!=="4d122d05-0633-461b-ab06-4c642199e75a")
          throw new CoachingError(403,"OWNER_ONLY","Canonical coaching owner required");
        if(!body||Object.keys(body).sort().join(",")!=="backup,digest"||
          typeof body.digest!=="string"||!/^[0-9a-f]{64}$/.test(body.digest))
          throw new CoachingError(422,"RESTORE_DRILL_INVALID","Use a verified encrypted backup");
        const prior=await tx.unsafe(
          "select backup_revision,backup_file_sha256,backup_verified_at from coaching_private.release_controls where org_id=$1::uuid for update",
          [actor.orgId]
        );
        const control=prior[0];
        if(!control?.backup_verified_at||control.backup_file_sha256!==body.digest||
          Number(control.backup_revision)!==Number(state[0].revision))
          throw new CoachingError(423,"BACKUP_ATTESTATION_REQUIRED","Verify the current saved encrypted backup first");
        let summary;
        try{
          summary=validateCoachingBackup(body.backup,{siteId:SITE_ID,orgId:actor.orgId});
        }catch{
          throw new CoachingError(422,"BACKUP_CONTENT_INVALID","Backup failed integrity or ownership validation");
        }
        if(summary.revision!==Number(state[0].revision))
          throw new CoachingError(409,"BACKUP_STALE","A new backup is required after coaching data changes");
        const json=JSON.stringify(body.backup);
        if(new TextEncoder().encode(json).byteLength>MAX_RESTORE_BODY-1024)
          throw new CoachingError(413,"BACKUP_TOO_LARGE","Restore drill limit reached");
        // Copy the entire decrypted snapshot into isolated transaction-local
        // PostgreSQL storage, compare JSONB content, and drop at commit.
        // Existing organizations, programs and clients are NEVER overwritten.
        await tx.unsafe(
          "create temporary table trivalley_restore_probe (data jsonb not null, revision bigint not null) on commit drop"
        );
        await tx.unsafe(
          "insert into pg_temp.trivalley_restore_probe(data,revision) values ($1::jsonb,$2::bigint)",
          [json,String(summary.revision)]
        );
        const drill=await tx.unsafe(
          "select (data=$1::jsonb) as same_data,(revision=$2::bigint) as same_revision from pg_temp.trivalley_restore_probe",
          [json,String(summary.revision)]
        );
        if(drill.length!==1||drill[0].same_data!==true||drill[0].same_revision!==true)
          throw new CoachingError(500,"RESTORE_DRILL_FAILED","Database copy verification failed");
        await tx.unsafe(
          "insert into coaching_private.restore_drill_receipts(org_id,actor_id,snapshot_revision,file_digest,program_count,assignment_count,workout_count,verified) values ($1::uuid,$2::uuid,$3::bigint,$4,$5,$6,$7,true)",
          [actor.orgId,actor.sub,String(summary.revision),body.digest,
            summary.programs,summary.assignments,summary.workouts]
        );
        await tx.unsafe(
          "update coaching_private.release_controls set restore_drill_at=now(),restore_drill_revision=$2::bigint,restore_drill_sha256=$3,reviewed_at=now() where org_id=$1::uuid",
          [actor.orgId,String(summary.revision),body.digest]
        );
        await tx.unsafe(
          "insert into coaching_private.audit_events(org_id,actor_id,action,resource_id) values ($1::uuid,$2::uuid,'BACKUP_COPY_RESTORE_TESTED',$3)",
          [actor.orgId,actor.sub,String(summary.revision)]
        );
        return {restoreDrillPassed:true,databaseCopyOnly:true,
          revision:summary.revision,counts:summary,
          notice:"The backup was copied into disposable Postgres storage and compared. Production records were not overwritten."};
      }
      if(req.method==="POST"&&path==="/v1/coach/approve-privacy"){
        if(actor.role!=="coach"||actor.sub!=="4d122d05-0633-461b-ab06-4c642199e75a")
          throw new CoachingError(403,"OWNER_ONLY","Canonical coaching owner required");
        if(!body||Object.keys(body).sort().join(",")!=="confirmation,version"||
          body.confirmation!=="I_APPROVE_TRIVALLEY_PILOT_DATA_NOTICE"||
          body.version!=="TVFIT-PILOT-2026-11-V1")
          throw new CoachingError(422,"NOTICE_NOT_APPROVED","Explicit notice approval required");
        const result=await tx.unsafe(
          "update coaching_private.release_controls set privacy_approved_at=now(),reviewed_at=now() where org_id=$1::uuid and privacy_notice_version=$2 returning privacy_notice_version",
          [actor.orgId,body.version]
        );
        if(result.length!==1)throw new CoachingError(409,"NOTICE_VERSION","Update and review the newest privacy notice");
        await tx.unsafe(
          "insert into coaching_private.audit_events(org_id,actor_id,action,resource_id) values ($1::uuid,$2::uuid,'PILOT_NOTICE_APPROVED',$3)",
          [actor.orgId,actor.sub,body.version]
        );
        return {noticeApproved:true,version:body.version};
      }
      if(req.method==="POST"&&path==="/v1/coach/activate-pilot"){
        if(actor.role!=="coach"||actor.sub!=="4d122d05-0633-461b-ab06-4c642199e75a")
          throw new CoachingError(403,"OWNER_ONLY","Canonical coaching owner required");
        if(!body||Object.keys(body).length!==1||body.confirmation!=="ACTIVATE_CONSENTED_CLIENT_PILOT")
          throw new CoachingError(422,"CONFIRMATION_REQUIRED","Explicit release approval required");
        const controls=await tx.unsafe(
          "select privacy_approved_at,backup_verified_at,backup_revision,backup_file_sha256,restore_drill_at,restore_drill_revision,restore_drill_sha256,privacy_notice_version from coaching_private.release_controls where org_id=$1::uuid for update",
          [actor.orgId]
        );
        const gate=controls[0];
        if(!gate||!gate.privacy_approved_at||!gate.backup_verified_at||
           gate.privacy_notice_version!=="TVFIT-PILOT-2026-11-V1"||
           !gate.restore_drill_at||
           gate.restore_drill_sha256!==gate.backup_file_sha256||
           Number(gate.restore_drill_revision)!==Number(state[0].revision)||
           Number(gate.backup_revision)!==Number(state[0].revision)||
           Date.now()-new Date(gate.backup_verified_at).getTime()>48*3600000)
          throw new CoachingError(423,"RELEASE_GATE_INCOMPLETE","Privacy approval and a current verified offsite backup are required");
        const pending=await tx.unsafe(
          "select 1 from coaching_private.snapshots where org_id=$1::uuid and jsonb_path_exists(payload, '$.deletionRequests[*][1] ? (@.status == \"pending_owner_review\")') limit 1",
          [actor.orgId]
        );
        if(pending.length)throw new CoachingError(423,"PENDING_DELETION","Resolve pending deletion requests before enrollment");
        await tx.unsafe(
          "update coaching_private.release_controls set enrollment_enabled=true,workout_sync_enabled=true,enrollment_approved_at=now(),reviewed_at=now() where org_id=$1::uuid",
          [actor.orgId]
        );
        await tx.unsafe(
          "insert into coaching_private.audit_events(org_id,actor_id,action,resource_id) values ($1::uuid,$2::uuid,'CONSENTED_PILOT_ACTIVATED',$3)",
          [actor.orgId,actor.sub,String(state[0].revision)]
        );
        return {pilotActivated:true,stage:"private-client-pilot",clientMigration:false};
      }
      if(req.method==="POST"&&path==="/v1/coach/pause-pilot"){
        if(actor.role!=="coach"||actor.sub!=="4d122d05-0633-461b-ab06-4c642199e75a")
          throw new CoachingError(403,"OWNER_ONLY","Canonical coaching owner required");
        if(!body||Object.keys(body).length!==1||body.confirmation!=="PAUSE_CLIENT_PILOT")
          throw new CoachingError(422,"CONFIRMATION_REQUIRED","Explicit pause approval required");
        await tx.unsafe(
          "update coaching_private.release_controls set enrollment_enabled=false,workout_sync_enabled=false,reviewed_at=now() where org_id=$1::uuid",
          [actor.orgId]
        );
        await tx.unsafe(
          "insert into coaching_private.audit_events(org_id,actor_id,action,resource_id) values ($1::uuid,$2::uuid,'CONSENTED_PILOT_PAUSED',$3)",
          [actor.orgId,actor.sub,"client-pilot"]
        );
        return {pilotPaused:true};
      }
      if(req.method==="GET"&&path==="/v1/coach/release-status"){
        requireCoachingOwner(actor);
        const gates=await tx.unsafe(
          "select enrollment_enabled, workout_sync_enabled,privacy_notice_version,backup_revision,backup_verified_at,restore_drill_revision,restore_drill_at,(restore_drill_at is not null) restore_drill_verified,(privacy_approved_at is not null) privacy_approved,(backup_verified_at is not null) backup_verified from coaching_private.release_controls where org_id=$1::uuid",
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
      if(req.method==="GET"&&path==="/v1/coach/enrolled-clients"){
        requireCoachingOwner(actor);
        const clients=await tx.unsafe(
          `select m.wix_member_id::text as id, m.display_name, m.created_at
             from coaching_private.wix_memberships m
             join coaching_private.client_consents c on
                c.wix_site_id=m.wix_site_id and c.wix_member_id=m.wix_member_id and c.org_id=m.org_id
             join coaching_private.release_controls r on r.org_id=m.org_id and r.privacy_notice_version=c.notice_version
            where m.org_id=$1::uuid and m.role='client' and m.status='active'
            order by m.created_at desc limit 200`,
          [actor.orgId]
        );
        return {clients};
      }
      if(req.method==="POST"&&path==="/v1/coach/assignments"){
        requireCoachingOwner(actor);
        if(!body||typeof body.clientId!=="string"||!ID_RE.test(body.clientId))
          throw new CoachingError(422,"VALIDATION","Valid client member ID required");
        const eligible=await tx.unsafe(
          `select 1
             from coaching_private.wix_memberships m
             join coaching_private.client_consents c on c.wix_site_id=m.wix_site_id and c.wix_member_id=m.wix_member_id and c.org_id=m.org_id
             join coaching_private.release_controls r on r.org_id=m.org_id and r.privacy_notice_version=c.notice_version
            where m.org_id=$1::uuid and m.wix_member_id=$2::uuid and m.role='client' and m.status='active'
            limit 1`,
          [actor.orgId,body.clientId]
        );
        if(eligible.length!==1)throw new CoachingError(403,"CLIENT_CONSENT_REQUIRED","Client has not opted into this coaching program");
      }
      if(req.method==="GET"&&path==="/v1/coach/invitations"){
        requireCoachingOwner(actor);
        const invitations=await tx.unsafe(
          "select id::text,label,state,created_at,expires_at,claimed_at from coaching_private.invitations where org_id=$1::uuid and coach_id=$2::uuid order by created_at desc limit 50",
          [actor.orgId,actor.sub]
        );
        return {invitations};
      }
      if(req.method==="POST"&&path==="/v1/coach/invitations"){
        requireCoachingOwner(actor);
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
        requireCoachingOwner(actor);
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
      if(req.method==="GET"&&path==="/v1/coach/deletion-requests"){
        if(actor.role!=="coach"||actor.sub!=="4d122d05-0633-461b-ab06-4c642199e75a")
          throw new CoachingError(403,"OWNER_ONLY","Canonical coaching owner review required");
        const requests=[...store.deletionRequests.values()].map(x=>structuredClone(x));
        return {requests:requests.sort((a,b)=>String(b.requestedAt).localeCompare(String(a.requestedAt)))};
      }
      if(req.method==="POST"&&path.startsWith("/v1/coach/deletion-requests/")&&
         path.endsWith("/complete")&&path.split("/").length===6){
        if(actor.role!=="coach"||actor.sub!=="4d122d05-0633-461b-ab06-4c642199e75a")
          throw new CoachingError(403,"OWNER_ONLY","Canonical coaching owner review required");
        if(!body||body.confirmation!=="CONFIRM_PERMANENT_COACHING_ERASURE"||Object.keys(body).length!==1)
          throw new CoachingError(422,"CONFIRMATION_REQUIRED","Explicit deletion approval required");
        const requestId=path.split("/")[4];
        if(!ID_RE.test(requestId))throw new CoachingError(404,"NOT_FOUND","Deletion request unavailable");
        let result;
        try{result=eraseClientState(store,actor,requestId)}
        catch{throw new CoachingError(404,"NOT_FOUND","Pending deletion request unavailable")}
        const clientId=result.clientId;
        const valid=await tx.unsafe(
          "select 1 from coaching_private.wix_memberships where org_id=$1::uuid and wix_member_id=$2::uuid and role='client' for update",
          [actor.orgId,clientId]
        );
        if(valid.length!==1)throw new CoachingError(404,"NOT_FOUND","Client enrollment unavailable");
        const payload=encodeSnapshot(store);
        if(new TextEncoder().encode(payload).byteLength>4000000)
          throw new CoachingError(413,"STORAGE_LIMIT","Cannot finalize deletion");
        // Scrub recoverable historical snapshots BEFORE writing a redacted revision.
        await tx.unsafe(
          "delete from coaching_private.snapshot_revisions where org_id=$1::uuid",
          [actor.orgId]
        );
        await tx.unsafe(
          "update coaching_private.snapshots set payload=$2::jsonb,revision=revision+1,updated_at=now() where org_id=$1::uuid",
          [actor.orgId,payload]
        );
        await tx.unsafe(
          "insert into coaching_private.snapshot_revisions(org_id,revision,payload) values ($1::uuid,$2::bigint,$3::jsonb)",
          [actor.orgId,String(BigInt(state[0].revision)+1n),payload]
        );
        await tx.unsafe(
          "delete from coaching_private.client_consents where org_id=$1::uuid and wix_member_id=$2::uuid",
          [actor.orgId,clientId]
        );
        await tx.unsafe(
          "delete from coaching_private.invitations where org_id=$1::uuid and claimed_member_id=$2::uuid",
          [actor.orgId,clientId]
        );
        await tx.unsafe(
          "delete from coaching_private.wix_memberships where org_id=$1::uuid and wix_member_id=$2::uuid and role='client'",
          [actor.orgId,clientId]
        );
        await tx.unsafe(
          "delete from coaching_private.audit_events where org_id=$1::uuid and (actor_id=$2::uuid OR resource_id=ANY($3::text[]))",
          [actor.orgId,clientId,result.resources]
        );
        await tx.unsafe(
          "insert into coaching_private.audit_events(org_id,actor_id,action,resource_id) values ($1::uuid,$2::uuid,'DATA_DELETION_COMPLETED',$3)",
          [actor.orgId,actor.sub,requestId]
        );
        return {completed:true,requestId,removed:{workouts:result.workouts,
          assignments:result.assignments,checkins:result.checkins},
          notice:"Review previously downloaded external backups separately; they cannot be recalled."};
      }
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
