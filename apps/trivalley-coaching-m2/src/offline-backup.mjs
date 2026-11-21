// Validation of the client-owned OFFLINE QUEUE ONLY. No Wix tokens or client details
// are stored in the portable encrypted envelope. Encrypted file parsing is done
// separately with WebCrypto after interactive user authentication.
const VALID_STATUS=new Set(["pending","conflict","needs_review"]);
const VALID_REASON=new Set(["IDEMPOTENCY_CONFLICT","AUTH_OR_ASSIGNMENT_CHANGED"]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const permittedPayload=new Set(["sessionId","assignmentId","performedAt","durationMinutes","sets"]);
const permittedEvent=new Set(["eventId","payload","status","attempts","reason"]);
function bad(code){throw new Error(code)}
function validEvent(event) {
  if(!event||typeof event!=="object"||Array.isArray(event)||
     Object.keys(event).some(k=>!permittedEvent.has(k))||
     typeof event.eventId!=="string"||!UUID.test(event.eventId)||
     !VALID_STATUS.has(event.status)||!Number.isInteger(event.attempts)||
     event.attempts<0||event.attempts>10000)bad("INVALID_QUEUE_EVENT");
  const data=event.payload;
  if(!data||typeof data!=="object"||Array.isArray(data)||
     Object.keys(data).some(k=>!permittedPayload.has(k))||
     !UUID.test(data.sessionId||"")||!UUID.test(data.assignmentId||"")||
     typeof data.performedAt!=="string"||
     !Number.isFinite(new Date(data.performedAt).getTime())||
     !Number.isInteger(data.durationMinutes)||data.durationMinutes<1||
     data.durationMinutes>360||
     !Array.isArray(data.sets)||!data.sets.length||data.sets.length>250||
     JSON.stringify(data).length>44*1024)bad("INVALID_QUEUE_PAYLOAD");
  const pairs=new Set();
  for(const set of data.sets){
    if(!set||typeof set!=="object"||Array.isArray(set)||
       Object.keys(set).some(k=>!["exerciseId","setIndex","reps","weight","unit","rir"].includes(k))||
       typeof set.exerciseId!=="string"||set.exerciseId.length<1||set.exerciseId.length>100||
       !Number.isInteger(set.setIndex)||set.setIndex<1||set.setIndex>14||
       !Number.isInteger(set.reps)||set.reps<0||set.reps>120||
       typeof set.weight!=="number"||!Number.isFinite(set.weight)||set.weight<0||set.weight>1500||
       !["lb","kg"].includes(set.unit)||
       !(set.rir==null||(Number.isInteger(set.rir)&&set.rir>=0&&set.rir<=10)))
       bad("INVALID_QUEUE_SET");
    const id=set.exerciseId+":"+set.setIndex;
    if(pairs.has(id))bad("DUPLICATE_QUEUE_SET");
    pairs.add(id);
  }
  if(event.status==="pending"&&event.reason!==undefined)
    bad("INVALID_QUEUE_STATUS");
  if(event.status!=="pending"&&!VALID_REASON.has(event.reason))
    bad("INVALID_QUEUE_STATUS");
}
export function validateOfflineQueue(queue,limit=100){
  if(!Array.isArray(queue)||queue.length>limit)bad("INVALID_QUEUE_LENGTH");
  const sessionIds=new Set(),eventIds=new Set();
  for(const event of queue){
    validEvent(event);
    if(sessionIds.has(event.payload.sessionId)||eventIds.has(event.eventId))
      bad("DUPLICATE_QUEUE_SESSION");
    sessionIds.add(event.payload.sessionId);eventIds.add(event.eventId);
  }
  return structuredClone(queue);
}
export function mergeOfflineQueues(existing,incoming,limit=100){
  const current=validateOfflineQueue(existing,limit);
  const restored=validateOfflineQueue(incoming,limit);
  const bySession=new Map(current.map(x=>[x.payload.sessionId,x]));
  const knownEvents=new Set(current.map(x=>x.eventId));
  for(const event of restored){
    const prior=bySession.get(event.payload.sessionId);
    if(prior) {
      if(JSON.stringify(prior.payload)!==JSON.stringify(event.payload))
        bad("QUEUE_SESSION_CONFLICT");
      continue; // keep current status: conflict or needs_review must not be downgraded
    }
    if(knownEvents.has(event.eventId))bad("QUEUE_EVENT_ID_CONFLICT");
    if(current.length>=limit)bad("QUEUE_CAPACITY_REACHED");
    current.push(event);bySession.set(event.payload.sessionId,event);
    knownEvents.add(event.eventId);
  }
  return current;
}
