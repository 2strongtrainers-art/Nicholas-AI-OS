const generateId = () => {
  if(!globalThis.crypto?.randomUUID)throw new Error('Secure UUID generation unavailable');
  return globalThis.crypto.randomUUID();
};

// Milestone 2 core. No network, credentials, or real client records.
// The authenticated identity MUST come from a server-side verified Wix/OIDC session.
// Never construct an identity from JSON input or an X-User-ID HTTP header.
export class CoachingError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'CoachingError';
    this.status = status;
    this.code = code;
  }
}
const error = (status, code, msg) => {throw new CoachingError(status, code, msg)};
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const plain = obj => obj !== null && typeof obj === 'object' && !Array.isArray(obj);
const text = (value, max=120, name='Text') => {
  if(typeof value !== 'string' || !value.trim() || value.length > max) error(422,'VALIDATION',name+' must be nonempty and <= '+max+' characters');
  return value.trim();
};
const uuid = (value, name='ID') => {
  if(typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) error(422,'VALIDATION',name+' must be a UUID');
  return value.toLowerCase();
};
const fields = (data, list) => {
  if(!plain(data)) error(422,'VALIDATION','Expected a JSON object');
  for(const key of Object.keys(data)) if(!list.includes(key)) error(422,'UNEXPECTED_FIELD','Unrecognized field: '+key);
};
const integer = (n, min, max, label) => {
  if(!Number.isInteger(n) || n<min || n>max) error(422,'VALIDATION',label+' out of range');
  return n;
};
const number = (n, min, max, label) => {
  if(typeof n!=='number' || !Number.isFinite(n) || n<min || n>max) error(422,'VALIDATION',label+' out of range');
  return n;
};
const sanitizedActor = actor => {
  if(!plain(actor) || typeof actor.sub!=='string' || typeof actor.orgId!=='string' ||
     !['coach','client'].includes(actor.role) || !actor.sub || !actor.orgId) error(401,'UNAUTHENTICATED','Verified authentication required');
  return Object.freeze({sub:actor.sub,orgId:actor.orgId,role:actor.role});
};
const clone = value => structuredClone(value);
const exists = (v,message='Record not found') => {if(!v) error(404,'NOT_FOUND',message);return v};
const isOrg = (v,orgId) => v && v.orgId === orgId;
const isDay = value => {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T12:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===value;
};

export class InMemoryCoachingStore {
  constructor() {
    this.ephemeralForTests = true;
    this.members = new Map();
    this.programs = new Map();
    this.programVersions = new Map();
    this.exerciseCatalog = new Set();
    this.assignments = new Map();
    this.workouts = new Map();
    this.checkins = new Map();
    this.deletionRequests = new Map();
    this.audit = [];
  }
  // Synthetic fixture setup only. No public API allows profile or role provisioning.
  seedExercise(exerciseId) {
    this.exerciseCatalog.add(text(exerciseId,100,'Exercise ID'));
  }
  seedMember({id,orgId,role,displayName}) {
    if(!['coach','client'].includes(role)) throw new Error('invalid fixture role');
    if(!id || !orgId) throw new Error('fixture requires identity and organization');
    this.members.set(id,{id,orgId,role,displayName:displayName||'Member',status:'active'});
  }
}

