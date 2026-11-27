// Staging-only durable coaching repository using Node 22's built-in SQLite.
// Validates transaction and restart behavior; NOT a production deployment,
// encryption layer, multi-node service, or replacement for private cloud storage.
// NODE_ENV=test gate prevents accidental real-client usage.
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {chmodSync, existsSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {CoachingService, InMemoryCoachingStore} from './domain.mjs';

const schema = 'CREATE TABLE IF NOT EXISTS staging_state ('+
  "id TEXT PRIMARY KEY CHECK (id = 'synthetic-test-only'),"+
  'revision INTEGER NOT NULL CHECK (revision > 0),'+
  'payload TEXT NOT NULL CHECK (length(payload) < 10000000),'+
  'checksum TEXT NOT NULL CHECK (length(checksum) = 64),'+
  'saved_at TEXT NOT NULL)';
const hash = value => createHash('sha256').update(value).digest('hex');
const FIELDS = ['members','programs','programVersions','assignments','workouts','checkins','deletionRequests'];
function serialize(store) {
  const out = {};
  for (const name of FIELDS) out[name] = [...store[name].entries()];
  out.exerciseCatalog=[...store.exerciseCatalog.values()];
  out.audit=structuredClone(store.audit);
  return JSON.stringify(out);
}
function deserialize(payload) {
  const doc=JSON.parse(payload);
  const store=new InMemoryCoachingStore();
  for (const name of FIELDS) {
    if(!Array.isArray(doc[name])||doc[name].length>10000)
      throw new Error('Invalid staging database records');
    store[name]=new Map(doc[name]);
  }
  if(!Array.isArray(doc.exerciseCatalog)||doc.exerciseCatalog.length>10000 ||
    !Array.isArray(doc.audit)||doc.audit.length>100000)
    throw new Error('Invalid staging database catalog or audit');
  store.exerciseCatalog=new Set(doc.exerciseCatalog);
  store.audit=structuredClone(doc.audit);
  return store;
}
export class SyntheticSQLiteCoachingRepository {
  constructor(filePath, {now=()=>new Date().toISOString()} = {}) {
    if(process.env.NODE_ENV!=='test')throw new Error('Staging SQLite repository is disabled outside synthetic test mode');
    if(typeof filePath!=='string'||!filePath.endsWith('.sqlite'))
      throw new Error('Explicit synthetic .sqlite file path required');
    const target=resolve(filePath);
    mkdirSync(dirname(target),{recursive:true,mode:0o700});
    const existed=existsSync(target);
    this.db=new DatabaseSync(target);
    if(!existed)chmodSync(target,0o600);
    this.db.exec('PRAGMA busy_timeout=4000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    this.db.exec(schema);
    this.select=this.db.prepare("SELECT revision, payload, checksum FROM staging_state WHERE id='synthetic-test-only'");
    this.upsert=this.db.prepare("INSERT INTO staging_state(id,revision,payload,checksum,saved_at) VALUES ('synthetic-test-only',?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum,saved_at=excluded.saved_at");
    this.now=now;
  }
  transaction(fn) {
    if(typeof fn!=='function')throw new TypeError('Transaction callback required');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row=this.select.get();
      if(row && hash(row.payload)!==row.checksum)
        throw new Error('Staging coaching database checksum mismatch');
      const store=row?deserialize(row.payload):new InMemoryCoachingStore();
      const service=new CoachingService({store,now:this.now});
      const result=fn(service,store);
      if(result && typeof result.then==='function')
        throw new Error('Async work inside a synchronous transaction is forbidden');
      const payload=serialize(store);
      if(Buffer.byteLength(payload,'utf8')>9500000)
        throw new Error('Synthetic database safety limit reached');
      this.upsert.run((row?.revision||0)+1,payload,hash(payload),this.now());
      this.db.exec('COMMIT');
      return structuredClone(result);
    } catch(e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  serviceProxy() {
    return new Proxy({}, {
      get:(_obj,method)=>{
        if(typeof method!=='string'||method==='then'||
          !Object.hasOwn(CoachingService.prototype,method)||
          method==='constructor')return undefined;
        return (...args)=>this.transaction(service=>service[method](...args));
      }
    });
  }
  inspect() {
    const row=this.select.get();
    if(!row)return {revision:0,hasState:false};
    if(hash(row.payload)!==row.checksum)
      throw new Error('Staging database checksum mismatch');
    return {revision:row.revision,hasState:true};
  }
  close(){this.db.close()}
}
