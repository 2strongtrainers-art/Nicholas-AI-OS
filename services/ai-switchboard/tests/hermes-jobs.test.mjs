import test from 'node:test';
import assert from 'node:assert/strict';
import { routeHermesJobs } from '../src/hermes-jobs.ts';
function setup() {
  const values = new Map();
  const env = { SWITCHBOARD_API_KEY: 'test-user', HERMES_WORKER_KEY: 'test-worker', HERMES_JOBS: {
    get: async k => values.has(k) ? JSON.parse(values.get(k)) : null,
    put: async (k,v) => values.set(k,v),
    list: async () => ({ keys: Array.from(values.keys(), name => ({ name })) })
  }};
  const post = (path, body, auth='test-user') => routeHermesJobs(new Request('https://test.example'+path, {
    method:'POST', headers: { authorization:`Bearer ${auth}`, 'content-type':'application/json' }, body: JSON.stringify(body)
  }), env);
  return { values, post };
}
test('unsupported profile and non-object input do not queue work', async () => {
  const {post,values} = setup();
  for(const body of [null, [], {task:'repair',profile:'maintenance'}, {task:'research',profile:'typo'}]) {
    assert.equal((await post('/hermes/jobs',body)).status,400);
  }
  assert.equal(values.size,0);
});
test('previously queued maintenance is failed and never offered to a runner', async () => {
  const {post,values} = setup();
  values.set('hermes:job:legacy',JSON.stringify({ id:'legacy',status:'queued',profile:'maintenance',task:'repair',created_at:new Date().toISOString() }));
  const result = await (await post('/hermes/internal/claim',{},'test-worker')).json();
  assert.equal(result.job,null);
  assert.equal(JSON.parse(values.get('hermes:job:legacy')).status,'failed');
});
test('read-only create, claim, progress, complete and read lifecycle', async () => {
  const {post,values} = setup();
  const created = await post('/hermes/jobs',{ task:'public research' }); assert.equal(created.status,202);
  const {job} = await created.json();
  assert.equal((await post('/hermes/internal/claim',{},'wrong')).status,401);
  const claimed = await (await post('/hermes/internal/claim',{},'test-worker')).json(); assert.equal(claimed.job.id,job.id);
  assert.equal((await post('/hermes/internal/jobs/'+job.id,{log:['started']},'test-worker')).status,200);
  const completed = await post('/hermes/internal/jobs/'+job.id,{status:'completed',result:'done',profile:'maintenance'},'test-worker');
  assert.equal(completed.status,200);
  const final = JSON.parse(values.get('hermes:job:'+job.id));
  assert.equal(final.profile,'research_readonly'); assert.equal(final.result,'done'); assert.deepEqual(final.log,['started']);
});
