import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {validateOfflineQueue,mergeOfflineQueues} from "../src/offline-backup.mjs";
const event=()=>({eventId:randomUUID(),status:"pending",attempts:0,
  payload:{sessionId:randomUUID(),assignmentId:randomUUID(),performedAt:"2026-11-20T18:00:00.000Z",durationMinutes:45,
    sets:[{exerciseId:"0289",setIndex:1,reps:10,weight:60,unit:"lb",rir:null}]}});
test("local queued workout validates and merges without loss or duplicate",()=>{
  const a=event(),b=event();
  const original=[a];
  const result=mergeOfflineQueues(original,[a,b]);
  assert.equal(result.length,2);
  assert.equal(original.length,1);
  assert.equal(mergeOfflineQueues(result,[a,b]).length,2);
});
test("auth, tenant or token fields cannot be imported in a queue event",()=>{
  const e=event();e.payload.accessToken="very-private";
  assert.throws(()=>validateOfflineQueue([e]),/INVALID_QUEUE_PAYLOAD/);
  const x=event();x.clientId="someone-else";
  assert.throws(()=>validateOfflineQueue([x]),/INVALID_QUEUE_EVENT/);
});
test("mismatched payload for same session is rejected, not overwritten",()=>{
  const a=event(),b=structuredClone(a);b.payload.sets[0].weight=85;
  assert.throws(()=>mergeOfflineQueues([a],[b]),/QUEUE_SESSION_CONFLICT/);
});
test("pending and review/conflict states are preserved on import",()=>{
  const a=event();a.status="needs_review";a.reason="AUTH_OR_ASSIGNMENT_CHANGED";
  const b=structuredClone(a);b.status="pending";delete b.reason;
  assert.equal(mergeOfflineQueues([a],[b])[0].status,"needs_review");
});
test("malformed or duplicate records are rejected",()=>{
  const a=event();
  assert.throws(()=>validateOfflineQueue([a,a]),/DUPLICATE_QUEUE_SESSION/);
  const b=event();b.payload.sets.push({...b.payload.sets[0]});
  assert.throws(()=>validateOfflineQueue([b]),/DUPLICATE_QUEUE_SET/);
  assert.throws(()=>validateOfflineQueue({not:"a list"}),/INVALID_QUEUE_LENGTH/);
});
