import test from "node:test";
import assert from "node:assert/strict";
import {validateCoachingBackup} from "../src/backup-restore.mjs";
const org="43a0b1d1-3ef3-4083-8fe8-826b0d5452f4",site="9e6343d9-5a1c-45e2-8596-f73408e38402";
const coach="4d122d05-0633-461b-ab06-4c642199e75a";
function fixture(){
  const p="6e45f1a3-6ad5-4cab-bb26-ebff4e4b0466";
  const program={id:p,orgId:org,coachId:coach,title:"Test",exercises:[{exerciseId:"0289",sets:3,reps:8,restSeconds:90}],version:1,status:"published"};
  return {format:"trivalley-coaching-private-backup-v1",siteId:site,orgId:org,revision:1,
    memberships:[{wix_site_id:site,org_id:org,wix_member_id:coach,role:"coach",status:"active",display_name:"Coach"}],
    ownerAliases:[],audit:[],payload:{programs:[[p,program]],programVersions:[[p+":1",program]],
      assignments:[],workouts:[],checkins:[],deletionRequests:[],exerciseCatalog:["0289"]}};
}
test("valid privately exported snapshot validates without modifying it",()=>{
  const b=fixture();
  const summary=validateCoachingBackup(b,{siteId:site,orgId:org});
  assert.equal(summary.programs,1);assert.equal(summary.revision,1);
  assert.equal(b.payload.programs.length,1);
});
test("backup from a foreign organization, site or with cross-tenant record is denied",()=>{
  const b=fixture();
  assert.throws(()=>validateCoachingBackup(b,{siteId:site,orgId:"other"}),/INVALID_BACKUP_FORMAT/);
  assert.throws(()=>validateCoachingBackup(b,{siteId:"another",orgId:org}),/INVALID_BACKUP_FORMAT/);
  b.payload.programs[0][1].orgId="foreign";
  assert.throws(()=>validateCoachingBackup(b,{siteId:site,orgId:org}),/INVALID_BACKUP_TENANT/);
});
test("invalid catalog, missing related version and duplicate IDs are denied",()=>{
  let b=fixture();b.payload.programs[0][1].exercises[0].exerciseId="not-pinned";
  assert.throws(()=>validateCoachingBackup(b,{siteId:site,orgId:org}),/INVALID_BACKUP_PROGRAM/);
  b=fixture();b.payload.programs.push(b.payload.programs[0]);
  assert.throws(()=>validateCoachingBackup(b,{siteId:site,orgId:org}),/INVALID_BACKUP_ENTRIES/);
  b=fixture();b.payload.exerciseCatalog=["0289","0289"];
  assert.throws(()=>validateCoachingBackup(b,{siteId:site,orgId:org}),/INVALID_BACKUP_CATALOG/);
});
