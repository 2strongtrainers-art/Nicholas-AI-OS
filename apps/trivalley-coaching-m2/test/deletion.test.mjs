import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {CoachingService,InMemoryCoachingStore} from "../src/domain.mjs";
import {eraseClientState} from "../src/deletion.mjs";
test("owner deletes exactly one client's private history and retains other client",()=>{
 const orgId="org-a",store=new InMemoryCoachingStore();
 const coach={sub:"coach-a",orgId,role:"coach"};
 const a={sub:"client-a",orgId,role:"client"},b={sub:"client-b",orgId,role:"client"};
 store.seedExercise("0289");
 for(const member of [coach,a,b])store.seedMember({id:member.sub,orgId,role:member.role});
 const svc=new CoachingService({store,now:()=> "2026-11-20T20:00:00.000Z"});
 const p=svc.createProgram(coach,{title:"Private test",exercises:[{exerciseId:"0289",sets:2,reps:8,restSeconds:90}]});
 svc.publishProgram(coach,p.id);
 const as=svc.assignProgram(coach,{clientId:a.sub,programId:p.id});
 const bs=svc.assignProgram(coach,{clientId:b.sub,programId:p.id});
 for(const [person,assignmentId] of [[a,as.id],[b,bs.id]]){
   svc.logWorkout(person,{sessionId:randomUUID(),assignmentId,performedAt:"2026-11-20T20:00:00.000Z",durationMinutes:20,sets:[{exerciseId:"0289",setIndex:1,reps:8,weight:60,unit:"lb"}]});
 }
 const req=svc.requestDataDeletion(a,{requestId:randomUUID(),confirmation:"REQUEST_MY_DATA_DELETION"});
 assert.throws(()=>eraseClientState(store,a,req.record.requestId),/OWNER_REVIEW_REQUIRED/);
 const result=eraseClientState(store,coach,req.record.requestId);
 assert.equal(result.workouts,1);assert.equal(result.assignments,1);
 assert.equal([...store.workouts.values()][0].record.clientId,b.sub);
 assert.equal([...store.assignments.values()][0].clientId,b.sub);
 assert.equal(result.receipt.clientId,"REDACTED");
 assert.throws(()=>eraseClientState(store,coach,req.record.requestId),/NO_PENDING_DELETION/);
});
