import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {SyntheticSQLiteCoachingRepository} from '../src/sqlite-staging.mjs';
import {makeWixSiteUrlBinding} from '../src/wix-site-binding.mjs';
import {makeWixMemberVerifier} from '../src/wix-verify.mjs';
import {coachingHttpHandler} from '../src/http.mjs';
import {createOfflineWorkoutQueue} from '../src/offline-queue.mjs';

const siteId='9e6343d9-5a1c-45e2-8596-f73408e38402';
const organization='trivalley-synthetic-test-org';
const people={
  coach:{id:'11111111-1111-4111-8111-111111111111',role:'coach',token:'synthetic-wix-coach-token'},
  a:{id:'22222222-2222-4222-8222-222222222222',role:'client',token:'synthetic-wix-client-a-token'},
  b:{id:'33333333-3333-4333-8333-333333333333',role:'client',token:'synthetic-wix-client-b-token'},
  foreign:{id:'44444444-4444-4444-8444-444444444444',role:'client',token:'synthetic-wix-foreign-site-token'}
};
test('End-to-end: Wix-simulated site/member proof → SQLite → HTTP → offline replay → coach review → database restart', async t=>{
  const directory=mkdtempSync(join(tmpdir(),'trivalley-m2-e2e-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const file=join(directory,'sample.sqlite');
  const db=new SyntheticSQLiteCoachingRepository(file);
  const members=new Map();
  for(const [key,p] of Object.entries(people))members.set(p.token,{...p,site:key==='foreign'?'https://foreign.invalid':'https://www.trivalley.fit'});
  db.transaction((_svc,store)=>{
    store.seedExercise('bench');
    store.seedExercise('row');
    for(const [key,p] of Object.entries(people)){
      store.seedMember({id:p.id,orgId:key==='foreign'?'org-other':organization,role:p.role,displayName:'Sample '+key});
    }
  });
  let providerCalls=0;
  const wixFetch=async (url,opts)=>{
    providerCalls++;
    const presented=members.get(opts.headers.Authorization);
    if(!presented)return {ok:false,text:async()=>JSON.stringify({error:'not authorized'})};
    if(url.endsWith('/ricos/v1/site-context/site-url'))return {
      ok:true,text:async()=>JSON.stringify({baseUrl:presented.site,published:true})
    };
    if(url.endsWith('/members/v1/members/my?fieldsets=EXTENDED'))return {
      ok:true,text:async()=>JSON.stringify({member:{id:presented.id,status:'APPROVED'}})
    };
    throw Error('Unexpected mocked Wix API');
  };
  const siteBinder=makeWixSiteUrlBinding({expectedSiteId:siteId,fetchImpl:wixFetch});
  const verify=makeWixMemberVerifier({
    siteId,verifyTokenSite:siteBinder,fetchImpl:wixFetch,
    lookupProvisionedMember:async ({siteId:found,memberId})=>{
      if(found!==siteId)return null;
      return db.transaction((_svc,store)=>{
        const m=store.members.get(memberId);
        return m?.orgId===organization?{siteId:found,memberId,orgId:m.orgId,role:m.role,status:m.status}:null;
      });
    }
  });
  const server=createServer(coachingHttpHandler({
    service:db.serviceProxy(),verifyIdentity:verify,
    allowedOrigins:['https://training.trivalley.invalid']
  }));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  let closed=false;
  t.after(async()=>{
    if(!closed){await new Promise(resolve=>server.close(resolve));db.close()}
  });
  async function request(path,who,body) {
    const response=await fetch(url+path,{
      method:body?'POST':'GET',
      headers:{Authorization:'Bearer '+who, ...(body?{'Content-Type':'application/json'}:{})},
      body:body?JSON.stringify(body):undefined
    });
    return {status:response.status,data:await response.json()};
  }
  assert.equal((await request('/v1/me',people.foreign.token)).status,401);
  assert.equal((await request('/v1/me','invalid-synthetic-token')).status,401);
  const own=await request('/v1/me',people.a.token);
  assert.equal(own.status,200);
  assert.equal(own.data.member.id,people.a.id);
  const created=await request('/v1/coach/programs',people.coach.token,{
    title:'Synthetic durable strength',
    exercises:[{exerciseId:'bench',sets:3,reps:8,restSeconds:90},
      {exerciseId:'row',sets:3,reps:10,restSeconds:75}]
  });
  assert.equal(created.status,201);
  const programId=created.data.program.id;
  assert.equal((await request('/v1/coach/programs/'+programId+'/publish',people.coach.token,{})).status,200);
  const assigned=await request('/v1/coach/assignments',people.coach.token,{programId,clientId:people.a.id});
  assert.equal(assigned.status,201);
  assert.equal((await request('/v1/me/assignments',people.b.token)).data.items.length,0);
  assert.equal((await request('/v1/coach/clients',people.a.token)).status,403);
  assert.equal((await request('/v1/coach/clients/'+people.a.id+'/progress',people.b.token)).status,404);
  let offline=true;let saved=[];
  const queue=createOfflineWorkoutQueue({
    read:async()=>structuredClone(saved),
    write:async x=>{saved=structuredClone(x)},
    send:async payload=>{
      if(offline)throw Error('Offline simulation');
      const r=await request('/v1/me/workouts',people.a.token,payload);
      return {status:r.status,data:r.data};
    }
  });
  const payload={sessionId:randomUUID(),assignmentId:assigned.data.assignment.id,
    performedAt:'2026-11-17T18:00:00.000Z',durationMinutes:35,
    sets:[{exerciseId:'bench',setIndex:1,reps:8,weight:65,unit:'lb',rir:2},
      {exerciseId:'row',setIndex:1,reps:10,weight:35,unit:'lb',rir:2}]};
  await queue.enqueue(payload);
  assert.equal((await queue.flush()).acknowledged,0);
  assert.equal(saved.length,1);
  assert.equal((await request('/v1/coach/clients/'+people.a.id+'/progress',people.coach.token)).data.progress.totalWorkouts,0);
  offline=false;
  const synced=await queue.flush();
  assert.equal(synced.acknowledged,1);
  assert.equal(synced.remaining,0);
  assert.equal((await request('/v1/coach/clients/'+people.a.id+'/progress',people.coach.token)).data.progress.totalLoggedSets,2);
  const replay=await request('/v1/me/workouts',people.a.token,payload);
  assert.equal(replay.data.reused,true);
  const feedback=await request('/v1/me/checkins',people.a.token,{
    checkinId:randomUUID(),assignmentId:assigned.data.assignment.id,
    weekOf:'2026-11-16',completionRating:4,comment:'Synthetic test feedback',requestReview:true
  });
  assert.equal(feedback.status,201);
  const reviewed=await request('/v1/coach/checkins/'+feedback.data.record.id+'/review',
    people.coach.token,{reviewNote:'Reviewed synthetic demonstration'});
  assert.equal(reviewed.status,200);
  assert.equal(reviewed.data.record.reviewStatus,'reviewed');
  const exported=await request('/v1/me/export',people.a.token);
  assert.equal(exported.data.data.workouts.length,1);
  assert.equal(JSON.stringify(exported.data.data).includes(people.b.id),false);
  assert.equal(providerCalls>10,true);
  await new Promise(resolve=>server.close(resolve));
  db.close();closed=true;
  const after=new SyntheticSQLiteCoachingRepository(file);
  assert.equal(after.serviceProxy().clientProgress({sub:people.a.id,orgId:organization,role:'client'},people.a.id).totalWorkouts,1);
  assert.equal(after.serviceProxy().clientProgress({sub:people.coach.id,orgId:organization,role:'coach'},people.a.id).checkinsAwaitingReview,0);
  after.close();
});
