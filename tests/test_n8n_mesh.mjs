import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const load = f => JSON.parse(readFileSync(new URL('../workflows/n8n/'+f,import.meta.url),'utf8'));
const runs=load('mesh-run-triage.json'),errors=load('mesh-error-receiver.json');
function execute(flow,node,payload){
  const code=flow.nodes.find(n=>n.name===node)?.parameters?.jsCode;
  assert.ok(code);
  const out=vm.runInNewContext('(function(){'+code+'\n})()',{$input:{first:()=>({json:payload})}},{timeout:1200});
  return JSON.parse(JSON.stringify(out));
}
const record=(more={})=>({
  id:42,run_attempt:1,head_branch:'main',event:'workflow_dispatch',status:'completed',conclusion:'success',
  path:'.github/workflows/market-desk-research.yml',repository:{full_name:'2strongtrainers-art/Nicholas-AI-OS'},
  updated_at:'2026-11-16T18:00:00Z',...more
});
test('both workflow exports are deliberately inactive and have no sender or runtime executor',()=>{
 for (const w of [runs,errors]){
  assert.equal(w.active,false);
  assert.ok(w.nodes.length>=2);
  assert.ok(w.nodes.every(n=>!['n8n-nodes-base.scheduleTrigger','n8n-nodes-base.webhook','n8n-nodes-base.executeCommand','n8n-nodes-base.emailSend'].includes(n.type)));
 }
 assert.equal(runs.nodes[0].type,'n8n-nodes-base.manualTrigger');
 assert.equal(errors.nodes[0].type,'n8n-nodes-base.errorTrigger');
});
test('green workflow is never called verified',()=>{
 const [x]=execute(runs,'Classify without promotion',{workflow_runs:[record()]});
 assert.equal(x.json.status,'UNVERIFIED');
 assert.equal(x.json.reason_code,'ARTIFACT_QA_REQUIRED');
});
test('skip, failure, pending remain separate',()=>{
 const x=execute(runs,'Classify without promotion',{workflow_runs:[
  record({id:3,conclusion:'skipped'}),record({id:2,conclusion:'failure'}),record({id:1,status:'in_progress',conclusion:null})
 ]});
 assert.deepEqual(x.map(z=>z.json.status),['SKIPPED','FAILED','PENDING']);
});
test('attempt identities unique and duplicates collapse',()=>{
 const x=execute(runs,'Classify without promotion',{workflow_runs:[record(),record({run_attempt:2}),record({run_attempt:2})]});
 assert.equal(x.length,2);
 assert.notEqual(x[0].json.receipt_key,x[1].json.receipt_key);
});
test('not approved repository/branch/workflow/event excluded',()=>{
 const x=execute(runs,'Classify without promotion',{workflow_runs:[
  record({repository:{full_name:'unauthorized/repo'}}),record({head_branch:'dev'}),
  record({path:'.github/workflows/deploy-hermes-http-endpoint.yml'}),record({event:'pull_request'})
 ]});
 assert.equal(x.length,0);
});
test('bad GitHub response fails closed',()=>{
 assert.throws(()=>execute(runs,'Classify without promotion',{}),/MESH_INVALID_RESPONSE/);
});
test('error receiver never repeats token, raw message, stack or workflow name',()=>{
 const x=execute(errors,'Classify without secrets',{execution:{id:'12',error:{message:'401 sk-proj-EXAMPLEKEY',stack:'PRIVATE'}} ,workflow:{id:'w-1',name:'Client Secrets'}});
 assert.equal(x[0].json.reason_code,'AUTH_FAILED');
 assert.equal(x[0].json.retry_policy,'MANUAL_REVIEW');
 assert.ok(!JSON.stringify(x).includes('EXAMPLEKEY'));
 assert.ok(!JSON.stringify(x).includes('Client Secrets'));
});
test('cloudflare 1010 does not retry, HTTP 503 can be reviewed for bounded retry',()=>{
 const a=execute(errors,'Classify without secrets',{execution:{error:{message:'403 Cloudflare 1010'}}})[0].json;
 assert.equal(a.reason_code,'ACCESS_DENIED');
 assert.equal(a.retry_policy,'MANUAL_REVIEW');
 const b=execute(errors,'Classify without secrets',{execution:{error:{message:'HTTP 503'}}})[0].json;
 assert.equal(b.reason_code,'TRANSIENT_PROVIDER_FAILURE');
 assert.equal(b.retry_policy,'REVIEW_BOUNDED_RETRY');
});


