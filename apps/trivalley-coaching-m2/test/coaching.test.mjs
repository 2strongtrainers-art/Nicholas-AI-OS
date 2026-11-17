import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {CoachingService,InMemoryCoachingStore} from '../src/domain.mjs';
import {coachingHttpHandler} from '../src/http.mjs';

const actor = (sub,orgId,role) => ({sub,orgId,role});
const members = {
  coachA:actor('coach-a','org-a','coach'),
  coachB:actor('coach-b','org-a','coach'),
  coachForeign:actor('coach-x','org-x','coach'),
  clientA:actor('client-a','org-a','client'),
  clientB:actor('client-b','org-a','client'),
  foreign:actor('client-x','org-x','client')
};
const workout = (assignmentId,sessionId=randomUUID())=>({
  sessionId, assignmentId, performedAt:'2026-11-17T15:00:00.000Z',
  durationMinutes:42,
  sets:[{exerciseId:'bench',setIndex:1,reps:8,weight:70,unit:'lb',rir:2}]
});
const checkin = (assignmentId,checkinId=randomUUID())=>({
  checkinId,assignmentId,weekOf:'2026-11-16',
  completionRating:4,comment:'Completed the assigned sessions',requestReview:true
});
function fixture() {
  const store=new InMemoryCoachingStore();
  for(const v of Object.values(members)) store.seedMember({id:v.sub,orgId:v.orgId,role:v.role,displayName:'Synthetic '+v.sub});
  const svc=new CoachingService({store,now:()=> '2026-11-17T15:30:00.000Z'});
  const program=svc.createProgram(members.coachA,{
    title:'Synthetic upper strength',
    exercises:[{exerciseId:'bench',sets:3,reps:8,restSeconds:90,coachCue:'Controlled movement'}]
  });
  svc.publishProgram(members.coachA,program.id);
  const assignA=svc.assignProgram(members.coachA,{clientId:members.clientA.sub,programId:program.id});
  const assignB=svc.assignProgram(members.coachA,{clientId:members.clientB.sub,programId:program.id});
  return {svc,store,program,assignA,assignB};
}
function rejects(fn,code) {
  assert.throws(fn,(err)=> err?.code===code);
}
test('new programs start in draft and require a coach to publish',()=>{
  const {svc,program}=fixture();
  assert.equal(program.status,'draft');
  rejects(()=>svc.createProgram(members.clientA,{title:'Bad',exercises:[]}), 'COACH_ONLY');
  assert.equal(svc.activeAssignments(members.clientA)[0].program.status,'published');
});
test('one coach cannot manage another coaches programs in same organization',()=>{
  const {svc,program}=fixture();
  rejects(()=>svc.publishProgram(members.coachB,program.id),'NOT_FOUND');
  rejects(()=>svc.assignProgram(members.coachB,{clientId:'client-a',programId:program.id}),'NOT_FOUND');
});
test('foreign organization cannot reach program, assignment or client progress',()=>{
  const {svc,program,assignA}=fixture();
  rejects(()=>svc.publishProgram(members.coachForeign,program.id),'NOT_FOUND');
  rejects(()=>svc.assignProgram(members.coachForeign,{clientId:'client-x',programId:program.id}),'NOT_FOUND');
  rejects(()=>svc.logWorkout(members.foreign,workout(assignA.id)),'NOT_FOUND');
  rejects(()=>svc.clientProgress(members.coachForeign,'client-a'),'NOT_FOUND');
});
test('clients cannot view another clients assignments, checkins or progress',()=>{
  const {svc,assignB}=fixture();
  const own=svc.activeAssignments(members.clientA);
  assert.equal(own.length,1);
  assert.equal(own[0].assignment.clientId,'client-a');
  rejects(()=>svc.logWorkout(members.clientA,workout(assignB.id)),'NOT_FOUND');
  rejects(()=>svc.submitCheckin(members.clientA,checkin(assignB.id)),'NOT_FOUND');
  rejects(()=>svc.clientProgress(members.clientA,'client-b'),'NOT_FOUND');
});
test('clients cannot create, assign, revoke or publish coaching programs',()=>{
  const {svc,program,assignA}=fixture();
  rejects(()=>svc.createProgram(members.clientA,{title:'Owned?',exercises:[]}), 'COACH_ONLY');
  rejects(()=>svc.assignProgram(members.clientA,{programId:program.id,clientId:'client-b'}),'COACH_ONLY');
  rejects(()=>svc.revokeAssignment(members.clientA,assignA.id),'COACH_ONLY');
  rejects(()=>svc.publishProgram(members.clientA,program.id),'COACH_ONLY');
});
test('coach sees only clients assigned to that exact coach',()=>{
  const {svc}=fixture();
  assert.equal(svc.coachClients(members.coachA).length,2);
  assert.equal(svc.coachClients(members.coachB).length,0);
  rejects(()=>svc.clientProgress(members.coachB,'client-a'),'NOT_FOUND');
});
test('reassignment of same exact version is idempotent',()=>{
  const {svc,program,assignA}=fixture();
  const again=svc.assignProgram(members.coachA,{programId:program.id,clientId:'client-a'});
  assert.equal(again.id,assignA.id);
  assert.equal(again.reused,true);
});
test('client cannot write identity, role or unassigned exercise data',()=>{
  const {svc,assignA}=fixture();
  rejects(()=>svc.logWorkout(members.clientA,{...workout(assignA.id),clientId:'client-b'}),'UNEXPECTED_FIELD');
  rejects(()=>svc.logWorkout(members.clientA,{...workout(assignA.id),
    sets:[{exerciseId:'secret',setIndex:1,reps:8,weight:70,unit:'lb'}]}),'VALIDATION');
});
test('offline sessions synchronize idempotently, differing replay conflicts',()=>{
  const {svc,assignA}=fixture();
  const w=workout(assignA.id);
  const first=svc.logWorkout(members.clientA,w);
  assert.equal(first.reused,false);
  const second=svc.logWorkout(members.clientA,w);
  assert.equal(second.reused,true);
  assert.equal(second.record.id,first.record.id);
  rejects(()=>svc.logWorkout(members.clientA,{...w,durationMinutes:43}),'IDEMPOTENCY_CONFLICT');
  assert.equal(svc.clientProgress(members.clientA,'client-a').totalWorkouts,1);
  assert.equal(svc.clientProgress(members.clientA,'client-a').totalLoggedSets,1);
});
test('revoke a client assignment stops future uploads and coach visibility',()=>{
  const {svc,assignA}=fixture();
  const rev=svc.revokeAssignment(members.coachA,assignA.id);
  assert.equal(rev.status,'revoked');
  assert.equal(svc.activeAssignments(members.clientA).length,0);
  rejects(()=>svc.logWorkout(members.clientA,workout(assignA.id)),'NOT_FOUND');
  // A separate active assignment may still authorize the coach, but this client has none.
  rejects(()=>svc.clientProgress(members.coachA,'client-a'),'NOT_FOUND');
});
test('check-ins are private, idempotent, reviewable and audit stamped',()=>{
  const {svc,assignA}=fixture();
  const payload=checkin(assignA.id);
  const a=svc.submitCheckin(members.clientA,payload);
  const b=svc.submitCheckin(members.clientA,payload);
  assert.equal(b.reused,true);
  assert.equal(a.record.id,b.record.id);
  assert.equal(svc.coachCheckins(members.coachA,'client-a').length,1);
  rejects(()=>svc.coachCheckins(members.coachB,'client-a'),'NOT_FOUND');
  rejects(()=>svc.reviewCheckin(members.coachB,a.record.id,{reviewNote:'ok'}),'NOT_FOUND');
  const reviewed=svc.reviewCheckin(members.coachA,a.record.id,{reviewNote:'Discuss form on next check-in'});
  assert.equal(reviewed.record.reviewStatus,'reviewed');
  assert.equal(reviewed.record.reviewedAt,'2026-11-17T15:30:00.000Z');
  assert.equal(svc.clientProgress(members.clientA,'client-a').checkinsAwaitingReview,0);
  assert.equal(svc.reviewCheckin(members.coachA,a.record.id,{reviewNote:'Discuss form on next check-in'}).reused,true);
  rejects(()=>svc.reviewCheckin(members.coachA,a.record.id,{reviewNote:'Changed after review'}),'REVIEW_CONFLICT');
});
test('exports contain own client data only and no other names',()=>{
  const {svc,assignA,assignB}=fixture();
  svc.logWorkout(members.clientA,workout(assignA.id));
  svc.submitCheckin(members.clientA,checkin(assignA.id));
  svc.logWorkout(members.clientB,workout(assignB.id));
  const result=svc.clientExport(members.clientA);
  assert.equal(result.workouts.length,1);
  assert.equal(result.checkins.length,1);
  assert.equal(result.assignments.length,1);
  assert.equal(result.ownerId,'client-a');
  assert.equal(JSON.stringify(result).includes('client-b'),false);
});
test('input validation rejects malformed IDs and bad set bounds',()=>{
  const {svc,assignA}=fixture();
  rejects(()=>svc.logWorkout(members.clientA,{...workout(assignA.id),sessionId:'not-uuid'}),'VALIDATION');
  rejects(()=>svc.logWorkout(members.clientA,{...workout(assignA.id),durationMinutes:10000}),'VALIDATION');
  rejects(()=>svc.logWorkout(members.clientA,{...workout(assignA.id),
    sets:[{exerciseId:'bench',setIndex:1,reps:8,weight:-3,unit:'lb'}]}),'VALIDATION');
  rejects(()=>svc.submitCheckin(members.clientA,{...checkin(assignA.id),comment:'x'.repeat(600)}),'VALIDATION');
});
test('published program and assignment versions remain referenced in completed logs',()=>{
  const {svc,program,assignA}=fixture();
  const a=svc.logWorkout(members.clientA,workout(assignA.id));
  assert.equal(a.record.programId,program.id);
  assert.equal(a.record.programVersion,1);
});
test('non-member or forged organization fails closed',()=>{
  const {svc}=fixture();
  rejects(()=>svc.publicMember({sub:'guest',orgId:'org-a',role:'client'}),'NOT_FOUND');
  rejects(()=>svc.publicMember({sub:'client-a',orgId:'org-x',role:'client'}),'MEMBERSHIP_MISMATCH');
  rejects(()=>svc.publicMember({sub:'client-a',orgId:'org-a',role:'coach'}),'MEMBERSHIP_MISMATCH');
});
test('HTTP adapter requires a verifier, denies missing/invalid bearer and forged headers',async t=>{
  const {svc}=fixture();
  assert.throws(()=>coachingHttpHandler({service:svc}),/Trusted identity verifier/);
  const auth=new Map([
    ['synthetic-coach-token',members.coachA],
    ['synthetic-client-a-token',members.clientA],
    ['synthetic-client-b-token',members.clientB],
    ['synthetic-client-x-token',members.foreign],
  ]);
  const server=createServer(coachingHttpHandler({
    service:svc,
    verifyIdentity:async token=>auth.get(token)||null,
    allowedOrigins:['https://training.example.invalid']
  }));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  async function call(path, token, options={}){
    const headers={
      ...(token?{authorization:'Bearer '+token}:{}),
      ...(options.body?{'content-type':'application/json'}:{}),
      ...(options.headers||{})
    };
    const response=await fetch(base+path,{method:options.method||'GET',headers,
      body:options.body?JSON.stringify(options.body):undefined});
    return {status:response.status,headers:response.headers,data:await response.json()};
  }
  let r=await call('/v1/me');
  assert.equal(r.status,401);
  r=await call('/v1/me','invalid-synthetic-token',{headers:{'x-user-id':'coach-a','x-role':'coach'}});
  assert.equal(r.status,401);
  r=await call('/v1/me','synthetic-client-a-token');
  assert.equal(r.status,200);
  assert.equal(r.data.member.role,'client');
  assert.equal(r.headers.get('cache-control'),'no-store');
  r=await call('/v1/me','synthetic-client-a-token',{headers:{origin:'https://evil.invalid'}});
  assert.equal(r.status,403);
  r=await call('/v1/me','synthetic-client-a-token',{headers:{origin:'https://training.example.invalid'}});
  assert.equal(r.status,200);
  assert.equal(r.headers.get('access-control-allow-origin'),'https://training.example.invalid');
  r=await call('/v1/coach/clients','synthetic-client-a-token');
  assert.equal(r.status,403);
  r=await call('/v1/coach/clients/client-b/progress','synthetic-coach-token');
  assert.equal(r.status,200);
  r=await call('/v1/coach/clients/client-a/progress','synthetic-client-b-token');
  assert.equal(r.status,403);
  r=await call('/v1/me/export','synthetic-client-a-token');
  assert.equal(r.status,200);
  assert.equal(r.data.data.ownerId,'client-a');
  const session=workout(svc.activeAssignments(members.clientA)[0].assignment.id);
  r=await call('/v1/me/workouts','synthetic-client-a-token',{method:'POST',body:session});
  assert.equal(r.status,201);
  const id=r.data.record.id;
  r=await call('/v1/me/workouts','synthetic-client-a-token',{method:'POST',body:session});
  assert.equal(r.data.record.id,id);
  assert.equal(r.data.reused,true);
  r=await call('/v1/me/workouts','synthetic-client-b-token',{method:'POST',body:session});
  assert.equal(r.status,404);
});
