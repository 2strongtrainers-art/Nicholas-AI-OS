// Offline-to-online coaching sync contract, synthetic/test-only until backend approval.
// This module stores no credentials. A host app must inject an authorized API sender
// and transactionally durable per-account storage; do not reuse the free guest store.
const secureUuid = () => {
  if(!globalThis.crypto?.randomUUID) throw new Error('Secure browser UUID generation unavailable');
  return globalThis.crypto.randomUUID();
};
const byteSize = x => new TextEncoder().encode(JSON.stringify(x)).length;
export function createOfflineWorkoutQueue({read,write,send,createId=secureUuid,maxEvents=100}) {
  if (![read,write,send].every(x=>typeof x==='function')) throw new Error('Queue requires storage and authorized sender');
  let serialized=Promise.resolve();
  const execute=fn=>{
    const task=serialized.then(fn);
    serialized=task.catch(()=>{});
    return task;
  };
  const load=async()=>{
    const queue=await read();
    if(queue==null)return [];
    if(!Array.isArray(queue)) throw new Error('Queue storage corruption');
    if(queue.length>maxEvents)throw new Error('Queue exceeds allowed capacity');
    return structuredClone(queue);
  };
  return {
    size:()=>execute(async()=>(await load()).length),
    snapshot:()=>execute(load),
    enqueue:payload=>execute(async()=>{
      if(!payload||typeof payload!=='object'||Array.isArray(payload)||
        typeof payload.sessionId!=='string'||typeof payload.assignmentId!=='string') {
        throw new Error('Expected stable session and assignment IDs');
      }
      // The sender's bound member session is authoritative. Never allow
      // caller-selected tenant/coach/client identities to be persisted.
      for(const name of ['clientId','coachId','orgId','role','accessToken','refreshToken']) {
        if(Object.hasOwn(payload,name))throw new Error('Client identity and credentials must not be queued');
      }
      if(byteSize(payload)>44*1024)throw new Error('Workout event exceeds queue limit');
      const queue=await load();
      const existing=queue.find(x=>x.payload.sessionId===payload.sessionId);
      if(existing) {
        if(JSON.stringify(existing.payload)!==JSON.stringify(payload))
          throw new Error('Local session ID conflict; resolve before syncing');
        return {eventId:existing.eventId,reused:true};
      }
      if(queue.length>=maxEvents)throw new Error('Queue full; export local history before adding more');
      const eventId=createId();
      queue.push({eventId,payload:structuredClone(payload),status:'pending',attempts:0});
      await write(queue);
      return {eventId,reused:false};
    }),
    flush:({max=20}={})=>execute(async()=>{
      if(!Number.isInteger(max)||max<1||max>100)throw new Error('Invalid batch limit');
      const queue=await load();
      let acknowledged=0,conflicts=0,blocked=0,transient=0;
      for(const item of queue.slice()) {
        if(acknowledged+conflicts+blocked+transient>=max)break;
        if(item.status!=='pending')continue;
        item.attempts+=1;
        let response;
        try {
          // send() must supply fresh verified member credentials outside the queue.
          response=await send(structuredClone(item.payload));
        }catch {
          // Network failure: leave the event for later. Never discard user records.
          transient+=1;break;
        }
        const code=response?.status;
        if(code===200||code===201) {
          const claimed=response?.data?.record?.sessionId || response?.record?.sessionId;
          if(claimed!==item.payload.sessionId) {
            transient+=1;break;
          }
          const index=queue.findIndex(x=>x.eventId===item.eventId);
          if(index>=0)queue.splice(index,1);
          acknowledged+=1;
        } else if(code===409) {
          item.status='conflict';item.reason='IDEMPOTENCY_CONFLICT';conflicts+=1;
        } else if([401,403,404].includes(code)) {
          item.status='needs_review';item.reason='AUTH_OR_ASSIGNMENT_CHANGED';blocked+=1;break;
        } else {
          transient+=1;break;
        }
      }
      await write(queue);
      return {acknowledged,conflicts,blocked,transient,remaining:queue.length};
    })
  };
}
