import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {SyntheticSQLiteCoachingRepository} from '../src/sqlite-staging.mjs';
import {coachingHttpHandler} from '../src/http.mjs';

const time='2026-11-17T18:00:00.000Z';
const coach={sub:'coaching-test-coach',orgId:'sample-organization',role:'coach'};
const clientA={sub:'coaching-test-client-a',orgId:'sample-organization',role:'client'};
const clientB={sub:'coaching-test-client-b',orgId:'sample-organization',role:'client'};
const other={sub:'coaching-test-foreign',orgId:'other-organization',role:'client'};
const workout=(assignmentId,sessionId=randomUUID())=>({
  sessionId,assignmentId,performedAt:'2026-11-17T17:00:00.000Z',
  durationMinutes:32,sets:[{exerciseId:'bench',setIndex:1,reps:8,weight:60,unit:'lb',rir:2}]
});
function fixture(t) {
  const directory=mkdtempSync(join(tmpdir(),'trivalley-m2-test-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  return {directory,path:join(directory,'synthetic.sqlite')};
}
function setup(path) {
  const repo=new SyntheticSQLiteCoachingRepository(path,{now:()=>time});
  const data=repo.transaction((svc,store)=>{
    for(const [id,orgId,role] of [
      [coach.sub,coach.orgId,'coach'],[clientA.sub,clientA.orgId,'client'],
      [clientB.sub,clientB.orgId,'client'],[other.sub,other.orgId,'client']
    ])store.seedMember({id,orgId,role,displayName:'Synthetic '+id});
    store.seedExercise('bench');
    const program=svc.createProgram(coach,{title:'Persisted sample training',
      exercises:[{exerciseId:'bench',sets:3,reps:8,restSeconds:90}]});
    svc.publishProgram(coach,program.id);
    const assignmentA=svc.assignProgram(coach,{programId:program.id,clientId:clientA.sub});
    const assignmentB=svc.assignProgram(coach,{programId:program.id,clientId:clientB.sub});
    return {program,assignmentA,assignmentB};
  });
  return {repo,...data};
}
function isCode(fn,code){assert.throws(fn,e=>e?.code===code)}

test('SQLite survives process-style close and reopen with assigned immutable plan',t=>{
  const {path}=fixture(t);
  const {repo,assignmentA}=setup(path);
  const w=workout(assignmentA.id);
  const first=repo.serviceProxy().logWorkout(clientA,w);
  assert.equal(first.reused,false);
  const revision=repo.inspect().revision;
  assert.ok(revision>0);
  repo.close();
  const again=new SyntheticSQLiteCoachingRepository(path,{now:()=>time});
  t.after(()=>again.close());
  assert.ok(again.inspect().revision>=revision);
  assert.equal(again.serviceProxy().clientProgress(clientA,clientA.sub).totalWorkouts,1);
  const repeat=again.serviceProxy().logWorkout(clientA,w);
  assert.equal(repeat.reused,true);
  assert.equal(repeat.record.id,first.record.id);
  isCode(()=>again.serviceProxy().logWorkout(clientA,{...w,durationMinutes:33}),'IDEMPOTENCY_CONFLICT');
  assert.equal(again.serviceProxy().clientProgress(clientA,clientA.sub).totalWorkouts,1);
});
test('SQLite transaction rollback leaves no partial assignment or audit event',t=>{
  const {path}=fixture(t);
  const {repo}=setup(path);
  t.after(()=>repo.close());
  const before=repo.inspect().revision;
  assert.throws(()=>repo.transaction((svc,store)=>{
    store.seedExercise('invented');
    svc.createProgram(coach,{title:'Rolled back',exercises:[
      {exerciseId:'invented',sets:2,reps:10,restSeconds:90}
    ]});
    throw new Error('Simulated crash after updating state');
  }),/Simulated crash/);
  assert.equal(repo.inspect().revision,before);
  const catalog=repo.transaction((svc,store)=>[...store.exerciseCatalog]);
  assert.equal(catalog.includes('invented'),false);
});
test('Two SQLite handles observe each others committed training events',t=>{
  const {path}=fixture(t);
  const {repo,assignmentA}=setup(path);
  const peer=new SyntheticSQLiteCoachingRepository(path,{now:()=>time});
  t.after(()=>{peer.close();repo.close()});
  repo.serviceProxy().logWorkout(clientA,workout(assignmentA.id));
  assert.equal(peer.serviceProxy().clientProgress(coach,clientA.sub).totalWorkouts,1);
});
test('Hash mismatch blocks all reads rather than returning tampered records',t=>{
  const {path}=fixture(t);
  const {repo}=setup(path);
  repo.close();
  const editor=new DatabaseSync(path);
  editor.exec("UPDATE staging_state SET payload='{}' WHERE id='synthetic-test-only'");
  editor.close();
  const reader=new SyntheticSQLiteCoachingRepository(path);
  t.after(()=>reader.close());
  assert.throws(()=>reader.inspect(),/checksum mismatch/);
  assert.throws(()=>reader.serviceProxy().clientExport(clientA),/checksum mismatch/);
});
test('Production execution cannot construct synthetic SQLite database',t=>{
  const {path}=fixture(t);
  const prior=process.env.NODE_ENV;
  process.env.NODE_ENV='production';
  try{assert.throws(()=>new SyntheticSQLiteCoachingRepository(path),/disabled outside synthetic test mode/)}
  finally{process.env.NODE_ENV=prior}
});
test('Actual HTTP flow with committed SQLite and injected verified fake tokens',async t=>{
  const {path}=fixture(t);
  const {repo,assignmentA,assignmentB}=setup(path);
  const tokens=new Map([
    ['synthetic-coach-bearer',coach],['synthetic-client-a-bearer',clientA],
    ['synthetic-client-b-bearer',clientB],['synthetic-other-bearer',other]
  ]);
  const handler=coachingHttpHandler({
    service:repo.serviceProxy(),
    verifyIdentity:async token=>tokens.get(token)||null,
    allowedOrigins:['https://demo.trivalley.invalid']
  });
  const server=createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve))});
  async function request(path,token,body){
    const res=await fetch(url+path,{method:body?'POST':'GET',
      headers:{...(token?{Authorization:'Bearer '+token}:{}),
        ...(body?{'Content-Type':'application/json'}:{})},
      body:body?JSON.stringify(body):undefined});
    return {status:res.status,body:await res.json()};
  }
  const me=await request('/v1/me','synthetic-client-a-bearer');
  assert.equal(me.status,200);
  assert.equal(me.body.member.id,clientA.sub);
  assert.equal((await request('/v1/me')).status,401);
  assert.equal((await request('/v1/coach/clients','synthetic-client-a-bearer')).status,403);
  const otherAssignment=workout(assignmentB.id);
  assert.equal((await request('/v1/me/workouts','synthetic-client-a-bearer',otherAssignment)).status,404);
  assert.equal((await request('/v1/me/workouts','synthetic-other-bearer',workout(assignmentA.id))).status,404);
  const work=workout(assignmentA.id);
  const r1=await request('/v1/me/workouts','synthetic-client-a-bearer',work);
  const r2=await request('/v1/me/workouts','synthetic-client-a-bearer',work);
  assert.equal(r1.status,201);
  assert.equal(r2.body.reused,true);
  assert.equal(r1.body.record.id,r2.body.record.id);
  const checkin={checkinId:randomUUID(),assignmentId:assignmentA.id,weekOf:'2026-11-16',
    completionRating:4,comment:'Synthetic sample only',requestReview:true};
  assert.equal((await request('/v1/me/checkins','synthetic-client-a-bearer',checkin)).status,201);
  assert.equal((await request('/v1/me/progress','synthetic-client-a-bearer')).body.progress.totalWorkouts,1);
  const coachProgress=await request('/v1/coach/clients/'+clientA.sub+'/progress','synthetic-coach-bearer');
  assert.equal(coachProgress.body.progress.totalLoggedSets,1);
  const denied=await request('/v1/coach/clients/'+clientB.sub+'/progress','synthetic-other-bearer');
  assert.equal(denied.status,404); // Privacy-preserving non-enumeration of foreign clients.
  const exportA=await request('/v1/me/export','synthetic-client-a-bearer');
  assert.equal(exportA.body.data.workouts.length,1);
  assert.equal(exportA.body.data.checkins.length,1);
  assert.equal(JSON.stringify(exportA.body.data).includes('coaching-test-client-b'),false);
  const previousRevision=repo.inspect().revision;
  assert.ok(previousRevision>=5, 'Committed HTTP operations must advance persistent revision');
  repo.close();
  // HTTP fixture re-opens a fresh SQLite handle to verify committed state persists.
  const recovered=new SyntheticSQLiteCoachingRepository(path,{now:()=>time});
  assert.equal(recovered.serviceProxy().clientProgress(clientA,clientA.sub).totalWorkouts,1);
  recovered.close();
});
