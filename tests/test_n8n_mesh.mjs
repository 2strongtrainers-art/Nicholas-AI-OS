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