// One reviewed, manual Chief handoff. Validation is intentionally stricter than run triage.
const chiefHandoff = load('mesh-chief-reviewed-handoff.json');
function reviewBatch(batch) {
  const script = chiefHandoff.nodes.find(n=>n.name==='Create one Chief snapshot').parameters.jsCode;
  const context = {$: name => ({first:()=>({json:batch})})};
  return JSON.parse(JSON.stringify(vm.runInNewContext('(function(){'+script+'\n})()',context,{timeout:1500})[0].json));
}
const sha40='a'.repeat(40), sha64='b'.repeat(64), asOf='2026-11-16T20:00:00Z';
const argusPass=()=>({
 schema:'argus-chief-handoff-v1',status:'VERIFIED_SYNTHETIC',reason:'reviewed_synthetic_receipt_matches_github',
 receipt_key:'argus-12345-2',n8n_execution_id:'55',
 run:{run_id:'12345',run_attempt:2,head_sha:sha40,conclusion:'success',
  run_url:'https://github.com/2strongtrainers-art/Nicholas-AI-OS/actions/runs/12345/attempts/2'},
 verification:{status:'ARGUS_SYNTHETIC_PASS',failure_code:null,observed_at:'2026-11-16T19:30:00Z',
  evidence:{fixture_id:'argus-synthetic-png-v1',source_bytes:69,
   source_sha256:'5731a25f0c25c4e8b515f273b778da29ec74369400f93551a68507d5dacf77c3',
   unauthenticated_http:401,authenticated_http:200,
   exiftool:{FileType:'PNG',MIMEType:'image/png',ImageWidth:1,ImageHeight:1},sensitive_metadata_included:false}},
 reviewed_artifact:{artifact_id:456,archive_sha256:sha64},
 chief_delivery:'normalized_output_prepared; acknowledgment_not_observed',
});
const batch=(records)=>({schema:'trivalley-chief-review-batch-v1',batch_id:'safe-pilot-001',as_of:asOf,records});
test('Chief handoff is inactive, manual-only, and sends nothing',()=>{
 assert.equal(chiefHandoff.active,false);
 assert.deepEqual(chiefHandoff.pinData,{});
 assert.equal(chiefHandoff.nodes.length,3);
 assert.equal(chiefHandoff.nodes[0].type,'n8n-nodes-base.manualTrigger');
 assert.equal(chiefHandoff.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest').length,0);
 assert.equal(chiefHandoff.nodes.filter(n=>n.type==='n8n-nodes-base.webhook').length,0);
 assert.ok(chiefHandoff.nodes.every(n=>n.credentials===undefined));
});
test('reviewed synthetic pass gets one normalized Chief item, never completed deployment',()=>{
 const o=reviewBatch(batch([{kind:'argus',handoff:argusPass()}]));
 assert.equal(o.status,'PARTIAL_VERIFICATION');
 assert.equal(o.chief_snapshot.coverage.github,'partial');
 assert.equal(o.chief_snapshot.items.length,1);
 assert.equal(o.chief_snapshot.items[0].id,'argus-verification');
 assert.equal(o.chief_snapshot.items[0].source,'github');
 assert.equal(o.chief_snapshot.items[0].url,argusPass().run.run_url);
 assert.match(o.chief_delivery,/acknowledgment_not_observed/);
});
test('repo category remains source-index only; market missing credential remains blocked',()=>{
 const indexed={kind:'repo_category',index_receipt:{status:'SOURCES_INDEXED_NOT_DEPLOYED',n8n_execution_id:'46',
  observed_at:'2026-11-16T19:00:00Z',commit_sha:sha40,indexed_sources:10}};
 const market={kind:'market_desk',market_receipt:{status:'BLOCKED',reason:'SKIPPED_NO_ALPACA_DATA_CREDENTIALS',
  run_id:'993',run_attempt:1,commit_sha:sha40,observed_at:'2026-11-16T19:01:00Z',orders_sent:0}};
 const o=reviewBatch(batch([indexed,market]));
 assert.equal(o.status,'BLOCKED');
 assert.deepEqual(o.records.map(r=>r.status),['SOURCES_INDEXED_NOT_DEPLOYED','BLOCKED']);
 assert.equal(o.chief_snapshot.items.length,2);
 assert.match(o.chief_snapshot.items[0].next_step,/manual and read-only/);
});
test('reviewed blocked ARGUS receipt preserves failure code without promoting it',()=>{
 const h=argusPass();
 h.status='BLOCKED';h.reason='worker_not_configured';h.run.conclusion='failure';
 h.verification={status:'ARGUS_VERIFICATION_BLOCKED',failure_code:'worker_not_configured',observed_at:'2026-11-16T19:30:00Z',evidence:null};
 h.reviewed_artifact=null;
 const o=reviewBatch(batch([{kind:'argus',handoff:h}]));
 assert.equal(o.status,'BLOCKED');
 assert.equal(o.records[0].reason,'worker_not_configured');
 assert.match(o.chief_snapshot.items[0].version,/BLOCKED:worker_not_configured/);
});
test('invalid synthetic evidence, forged provenance and extra input fields fail closed',()=>{
 const variants=[
  h=>{h.verification.evidence.unauthenticated_http=200;},
  h=>{h.verification.evidence.source_sha256='c'.repeat(64);},
  h=>{h.run.run_url='https://example.org';},
  h=>{h.reviewed_artifact.archive_sha256='bad';},
  h=>{h.status='VERIFIED_OPERATIONAL';},
  h=>{h.private_secret='sk-secret-test';},
 ];
 for(const modify of variants){
  const h=argusPass();modify(h);
  const input=batch([{kind:'argus',handoff:h}]);
  // Unknown fields inside a reviewed upstream packet must also be rejected.
  assert.throws(()=>reviewBatch(input),/MESH_INVALID_REVIEW_PACKET/);
 }
});
test('duplicates, future evidence, no reviewed records and invented workflow reject',()=>{
 const rec={kind:'argus',handoff:argusPass()};
 assert.throws(()=>reviewBatch(batch([rec,rec])),/MESH_INVALID_REVIEW_PACKET/);
 assert.throws(()=>reviewBatch(batch([])),/MESH_INVALID_REVIEW_PACKET/);
 assert.throws(()=>reviewBatch(batch([{kind:'hermes',handoff:argusPass()}])),/MESH_INVALID_REVIEW_PACKET/);
 const h=argusPass();h.verification.observed_at='2026-11-17T19:00:00Z';
 assert.throws(()=>reviewBatch(batch([{kind:'argus',handoff:h}])),/MESH_INVALID_REVIEW_PACKET/);
});
test('identical reviewed batch generates deterministic Chief run ID and payload',()=>{
 const b=batch([{kind:'argus',handoff:argusPass()}]);
 assert.deepEqual(reviewBatch(b),reviewBatch(b));
 assert.equal(reviewBatch(b).chief_snapshot.run_id,'mesh-safe-pilot-001');
});
test('mesh receipt writer is single, keyed, and manual-only', () => {
 const writers=runs.nodes.filter(n=>n.type==='n8n-nodes-base.dataTable');
 assert.equal(writers.length,1);
 const w=writers[0];
 assert.equal(w.name,'Upsert metadata receipt by key');
 assert.equal(w.parameters.operation,'upsert');
 assert.equal(w.parameters.dataTableId.value,'xBXICbM5r7KDV1qv');
 assert.deepEqual(w.parameters.filters.conditions,[{keyName:'receipt_key',keyValue:'={{ $json.receipt_key }}'}]);
 const required=['receipt_key','kind','status','run_url','observed_at','run_id','run_attempt','evidence_level','reason_code'];
 assert.deepEqual(Object.keys(w.parameters.columns.value),required);
 for(const field of required) assert.equal(w.parameters.columns.value[field], '={{ $json.'+field+' }}');
 assert.deepEqual(runs.connections['Classify without promotion'].main,[[{node:w.name,type:'main',index:0}]]);
 assert.equal(runs.active,false);
});
test('classifier accepts actual positive GitHub run IDs and positive attempts',()=>{
 const rec=record({id:43788561521,run_attempt:2});
 const out=execute(runs,'Classify without promotion',{workflow_runs:[rec]});
 assert.equal(out.length,1);
 assert.match(out[0].json.receipt_key,/43788561521:2$/);
 assert.equal(out[0].json.status,'UNVERIFIED');
});


// Global Intelligence Desk manual n8n handoff: metadata-only Chief report.
const intelHandoff = load('global-intel-readonly-handoff.json');
function reviewIntel(data, executionId='1122') {
  const code = intelHandoff.nodes.find(n=>n.name==='Build safe evidence receipt')?.parameters?.jsCode;
  assert.ok(code);
  const out = vm.runInNewContext('(function(){'+code+'\n})()',{
    $input:{first:()=>({json:data})},$execution:{id:executionId}
  },{timeout:1500});
  return JSON.parse(JSON.stringify(out[0].json));
}
const intelFixture=(override={})=>({
 schema:'trivalley.global-intel.v1',
 generated_at:new Date(Date.now()-2*60000).toISOString(),
 status:'DEGRADED',
 source_health:[
  {name:'GDELT / Security',state:'error',count:0},
  {name:'GDELT bulk',state:'ok',count:3},
  {name:'Federal Reserve',state:'ok',count:20},
  {name:'USGS',state:'ok',count:114},
  {name:'NASA EONET',state:'ok',count:314}
 ],
 events:[{id:'one',kind:'report'}],connections:[],
 ...override
});
test('Global Intel staging graph cannot send, poll, trade or write to n8n table',()=>{
 assert.equal(intelHandoff.active,false);
 assert.deepEqual(intelHandoff.pinData,{});
 assert.deepEqual(intelHandoff.nodes.map(n=>n.type),[
   'n8n-nodes-base.manualTrigger','n8n-nodes-base.httpRequest','n8n-nodes-base.code'
 ]);
 assert.equal(intelHandoff.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest')[0].parameters.method,'GET');
 assert.equal(intelHandoff.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest')[0].parameters.url,
   'https://2strongtrainers-art.github.io/Nicholas-AI-OS/data/events.json');
 assert.ok(intelHandoff.nodes.every(n=>!n.credentials));
});
test('Degraded live intelligence is an actionable review item but not validated causality or Chief delivery',()=>{
 const output=reviewIntel(intelFixture());
 assert.equal(output.state,'DEGRADED_SOURCE_COVERAGE');
 assert.equal(output.reason_code,'some_feeds_unavailable');
 assert.equal(output.n8n_execution_id,'1122');
 assert.equal(output.source_families.length,4);
 assert.equal(output.chief_snapshot.items.length,1);
 assert.equal(output.chief_snapshot.items[0].priority,'high');
 assert.equal(output.chief_snapshot.items[0].source,'github');
 assert.ok(output.chief_snapshot.items[0].url.startsWith('https://'));
 assert.match(output.chief_delivery,/acknowledgment_not_observed/);
 assert.equal(output.approval_state,'REVIEW_REQUIRED');
 assert.equal(output.candidate_classification,'CANDIDATE_ONLY_NOT_CAUSATION');
 assert.equal(output.outbound_actions,0);
 assert.equal(output.money_spent_usd,0);
});
test('Review receipt ID stays stable on duplicate reads of the same source snapshot',()=>{
 const d=intelFixture();
 const a=reviewIntel(d,'111'),b=reviewIntel(d,'112');
 assert.equal(a.receipt_key,b.receipt_key);
 assert.equal(a.chief_snapshot.run_id,b.chief_snapshot.run_id);
 assert.equal(a.chief_snapshot.items[0].version,b.chief_snapshot.items[0].version);
 assert.notEqual(a.n8n_execution_id,b.n8n_execution_id);
});
test('Fresh complete multi-family public-source input is only READY_FOR_HUMAN_REVIEW',()=>{
 const d=intelFixture({status:'OK'});
 d.source_health.forEach(f=>{f.state='ok';f.count=Math.max(1,f.count)});
 const out=reviewIntel(d);
 assert.equal(out.state,'READY_FOR_HUMAN_REVIEW');
 assert.equal(out.chief_snapshot.items[0].priority,'normal');
 assert.notEqual(out.chief_delivery,'acknowledged');
});
test('Stale, implausibly future and single-family source coverage never promoted',()=>{
 const stale=reviewIntel(intelFixture({generated_at:'2020-01-01T00:00:00Z'}));
 assert.equal(stale.state,'BLOCKED_STALE');
 const future=reviewIntel(intelFixture({generated_at:'2099-01-01T00:00:00Z'}));
 assert.equal(future.state,'BLOCKED_STALE');
 const one=reviewIntel(intelFixture({status:'OK',source_health:[{name:'GDELT bulk',state:'ok',count:5}]}));
 assert.equal(one.state,'DEGRADED_SOURCE_COVERAGE');
 assert.equal(one.reason_code,'insufficient_distinct_source_families');
});
test('Malformed, secret-tainted and invented source statuses fail closed',()=>{
 const variants=[
   {schema:'fake.schema'},
   {status:'VERIFIED'},
   {source_health:[{name:'USGS',state:'ok',count:-1}]},
   {source_health:[]},
   {connections:{malformed:true}},
   {events:{not_an_array:true}},
   {generated_at:'yesterday'}
 ];
 for(const v of variants)assert.throws(()=>reviewIntel(intelFixture(v)),/GLOBAL_INTEL_SCHEMA_INVALID/);
});
