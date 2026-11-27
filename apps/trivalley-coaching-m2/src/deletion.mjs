// Owner-reviewed client erasure. Edge must separately scrub SQL memberships,
// invitation links, audit events and historic snapshots in the same transaction.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function eraseClientState(store,actor,requestId,now=()=>new Date().toISOString()){
  if(actor?.role!=="coach"||typeof actor.orgId!=="string")throw Error("OWNER_REVIEW_REQUIRED");
  if(!UUID.test(requestId||""))throw Error("INVALID_REQUEST_ID");
  const orgId=actor.orgId;
  const match=[...store.deletionRequests.entries()].find(([,r])=>
    r.orgId===orgId&&r.requestId===requestId&&r.status==="pending_owner_review");
  if(!match)throw Error("NO_PENDING_DELETION");
  const clientId=match[1].clientId;
  const resources=[];
  const counts={workouts:0,checkins:0,assignments:0};
  for(const [key,value] of store.workouts){
    if(value?.record?.orgId===orgId&&value.record.clientId===clientId){
      resources.push(value.record.id);store.workouts.delete(key);counts.workouts++;
    }
  }
  for(const [key,value] of store.checkins){
    if(value?.record?.orgId===orgId&&value.record.clientId===clientId){
      resources.push(value.record.id);store.checkins.delete(key);counts.checkins++;
    }
  }
  for(const [key,value] of store.assignments){
    if(value.orgId===orgId&&value.clientId===clientId){
      resources.push(value.id);store.assignments.delete(key);counts.assignments++;
    }
  }
  for(const [key,value] of store.deletionRequests){
    if(value.orgId===orgId&&value.clientId===clientId)store.deletionRequests.delete(key);
  }
  const receipt={requestId,orgId,status:"completed",clientId:"REDACTED",
    requestedAt:match[1].requestedAt,completedAt:now()};
  store.deletionRequests.set(orgId+":redacted:"+requestId,receipt);
  return {clientId,requestId,...counts,resources,receipt};
}
