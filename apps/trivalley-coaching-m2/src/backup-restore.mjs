// Validates an owner-decrypted off-provider backup *before* testing restoration.
// No unverified backup may be promoted to a production source of truth.
const isObj = v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const GUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAPS=["programs","programVersions","assignments","workouts","checkins","deletionRequests"];
function invalid(code){throw Object.assign(new Error(code),{backupCode:code})}
export function validateCoachingBackup(backup,{siteId,orgId,maxItems=20000}={}){
  if(!isObj(backup)||backup.format!=="trivalley-coaching-private-backup-v1"||
    backup.siteId!==siteId||backup.orgId!==orgId||
    !Number.isSafeInteger(backup.revision)||backup.revision<0||
    !isObj(backup.payload)||!Array.isArray(backup.memberships)||
    !Array.isArray(backup.ownerAliases)||!Array.isArray(backup.audit))
    invalid("INVALID_BACKUP_FORMAT");
  if(backup.memberships.length>200||backup.ownerAliases.length>50||backup.audit.length>10000)
    invalid("BACKUP_TOO_LARGE");
  const seenMembers=new Set();
  for(const m of backup.memberships){
    if(!isObj(m)||m.wix_site_id!==siteId||m.org_id!==orgId||
      !GUID.test(m.wix_member_id||"")||!["coach","client"].includes(m.role)||
      !["active","disabled"].includes(m.status)||
      typeof m.display_name!=="string"||m.display_name.length>120||
      seenMembers.has(m.wix_member_id))invalid("INVALID_BACKUP_MEMBERS");
    seenMembers.add(m.wix_member_id);
  }
  for(const a of backup.ownerAliases){
    if(!isObj(a)||a.wix_site_id!==siteId||
       !GUID.test(a.alias_member_id||"")||!seenMembers.has(a.canonical_member_id)||
       typeof a.enabled!=="boolean")invalid("INVALID_BACKUP_ALIAS");
  }
  const payload=backup.payload,lookups={};
  for(const name of MAPS){
    const rows=payload[name];
    if(!Array.isArray(rows)||rows.length>maxItems)invalid("INVALID_BACKUP_ENTRIES");
    const seen=new Set();const map=new Map();
    for(const entry of rows){
      if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=="string"||
        !isObj(entry[1])||seen.has(entry[0]))invalid("INVALID_BACKUP_ENTRIES");
      const rec=(name==="workouts"||name==="checkins")?entry[1].record:entry[1];
      if(!isObj(rec)||rec.orgId!==orgId)invalid("INVALID_BACKUP_TENANT");
      if(["assignments","workouts","checkins"].includes(name)&&
        (!seenMembers.has(rec.clientId)||!GUID.test(rec.clientId||"")))
          invalid("INVALID_BACKUP_CLIENT_REFERENCE");
      seen.add(entry[0]);map.set(entry[0],entry[1]);
    }
    lookups[name]=map;
  }
  if(!Array.isArray(payload.exerciseCatalog)||payload.exerciseCatalog.length>5000||
     payload.exerciseCatalog.some(x=>typeof x!=="string"||x.length>100))
    invalid("INVALID_BACKUP_CATALOG");
  const catalog=new Set(payload.exerciseCatalog);
  if(catalog.size!==payload.exerciseCatalog.length)invalid("INVALID_BACKUP_CATALOG");
  for(const p of lookups.programs.values()){
    if(!GUID.test(p.id||"")||!seenMembers.has(p.coachId)||
       !Array.isArray(p.exercises)||p.exercises.length<1||p.exercises.length>30||
       p.exercises.some(x=>!catalog.has(x.exerciseId)))invalid("INVALID_BACKUP_PROGRAM");
  }
  for(const p of lookups.programVersions.values()){
    if(!GUID.test(p.id||"")||!seenMembers.has(p.coachId)||
       !Array.isArray(p.exercises)||p.exercises.some(x=>!catalog.has(x.exerciseId)))
      invalid("INVALID_BACKUP_VERSION");
  }
  for(const a of lookups.assignments.values()){
    const program=lookups.programs.get(a.programId);
    const version=lookups.programVersions.get(a.programId+":"+a.programVersion);
    if(!program||!version||program.coachId!==a.coachId||!seenMembers.has(a.coachId))
      invalid("INVALID_BACKUP_ASSIGNMENT");
  }
  for(const item of lookups.workouts.values()){
    const r=item.record;
    const assignment=lookups.assignments.get(r.assignmentId);
    if(!assignment||assignment.clientId!==r.clientId||
      !Array.isArray(r.sets)||r.sets.length>250||
      r.sets.some(s=>!catalog.has(s.exerciseId)))invalid("INVALID_BACKUP_WORKOUT");
  }
  for(const item of lookups.checkins.values()){
    const r=item.record;
    const assignment=lookups.assignments.get(r.assignmentId);
    if(!assignment||assignment.clientId!==r.clientId)
      invalid("INVALID_BACKUP_CHECKIN");
  }
  return {revision:backup.revision,programs:lookups.programs.size,
    assignments:lookups.assignments.size,workouts:lookups.workouts.size,
    checkins:lookups.checkins.size,members:seenMembers.size};
}
