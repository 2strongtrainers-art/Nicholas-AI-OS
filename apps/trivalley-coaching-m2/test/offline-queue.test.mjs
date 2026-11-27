import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createOfflineWorkoutQueue} from '../src/offline-queue.mjs';
import {CoachingService,InMemoryCoachingStore} from '../src/domain.mjs';
const body = (assignmentId,sessionId=randomUUID())=>({
  sessionId,assignmentId,performedAt:'2026-11-17T15:00:00.000Z',durationMinutes:42,
  sets:[{exerciseId:'bench',setIndex:1,reps:8,weight:70,unit:'lb',rir:2}]
});
function fixture() {
  const store=new InMemoryCoachingStore();
  store.seedExercise('bench');
  const coach={sub:'coach-a',orgId:'org-a',role:'coach'};
  const client={sub:'client-a',orgId:'org-a',role:'client'};
  store.seedMember({...{id:coach.sub},orgId:coach.orgId,role:coach.role});
  store.seedMember({...{id:client.sub},orgId:client.orgId,role:client.role});
  const svc=new CoachingService({store,now:()=> '2026-11-17T15:30:00.000Z'});
  const program=svc.createProgram(coach,{title:'Synthetic training',exercises:[
    {exerciseId:'bench',sets:3,reps:8,restSeconds:90}
  ]});
  svc.publishProgram(coach,program.id);
  const assignment=svc.assignProgram(coach,{clientId:client.sub,programId:program.id});
  return {svc,coach,client,assignment};
}
function queue(sender) {
  let saved=[];
  const storage={
    read:async()=>structuredClone(saved),
    write:async next=>{saved=structuredClone(next)}
  };
  return {sync:createOfflineWorkoutQueue({...storage,send:sender}),stored:()=>structuredClone(saved)};
}
test('offline session queues without sending and later synchronizes exactly once',async()=>{
  const {svc,client,coach,assignment}=fixture();
  let online=false,networkCalls=0;
  const {sync,stored}=queue(async payload=>{
    networkCalls++;
    if(!online)throw new Error('Offline');
    const result=svc.logWorkout(client,payload);
    return {status:201,data:result};
  });
  const payload=body(assignment.id);
  assert.equal((await sync.enqueue(payload)).reused,false);
  assert.equal((await sync.enqueue(payload)).reused,true);
  assert.equal(await sync.size(),1);
  assert.equal(networkCalls,0);
  const disconnected=await sync.flush();
  assert.equal(disconnected.acknowledged,0);
  assert.equal(disconnected.transient,1);
  assert.equal(stored()[0].status,'pending');
  online=true;
  const connected=await sync.flush();
  assert.equal(connected.acknowledged,1);
  assert.equal(connected.remaining,0);
  assert.equal(svc.clientProgress(coach,client.sub).totalWorkouts,1);
  assert.equal(svc.clientProgress(client,client.sub).totalLoggedSets,1);
  assert.equal((await sync.flush()).acknowledged,0);
});
test('mismatched local session IDs cannot silently overwrite queued performance',async()=>{
  const {assignment}=fixture();
  const {sync}=queue(async()=>({status:201}));
  const payload=body(assignment.id);
  await sync.enqueue(payload);
  await assert.rejects(sync.enqueue({...payload,durationMinutes:120}),/Local session ID conflict/);
});
test('no client identity, role or bearer tokens are stored in offline event queue',async()=>{
  const {assignment}=fixture();
  const {sync,stored}=queue(async()=>({status:503}));
  const payload=body(assignment.id);
  await assert.rejects(sync.enqueue({...payload,accessToken:'never-store-secret'}),/must not be queued/);
  await assert.rejects(sync.enqueue({...payload,clientId:'another-client'}),/must not be queued/);
  await sync.enqueue(payload);
  assert.equal(stored().length,1);
  assert.equal(JSON.stringify(stored()).includes('accessToken'),false);
  assert.equal(JSON.stringify(stored()).includes('clientId'),false);
});
test('409 conflict stays reviewable rather than deleting the conflicting local record',async()=>{
  const {assignment}=fixture();
  const {sync,stored}=queue(async()=>({status:409}));
  const payload=body(assignment.id);
  await sync.enqueue(payload);
  const report=await sync.flush();
  assert.equal(report.conflicts,1);
  assert.equal(report.remaining,1);
  assert.equal(stored()[0].status,'conflict');
  assert.equal((await sync.flush()).conflicts,0);
});
test('revoked assignment responses remain locally recoverable and stop automatic replay',async()=>{
  const {assignment}=fixture();
  const {sync,stored}=queue(async()=>({status:404}));
  await sync.enqueue(body(assignment.id));
  const outcome=await sync.flush();
  assert.equal(outcome.blocked,1);
  assert.equal(stored()[0].status,'needs_review');
  assert.equal(stored()[0].reason,'AUTH_OR_ASSIGNMENT_CHANGED');
});
test('the server must echo the exact session ID before local success is acknowledged',async()=>{
  const {assignment}=fixture();
  const {sync,stored}=queue(async()=>({status:201,data:{record:{sessionId:randomUUID()}}}));
  await sync.enqueue(body(assignment.id));
  const report=await sync.flush();
  assert.equal(report.acknowledged,0);
  assert.equal(report.transient,1);
  assert.equal(stored().length,1);
});
test('a failed or absent storage and network interface fails closed',async()=>{
  assert.throws(()=>createOfflineWorkoutQueue({read:null,write:null,send:null}),/requires storage/);
  const broken=createOfflineWorkoutQueue({read:async()=>({}),write:async()=>{},send:async()=>{}});
  await assert.rejects(broken.size(),/storage corruption/);
});
