import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {normalizeSnapshot,handleRequest,SOURCE_URL} from "./worker.mjs";
const now=Date.parse("2026-11-25T12:00:00Z");
const fixedDate=class extends Date {constructor(...args){super(...(args.length?args:[now]));} static now(){return now;}};
const original=JSON.parse(readFileSync(new URL("../../workflows/n8n/global-intel-readonly-handoff.json",import.meta.url),"utf8"));
const source=original.nodes.find(n=>n.type==="n8n-nodes-base.code").parameters.jsCode;
const fixture=()=>({schema:"trivalley.global-intel.v1",status:"OK",generated_at:"2026-11-25T10:00:00Z",source_health:[{name:"GDELT world",state:"ok",count:2},{name:"USGS",state:"ok",count:1}],events:[{}],connections:[]});
const plain=x=>JSON.parse(JSON.stringify(x));
for(const [name,modify,state] of [
 ["healthy",d=>{},"READY_FOR_HUMAN_REVIEW"],
 ["degraded",d=>{d.status="DEGRADED";},"DEGRADED_SOURCE_COVERAGE"],
 ["one source family",d=>{d.source_health=[{name:"GDELT world",state:"ok",count:2},{name:"GDELT business",state:"ok",count:2}];},"DEGRADED_SOURCE_COVERAGE"],
 ["stale boundary",d=>{d.generated_at="2026-11-25T04:00:00Z";},"BLOCKED_STALE"],
 ["future",d=>{d.generated_at="2026-11-25T12:03:00Z";},"BLOCKED_STALE"]
]){
 test("exact n8n parity: "+name,()=>{
   const d=fixture();modify(d);
   const expected=vm.runInNewContext("(function(){"+source+"})()",{$input:{first:()=>({json:d})},Date:fixedDate});
   const actual=normalizeSnapshot(d,now);
   assert.deepEqual(plain(actual),plain(expected));
   assert.equal(actual[0].json.state,state);
   assert.equal(actual[0].json.n8n_execution_id,null);
   assert.equal(actual[0].json.approval_state,"REVIEW_REQUIRED");
 });
}
test("invalid schema fails closed",()=>assert.throws(()=>normalizeSnapshot({...fixture(),schema:"wrong"},now),/GLOBAL_INTEL_SCHEMA_INVALID/));
test("health and missing configuration cause no upstream call",async()=>{
 let calls=0;
 const opts={nowMs:now,fetchImpl:async()=>{calls++;throw Error("unexpected fetch");}};
 const health=await handleRequest(new Request("https://example.invalid/health"),{},opts);
 const review=await handleRequest(new Request("https://example.invalid/review"),{},opts);
 const other=await handleRequest(new Request("https://example.invalid/other"),{},opts);
 assert.equal(health.status,200);
 assert.equal(review.status,503);
 assert.equal(other.status,404);
 assert.equal(calls,0);
 assert.equal(health.headers.get("cache-control"),"no-store");
});
