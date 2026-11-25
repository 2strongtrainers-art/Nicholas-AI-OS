// Adapted from workflows/n8n/global-intel-readonly-handoff.json.
// Upstream blob: e2713a00eb78558ace0c68d02fcd455fdbbd78fa. Retain the original schema and fail-closed rules.
export const SOURCE_URL = "https://2strongtrainers-art.github.io/Nicholas-AI-OS/data/events.json";
const MAX_BYTES = 4 * 1024 * 1024;
export function normalizeSnapshot(d, nowMs = Date.now()) {
  const fail = () => { throw new Error("GLOBAL_INTEL_SCHEMA_INVALID"); };
  const obj = x => x !== null && typeof x === "object" && !Array.isArray(x);
  const isoUTC = x => typeof x === "string" && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(x) && Number.isFinite(Date.parse(x));
  const originalUrl = "https://2strongtrainers-art.github.io/Nicholas-AI-OS/data/events.json";
  if (!obj(d) || d.schema !== "trivalley.global-intel.v1" ||
      !["OK","DEGRADED"].includes(d.status) || !isoUTC(d.generated_at) ||
      !Array.isArray(d.source_health) || d.source_health.length < 1 || d.source_health.length > 20 ||
      !Array.isArray(d.events) || d.events.length > 300 ||
      !Array.isArray(d.connections) || d.connections.length > 12) fail();
  for (const f of d.source_health) {
    if (!obj(f) || typeof f.name !== "string" || f.name.length > 80 ||
        !["ok","error"].includes(f.state) || !Number.isSafeInteger(f.count) || f.count < 0) fail();
  }
  const sourceAt = Date.parse(d.generated_at);
  const age = nowMs - sourceAt;
  const timely = age >= -120000 && age < 8 * 60 * 60 * 1000;
  const healthy = d.source_health.filter(f => f.state === "ok" && f.count > 0);
  const family = name => /^GDELT\b/.test(name) ? "GDELT" : name;
  const families = [...new Set(healthy.map(f => family(f.name)))].sort();
  const status = !timely ? "BLOCKED_STALE" :
     families.length < 2 || d.status === "DEGRADED" ? "DEGRADED_SOURCE_COVERAGE" :
     "READY_FOR_HUMAN_REVIEW";
  const reason = !timely ? "snapshot_outside_8h_window" :
      families.length < 2 ? "insufficient_distinct_source_families" :
      d.status === "DEGRADED" ? "some_feeds_unavailable" : "public_feed_read_only";
  const receiptKey = "global-intel-" + d.generated_at.replace(/\D/g,"");
  const execId = null; // A Worker never fabricates an n8n execution ID.
  const nextStep = status === "READY_FOR_HUMAN_REVIEW"
    ? "Review attributed public signals and independently verify each material conclusion; do not infer coordination."
    : status === "BLOCKED_STALE"
    ? "Refresh the public GitHub Pages snapshot; do not use stale headlines for current threat assessments."
    : "Audit missing upstream sources before assigning geopolitical or market implications; preserve coverage limitations.";
  const now = new Date(nowMs).toISOString();
  const snapshot = {
    run_id: "global-intel-" + d.generated_at.replace(/\D/g,""),
    as_of: now,
    coverage: {github:"partial"},
    items: [{
      source:"github", id:"global-intel-public-readonly",
      version:receiptKey + ":" + status,
      title:"GLOBAL INTELLIGENCE DESK — " + status,
      next_step:nextStep, url:originalUrl, observed_at:d.generated_at,
      due_at:null, direction:"owner_action",
      priority: status === "READY_FOR_HUMAN_REVIEW" ? "normal" : "high"
    }]
  };
  return [{json:{
    schema:"trivalley-global-intel-chief-review-v1",
    receipt_key:receiptKey, observed_at:now, source_generated_at:d.generated_at,
    n8n_execution_id:execId,
    state:status, reason_code:reason, source_families:families,
    healthy_feeds:healthy.length, feed_count:d.source_health.length,
    indexed_signals:d.events.length, candidate_links:d.connections.length,
    candidate_classification:"CANDIDATE_ONLY_NOT_CAUSATION",
    attribution:"GDELT automated coding and public reporting; agency-curated USGS/NASA and official Federal Reserve/other announcements",
    evidence_url:originalUrl,
    github_source:"https://github.com/2strongtrainers-art/Nicholas-AI-OS/tree/main/intel-desk",
    chief_delivery:"normalized_output_prepared; acknowledgment_not_observed",
    chief_snapshot:snapshot,
    interpretation:"Co-mentions are research leads; agency coordinates do not describe complete impact zones.",
    approval_state:"REVIEW_REQUIRED", outbound_actions:0, money_spent_usd:0
  }}];
}

const respond = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}
});
const digest = s => crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
async function authorized(request, secret) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ") || header.length > 519) return false;
  const [a,b] = await Promise.all([digest(header.slice(7)),digest(secret)]);
  let mismatch = 0;
  const left = new Uint8Array(a), right = new Uint8Array(b);
  for (let i=0; i<left.length; i++) mismatch |= left[i]^right[i];
  return mismatch === 0;
}
async function readBoundedJson(response) {
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length)>MAX_BYTES)) throw Error("UPSTREAM_SIZE");
  const reader = response.body?.getReader();
  if (!reader) throw Error("UPSTREAM_BODY");
  let total = 0;
  const decoder = new TextDecoder("utf-8", {fatal:true});
  const parts = [];
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw Error("UPSTREAM_SIZE");
      parts.push(decoder.decode(value,{stream:true}));
    }
    parts.push(decoder.decode());
    return JSON.parse(parts.join(""));
  } catch (error) {
    await reader.cancel().catch(()=>{});
    throw error;
  } finally { reader.releaseLock(); }
}
export async function handleRequest(request, env, {fetchImpl=fetch, nowMs=Date.now()}={}) {
  const {pathname,search} = new URL(request.url);
  if (search || (pathname !== "/health" && pathname !== "/review")) return respond({error:"NOT_FOUND"},404);
  if (request.method !== "GET") return respond({error:"METHOD_NOT_ALLOWED"},405);
  if (pathname === "/health") return respond({service:"trivalley-intel-review",runtime:"cloudflare-worker",mode:"manual-read-only",version:1});
  const secret = env?.INTEL_REVIEW_TOKEN;
  if (typeof secret !== "string" || secret.length < 32 || secret.length > 512 || /\s/.test(secret)) return respond({error:"REVIEW_NOT_CONFIGURED"},503);
  if (!(await authorized(request,secret))) return respond({error:"UNAUTHORIZED"},401);
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),10000);
  try {
    const upstream = await fetchImpl(SOURCE_URL,{method:"GET",redirect:"error",signal:controller.signal,headers:{accept:"application/json"},cache:"no-store"});
    if (!upstream.ok || !/^application\/json(?:\s*;|$)/i.test(upstream.headers.get("content-type")||"")) throw Error("UPSTREAM_RESPONSE");
    const data = await readBoundedJson(upstream);
    return respond(normalizeSnapshot(data,nowMs)[0].json);
  } catch {
    return respond({error:"REVIEW_BLOCKED_UPSTREAM_OR_SCHEMA",approval_state:"REVIEW_REQUIRED",chief_delivery:"acknowledgment_not_observed"},502);
  } finally { clearTimeout(timer); }
}
export default {fetch(request,env){return handleRequest(request,env);}};