// A deterministic data-contract implementation, intentionally not a production server.
// Production needs a durable transactional repository and a trusted identity verifier.
export class CoachingService {
  constructor({store,now=()=>new Date().toISOString(),createId=generateId}) {
    if(!store || !store.members || !store.assignments) throw new Error('Repository interface required');
    this.store=store;this.now=now;this.createId=createId;
  }
  member(actor) {
    const a=sanitizedActor(actor);
    const m=exists(this.store.members.get(a.sub),'Membership not found');
    if(m.orgId!==a.orgId || m.role!==a.role || m.status!=='active') error(403,'MEMBERSHIP_MISMATCH','Membership verification failed');
    return {a,m};
  }
  requireCoach(actor) {
    const info=this.member(actor);
    if(info.a.role!=='coach') error(403,'COACH_ONLY','Coach authorization required');
    return info;
  }
  requireClient(actor) {
    const info=this.member(actor);
    if(info.a.role!=='client') error(403,'CLIENT_ONLY','Client authorization required');
    return info;
  }
  audit(actor,action,id) {
    if (!this.store.audit) return;
    // Intentional: no exercise details, medical notes, tokens or client names in audit events.
    this.store.audit.push({actorId:actor.sub,orgId:actor.orgId,action,resourceId:id,at:this.now()});
  }
  publicMember(actor) {
    const {a,m}=this.member(actor);
    return {id:a.sub,orgId:a.orgId,role:a.role,displayName:m.displayName};
  }
  createProgram(actor,input) {
    const {a}=this.requireCoach(actor);
    fields(input,['title','description','exercises']);
    const title=text(input.title,90,'Program title');
    const description=input.description==null?'':(typeof input.description==='string'&&input.description.length<=500
      ? input.description : error(422,'VALIDATION','Description too long or invalid'));
    if(!Array.isArray(input.exercises) || !input.exercises.length || input.exercises.length>30) error(422,'VALIDATION','Program requires 1-30 exercises');
    const exercises=input.exercises.map((entry)=>{
      fields(entry,['exerciseId','sets','reps','restSeconds','tempo','coachCue']);
      return {
        exerciseId:text(entry.exerciseId,100,'Exercise ID'),
        sets:integer(entry.sets,1,12,'Sets'),
        reps:integer(entry.reps,1,60,'Reps'),
        restSeconds:integer(entry.restSeconds,0,600,'Rest seconds'),
        tempo:entry.tempo==null?null:text(entry.tempo,20,'Tempo'),
        coachCue:entry.coachCue==null?'':text(entry.coachCue,240,'Coach cue')
      };
    });
    if(!this.store.exerciseCatalog || !exercises.every(x=>this.store.exerciseCatalog.has(x.exerciseId)))
      error(422,'UNKNOWN_EXERCISE','Program contains an unverified exercise ID');
    if(new Set(exercises.map(x=>x.exerciseId)).size!==exercises.length)
      error(422,'DUPLICATE_EXERCISE','Program exercise IDs must be unique for this MVP');
    const id=this.createId();
    const record={id,orgId:a.orgId,coachId:a.sub,title,description,exercises,version:1,status:'draft',createdAt:this.now(),publishedAt:null};
    this.store.programs.set(id,record);
    this.store.programVersions.set(id+':1',clone(record));
    this.audit(a,'PROGRAM_CREATED',id);
    return clone(record);
  }
  publishProgram(actor,programId) {
    const {a}=this.requireCoach(actor);
    const p=exists(this.store.programs.get(uuid(programId)));
    if(!isOrg(p,a.orgId) || p.coachId!==a.sub) error(404,'NOT_FOUND','Program not found');
    if(p.status==='draft') {
      p.status='published';p.publishedAt=this.now();
      this.store.programVersions.set(p.id+':'+p.version,clone(p));
      this.audit(a,'PROGRAM_PUBLISHED',p.id+':'+p.version);
    }
    return clone(p);
  }
  // Assignments always refer to the exact published snapshot they were given.
  // A new draft or publication must never silently rewrite a client's old plan.
  programForAssignment(assignment) {
    return this.store.programVersions.get(assignment.programId+':'+assignment.programVersion) || null;
  }
  reviseProgram(actor,programId,input) {
    const {a}=this.requireCoach(actor);
    const id=uuid(programId,'Program ID');
    const prior=exists(this.store.programs.get(id),'Program not found');
    if(prior.orgId!==a.orgId||prior.coachId!==a.sub)error(404,'NOT_FOUND','Program not found');
    if(prior.status!=='published')error(409,'UNPUBLISHED_DRAFT','Publish or discard the current draft before revising');
    fields(input,['title','description','exercises']);
    const title=text(input.title,90,'Program title');
    const description=input.description==null?'':(typeof input.description==='string'&&input.description.length<=500?input.description:error(422,'VALIDATION','Description too long'));
    if(!Array.isArray(input.exercises)||input.exercises.length<1||input.exercises.length>30)
      error(422,'VALIDATION','Program requires 1-30 exercises');
    const exercises=input.exercises.map(entry=>{
      fields(entry,['exerciseId','sets','reps','restSeconds','tempo','coachCue']);
      return {
        exerciseId:text(entry.exerciseId,100,'Exercise ID'),
        sets:integer(entry.sets,1,12,'Sets'),
        reps:integer(entry.reps,1,60,'Reps'),
        restSeconds:integer(entry.restSeconds,0,600,'Rest seconds'),
        tempo:entry.tempo==null?null:text(entry.tempo,20,'Tempo'),
        coachCue:entry.coachCue==null?'':text(entry.coachCue,240,'Coach cue')
      };
    });
    if(!exercises.every(ex=>this.store.exerciseCatalog.has(ex.exerciseId)))
      error(422,'UNKNOWN_EXERCISE','Program contains an unverified exercise ID');
    if(new Set(exercises.map(ex=>ex.exerciseId)).size!==exercises.length)
      error(422,'DUPLICATE_EXERCISE','Program exercises must be unique');
    const next={...clone(prior),title,description,exercises,version:prior.version+1,
      previousVersion:prior.version,status:'draft',createdAt:this.now(),publishedAt:null};
    this.store.programs.set(id,next);
    this.store.programVersions.set(id+':'+next.version,clone(next));
    this.audit(a,'PROGRAM_REVISED',id+':'+next.version);
    return clone(next);
  }
  assignProgram(actor,input) {
    const {a}=this.requireCoach(actor);
    fields(input,['programId','clientId']);
    const p=exists(this.store.programs.get(uuid(input.programId)),'Published program not found');
    if(!isOrg(p,a.orgId) || p.coachId!==a.sub || p.status!=='published') error(404,'NOT_FOUND','Published program not found');
    const m=exists(this.store.members.get(text(input.clientId,160,'Client ID')),'Client not found');
    if(m.role!=='client' || m.orgId!==a.orgId || m.status!=='active') error(404,'NOT_FOUND','Client not found');
    const previous=[...this.store.assignments.values()].find(v=>v.orgId===a.orgId&&v.coachId===a.sub&&
      v.clientId===m.id&&v.programId===p.id&&v.programVersion===p.version&&v.status==='active');
    if(previous) return {...clone(previous),reused:true};
    const id=this.createId();
    const record={id,orgId:a.orgId,coachId:a.sub,clientId:m.id,programId:p.id,programVersion:p.version,assignedAt:this.now(),status:'active'};
    this.store.assignments.set(id,record);
    this.audit(a,'PROGRAM_ASSIGNED',id);
    return clone(record);
  }
  activeAssignments(actor) {
    const {a}=this.requireClient(actor);
    return [...this.store.assignments.values()].filter(x=>x.orgId===a.orgId&&x.clientId===a.sub&&x.status==='active')
      .map(assignment=>{
        const p=this.programForAssignment(assignment);
        return {assignment:clone(assignment),program:p?clone(p):null};
      });
  }
  coachPrograms(actor) {
    const {a}=this.requireCoach(actor);
    return [...this.store.programs.values()]
      .filter(p=>p.orgId===a.orgId && p.coachId===a.sub)
      .map(p=>clone(p))
      .sort((x,y)=>y.createdAt.localeCompare(x.createdAt)||x.id.localeCompare(y.id));
  }
  coachClients(actor) {
    const {a}=this.requireCoach(actor);
    const ids=new Set([...this.store.assignments.values()].filter(x=>x.orgId===a.orgId&&x.coachId===a.sub&&x.status==='active').map(x=>x.clientId));
    return [...ids].map(id=>this.store.members.get(id)).filter(m=>m?.status==='active' && m.role==='client' && m.orgId===a.orgId).map(m=>({id:m.id,displayName:m.displayName}));
  }
  authorizedCoachClient(actor,clientId) {
    const {a}=this.requireCoach(actor);
    clientId=text(clientId,160,'Client ID');
    const allowed=[...this.store.assignments.values()].some(x=>x.orgId===a.orgId&&x.coachId===a.sub&&x.clientId===clientId&&x.status==='active');
    if(!allowed) error(404,'NOT_FOUND','Client not found');
    const member=exists(this.store.members.get(clientId));
    if(member.role!=='client'||member.orgId!==a.orgId||member.status!=='active') error(404,'NOT_FOUND','Client not found');
    return member;
  }
  logWorkout(actor,input) {
    const {a}=this.requireClient(actor);
    fields(input,['sessionId','assignmentId','performedAt','sets','durationMinutes']);
    const sessionId=uuid(input.sessionId,'Session ID');
    const assignment=exists(this.store.assignments.get(uuid(input.assignmentId,'Assignment ID')),'Assignment not found');
    if(assignment.orgId!==a.orgId||assignment.clientId!==a.sub||assignment.status!=='active')error(404,'NOT_FOUND','Assignment not found');
    const program=exists(this.programForAssignment(assignment),'Assigned program version not found');
    const performedAt=text(input.performedAt,35,'Completion time');
    const t=new Date(performedAt);
    if(!Number.isFinite(t.getTime())||t.toISOString()!==performedAt)error(422,'VALIDATION','performedAt must be ISO UTC');
    const durationMinutes=integer(input.durationMinutes,1,360,'Duration');
    if(!Array.isArray(input.sets)||!input.sets.length||input.sets.length>250)error(422,'VALIDATION','Expected 1-250 performed sets');
    const allowed=new Set(program.exercises.map(ex=>ex.exerciseId));
    const maxSets=new Map(program.exercises.map(ex=>[ex.exerciseId,ex.sets+2]));
    const indexUsed=new Set();
    const sets=input.sets.map(set=>{
      fields(set,['exerciseId','setIndex','reps','weight','unit','rir']);
      const exerciseId=text(set.exerciseId,100,'Exercise ID');
      if(!allowed.has(exerciseId))error(422,'VALIDATION','Exercise is not assigned');
      const setIndex=integer(set.setIndex,1,maxSets.get(exerciseId),'Set index');
      const uniqueKey=exerciseId+':'+setIndex;
      if(indexUsed.has(uniqueKey))error(422,'DUPLICATE_SET','Duplicate performed set index');
      indexUsed.add(uniqueKey);
      return {
        exerciseId,setIndex,
        reps:integer(set.reps,0,120,'Reps'),
        weight:number(set.weight,0,1500,'Weight'),
        unit:['kg','lb'].includes(set.unit)?set.unit:error(422,'VALIDATION','Invalid weight unit'),
        rir:set.rir==null?null:integer(set.rir,0,10,'Reps in reserve')
      };
    });
    const composite=a.orgId+':'+a.sub+':'+sessionId;
    const existing=this.store.workouts.get(composite);
    const normalized={sessionId,assignmentId:assignment.id,performedAt,durationMinutes,sets};
    const fingerprint=JSON.stringify(normalized);
    if(existing) {
      if(existing.fingerprint!==fingerprint)error(409,'IDEMPOTENCY_CONFLICT','Session ID already used with different data');
      return {record:clone(existing.record),reused:true};
    }
    const record={id:this.createId(),orgId:a.orgId,clientId:a.sub,coachId:assignment.coachId,
      programId:assignment.programId,programVersion:assignment.programVersion,
      ...normalized,loggedAt:this.now()};
    this.store.workouts.set(composite,{fingerprint,record});
    this.audit(a,'WORKOUT_RECEIVED',record.id);
    return {record:clone(record),reused:false};
  }
  submitCheckin(actor,input) {
    const {a}=this.requireClient(actor);
    fields(input,['checkinId','assignmentId','weekOf','completionRating','comment','requestReview']);
    const checkinId=uuid(input.checkinId,'Check-in ID');
    const assignment=exists(this.store.assignments.get(uuid(input.assignmentId)),'Assignment not found');
    if(assignment.orgId!==a.orgId||assignment.clientId!==a.sub||assignment.status!=='active')error(404,'NOT_FOUND','Assignment not found');
    if(!isDay(input.weekOf))error(422,'VALIDATION','Invalid weekOf day');
    const completionRating=integer(input.completionRating,1,5,'Training satisfaction');
    const comment=input.comment==null?'':(typeof input.comment==='string'&&input.comment.length<=500?input.comment:error(422,'VALIDATION','Comment too long'));
    const requestReview=input.requestReview===true;
    if(input.requestReview!=null&&typeof input.requestReview!=='boolean')error(422,'VALIDATION','requestReview must be boolean');
    const payload={checkinId,assignmentId:assignment.id,weekOf:input.weekOf,completionRating,comment,requestReview};
    const key=a.orgId+':'+a.sub+':'+checkinId;
    const existing=this.store.checkins.get(key);
    const fingerprint=JSON.stringify(payload);
    if(existing) {
      if(existing.fingerprint!==fingerprint)error(409,'IDEMPOTENCY_CONFLICT','Check-in ID already used with different data');
      return {record:clone(existing.record),reused:true};
    }
    const record={id:this.createId(),orgId:a.orgId,coachId:assignment.coachId,clientId:a.sub,
      ...payload,submittedAt:this.now(),reviewStatus:'pending'};
    this.store.checkins.set(key,{record,fingerprint});
    this.audit(a,'CHECKIN_RECEIVED',record.id);
    return {record:clone(record),reused:false};
  }
  clientProgress(actor,clientId) {
    const {a}=this.member(actor);
    if(a.role==='coach')this.authorizedCoachClient(actor,clientId);
    else if(a.role!=='client'||clientId!==a.sub)error(404,'NOT_FOUND','Client not found');
    const workouts=[...this.store.workouts.values()].map(v=>v.record).filter(w=>w.orgId===a.orgId&&w.clientId===clientId);
    const checkins=[...this.store.checkins.values()].map(v=>v.record).filter(c=>c.orgId===a.orgId&&c.clientId===clientId);
    const assignmentCount=[...this.store.assignments.values()].filter(v=>v.orgId===a.orgId&&v.clientId===clientId).length;
    return {
      clientId,assignmentCount,totalWorkouts:workouts.length,
      totalLoggedSets:workouts.reduce((n,w)=>n+w.sets.length,0),
      completedWorkoutDates:workouts.map(w=>w.performedAt.slice(0,10)).sort(),
      checkinsSubmitted:checkins.length,checkinsAwaitingReview:checkins.filter(x=>x.reviewStatus==='pending').length
    };
  }
  reviewCheckin(actor,checkinId,input) {
    const {a}=this.requireCoach(actor);
    fields(input,['reviewNote']);
    const reviewNote=input.reviewNote==null?'':(typeof input.reviewNote==='string' && input.reviewNote.length<=500
      ? input.reviewNote : error(422,'VALIDATION','Review note too long'));
    const record=[...this.store.checkins.values()].map(x=>x.record)
      .find(x=>x.id===uuid(checkinId,'Check-in ID') && x.orgId===a.orgId && x.coachId===a.sub);
    if(!record) error(404,'NOT_FOUND','Check-in not found');
    this.authorizedCoachClient(actor,record.clientId);
    if(record.reviewStatus==='reviewed') {
      if(record.reviewNote!==reviewNote)error(409,'REVIEW_CONFLICT','Review has already been finalized');
      return {record:clone(record),reused:true};
    }
    record.reviewStatus='reviewed';
    record.reviewedAt=this.now();
    record.reviewNote=reviewNote;
    this.audit(a,'CHECKIN_REVIEWED',record.id);
    return {record:clone(record),reused:false};
  }
  revokeAssignment(actor,id) {
    const {a}=this.requireCoach(actor);
    const assignment=this.store.assignments.get(uuid(id,'Assignment ID'));
    if(!assignment || assignment.orgId!==a.orgId || assignment.coachId!==a.sub)
      error(404,'NOT_FOUND','Assignment not found');
    if(assignment.status==='active') {
      assignment.status='revoked';
      assignment.revokedAt=this.now();
      this.audit(a,'ASSIGNMENT_REVOKED',assignment.id);
    }
    return clone(assignment);
  }
  coachCheckins(actor,clientId) {
    this.authorizedCoachClient(actor,clientId);
    const a=sanitizedActor(actor);
    return [...this.store.checkins.values()].map(v=>v.record).filter(x=>x.orgId===a.orgId&&x.coachId===a.sub&&x.clientId===clientId).map(v=>clone(v));
  }
  requestDataDeletion(actor,input) {
    const {a}=this.requireClient(actor);
    fields(input,['requestId','confirmation']);
    if(input.confirmation!=='REQUEST_MY_DATA_DELETION')
      error(422,'VALIDATION','Explicit deletion request confirmation required');
    const requestId=uuid(input.requestId,'Request ID');
    const key=a.orgId+':'+a.sub+':'+requestId;
    const existing=this.store.deletionRequests.get(key);
    if(existing) return {record:clone(existing),reused:true};
    const record={requestId,orgId:a.orgId,clientId:a.sub,status:'pending_owner_review',
      requestedAt:this.now()};
    this.store.deletionRequests.set(key,record);
    this.audit(a,'DATA_DELETION_REQUESTED',requestId);
    // No deletion occurs without a provider-specific retention and backup policy.
    return {record:clone(record),reused:false};
  }
  ownDeletionRequests(actor) {
    const {a}=this.requireClient(actor);
    return [...this.store.deletionRequests.values()].filter(x=>x.orgId===a.orgId&&x.clientId===a.sub).map(v=>clone(v));
  }
  clientExport(actor) {
    const {a}=this.requireClient(actor);
    this.audit(a,'CLIENT_DATA_EXPORTED',a.sub);
    return {
      exportVersion:1,exportedAt:this.now(),ownerId:a.sub,
      assignments:[...this.store.assignments.values()]
        .filter(x=>x.orgId===a.orgId&&x.clientId===a.sub)
        .map(assignment=>({assignment:clone(assignment),program:clone(this.programForAssignment(assignment))})),
      workouts:[...this.store.workouts.values()].map(x=>x.record).filter(x=>x.clientId===a.sub&&x.orgId===a.orgId).map(clone),
      checkins:[...this.store.checkins.values()].map(x=>x.record).filter(x=>x.clientId===a.sub&&x.orgId===a.orgId).map(clone)
    };
  }
}
