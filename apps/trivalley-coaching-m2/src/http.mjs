import {CoachingError} from './domain.mjs';

const MAX_BODY_BYTES=48*1024;
const jsonHeaders={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'Vary':'Authorization, Origin'
};
function respond(res,status,body,headers={}) {
  res.writeHead(status,{...jsonHeaders,...headers});
  res.end(JSON.stringify(body));
}
function notFound(){throw new CoachingError(404,'NOT_FOUND','Endpoint not found')}
async function parseBody(req) {
  const contentType=req.headers['content-type']||'';
  if(!/^application\/json(?:\s*;|$)/i.test(contentType))throw new CoachingError(415,'CONTENT_TYPE','Expected application/json');
  let size=0;const chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;
    if(size>MAX_BODY_BYTES)throw new CoachingError(413,'BODY_TOO_LARGE','Request exceeded 48 KiB');
    chunks.push(chunk);
  }
  try {return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
  catch {throw new CoachingError(400,'INVALID_JSON','Request body must be valid JSON')}
}
const allowedMethods=new Set(['GET','POST']);
const singleSegment = p => {try{return decodeURIComponent(p)}catch {return ''}};

// The verifyIdentity callback must validate a Wix member/OIDC token on the server
// and map it to a provisioned member + organization role.
// Browser-supplied role/identity are ignored.
// This module binds no HTTP port and runs no background service on its own.
export function coachingHttpHandler({service,verifyIdentity,allowedOrigins=[]}) {
  if(!service||typeof verifyIdentity!=='function')throw new Error('Trusted identity verifier and service required');
  const whitelist=new Set(allowedOrigins);
  return async (req,res)=>{
    let headers={};
    try {
      const origin=req.headers.origin;
      if(origin && !whitelist.has(origin))throw new CoachingError(403,'ORIGIN_DENIED','Origin is not authorized');
      if(origin && whitelist.has(origin))headers={
        'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, content-type',
        'Access-Control-Allow-Methods':'GET, POST, OPTIONS'
      };
      if(req.method==='OPTIONS') {
        if(!origin)throw new CoachingError(403,'ORIGIN_DENIED','Origin is required for preflight');
        res.writeHead(204,{...jsonHeaders,...headers});res.end();return;
      }
      if(!allowedMethods.has(req.method))throw new CoachingError(405,'METHOD_NOT_ALLOWED','Method unavailable');
      const token=(req.headers.authorization||'').match(/^Bearer ([^\s]{10,4096})$/i)?.[1];
      if(!token)throw new CoachingError(401,'UNAUTHENTICATED','Bearer session required');
      const actor=await verifyIdentity(token);
      if(!actor)throw new CoachingError(401,'UNAUTHENTICATED','Session not verified');
      const serviceActor={sub:actor.sub,orgId:actor.orgId,role:actor.role};
      const url=new URL(req.url||'/', 'http://localhost');
      const pathname=url.pathname;
      const isGet=req.method==='GET';
      const body=isGet?null:await parseBody(req);
      if(pathname==='/v1/me'&&isGet) return respond(res,200,{member:service.publicMember(serviceActor)},headers);
      if(pathname==='/v1/me/assignments'&&isGet)return respond(res,200,{items:service.activeAssignments(serviceActor)},headers);
      if(pathname==='/v1/me/progress'&&isGet)return respond(res,200,{progress:service.clientProgress(serviceActor,serviceActor.sub)},headers);
      if(pathname==='/v1/me/export'&&isGet)return respond(res,200,{data:service.clientExport(serviceActor)},headers);
      if(pathname==='/v1/me/workouts'&&!isGet)return respond(res,201,service.logWorkout(serviceActor,body),headers);
      if(pathname==='/v1/me/checkins'&&!isGet)return respond(res,201,service.submitCheckin(serviceActor,body),headers);
      if(pathname==='/v1/coach/programs'&&!isGet)return respond(res,201,{program:service.createProgram(serviceActor,body)},headers);
      if(pathname==='/v1/coach/assignments'&&!isGet)return respond(res,201,{assignment:service.assignProgram(serviceActor,body)},headers);
      if(pathname==='/v1/coach/clients'&&isGet)return respond(res,200,{clients:service.coachClients(serviceActor)},headers);
      let match=pathname.match(/^\/v1\/coach\/programs\/([^/]+)\/publish$/);
      if(match&&!isGet)return respond(res,200,{program:service.publishProgram(serviceActor,singleSegment(match[1]))},headers);
      match=pathname.match(/^\/v1\/coach\/checkins\/([^/]+)\/review$/);
      if(match&&!isGet)return respond(res,200,service.reviewCheckin(serviceActor,singleSegment(match[1]),body),headers);
      match=pathname.match(/^\/v1\/coach\/assignments\/([^/]+)\/revoke$/);
      if(match&&!isGet)return respond(res,200,{assignment:service.revokeAssignment(serviceActor,singleSegment(match[1]))},headers);
      match=pathname.match(/^\/v1\/coach\/clients\/([^/]+)\/progress$/);
      if(match&&isGet)return respond(res,200,{progress:service.clientProgress(serviceActor,singleSegment(match[1]))},headers);
      match=pathname.match(/^\/v1\/coach\/clients\/([^/]+)\/checkins$/);
      if(match&&isGet)return respond(res,200,{items:service.coachCheckins(serviceActor,singleSegment(match[1]))},headers);
      notFound();
    }catch(e){
      if(e instanceof CoachingError)return respond(res,e.status,{error:e.code,message:e.message},headers);
      return respond(res,500,{error:'INTERNAL_ERROR',message:'Operation failed'},headers);
    }
  };
}
