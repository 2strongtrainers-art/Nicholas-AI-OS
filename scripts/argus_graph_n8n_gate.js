/* ARGUS event-graph gate — n8n Code node; no network calls, secrets, or writes.
 * Manually triggered owner-private case only. A structurally valid graph is NOT
 * independently verified geopolitical intelligence or evidence of causation.
 */
(function () {
  "use strict";
  const fail = () => { throw new Error("ARGUS_GRAPH_VALIDATION_BLOCKED"); };
  const obj = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const str = v => typeof v === "string" && v.trim().length > 0;
  const stamp = v => str(v) && /^\d{4}-\d\d-\d\dT/.test(v) &&
    /(Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
  const day = v => {
    if (typeof v !== "string" || !/^\d{4}-\d\d-\d\d$/.test(v)) return null;
    const ms = Date.parse(v + "T00:00:00Z");
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === v ? ms : null;
  };
  // n8n Cloud Code task runners do not necessarily expose global URL.
  // Strict ASCII HTTPS source-link validation without built-ins or network.
  const urlOK = v => {
    if (!str(v) || v.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(v)) return false;
    const match = /^https:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(v);
    if (!match) return false;
    const host = match[1];
    if (host.length > 253 || host.includes("@") || host.includes(":")) return false;
    const labels = host.split(".");
    return labels.length >= 2 &&
      labels.every(x => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(x)) &&
      /[A-Za-z]/.test(labels[labels.length - 1]);
  };
  const packet = $input.first().json;
  if (!obj(packet) || !obj(packet.graph)) fail();
  const g = packet.graph;
  if (g.schema !== "argus.event-graph.v1" ||
    !stamp(g.cutoff) || !["owner-private", "synthetic-public"].includes(g.visibility) ||
    !Array.isArray(g.sources) || !Array.isArray(g.events) ||
    !Array.isArray(g.relationships)) fail();
  if (g.events.length < 1 || g.events.length > 10000 ||
    g.sources.length < 1 || g.sources.length > 10000 ||
    g.relationships.length > 50000) fail();
  const cutoff = day(g.cutoff.slice(0, 10));
  if (cutoff === null) fail();
  const sources = new Map(), events = new Map();
  for (const s of g.sources) {
    if (!obj(s) || !str(s.id) || sources.has(s.id) || !str(s.title) ||
      !str(s.publisher_family) || !urlOK(s.url)) fail();
    sources.set(s.id, s);
  }
  for (const e of g.events) {
    if (!obj(e) || !str(e.id) || events.has(e.id) || !str(e.title) ||
      !str(e.summary) || !str(e.review_status) ||
      !["day", "range", "uncertain"].includes(e.precision) ||
      !Array.isArray(e.tags) || e.tags.some(t => !str(t)) ||
      !Array.isArray(e.source_ids) || !e.source_ids.length ||
      new Set(e.source_ids).size !== e.source_ids.length ||
      e.source_ids.some(sid => !sources.has(sid)) ||
      day(e.occurred_on) === null || day(e.occurred_on) > cutoff) fail();
    if (e.occurred_to !== undefined && (day(e.occurred_to) === null ||
      day(e.occurred_to) < day(e.occurred_on))) fail();
    events.set(e.id, e);
  }
  const relationTypes = new Set(["Shared subject", "Temporal sequence", "Documented interaction", "Hypothesis"]);
  const reviews = new Set(["candidate", "reviewed", "rejected"]);
  const levels = new Set(["unassessed", "low", "moderate", "high"]);
  const ids = new Set(), pairs = new Set();
  for (const r of g.relationships) {
    if (!obj(r) || !str(r.id) || ids.has(r.id) ||
      !str(r.source_event_id) || !str(r.target_event_id) ||
      !events.has(r.source_event_id) || !events.has(r.target_event_id) ||
      r.source_event_id === r.target_event_id ||
      !relationTypes.has(r.type) || !reviews.has(r.review_status) ||
      !levels.has(r.confidence) || !str(r.assertion) || r.assertion.length < 15 ||
      !Array.isArray(r.source_ids) || !r.source_ids.length ||
      r.source_ids.some(s => !sources.has(s))) fail();
    ids.add(r.id);
    const pair = [r.source_event_id, r.target_event_id, r.type].join("|");
    if (pairs.has(pair)) fail();
    pairs.add(pair);
    const a = events.get(r.source_event_id), b = events.get(r.target_event_id);
    const context = a.tags.filter(t => b.tags.includes(t));
    const endpointSources = new Set([...a.source_ids, ...b.source_ids]);
    if (r.source_ids.some(s => !endpointSources.has(s))) fail();
    if (["Shared subject", "Temporal sequence"].includes(r.type) && !context.length) fail();
    if (r.type === "Temporal sequence" && day(a.occurred_on) > day(b.occurred_on)) fail();
    const families = new Set(r.source_ids.map(s => sources.get(s).publisher_family.trim().toLowerCase()));
    if (r.review_status === "reviewed" && families.size < 2) fail();
    if (r.type === "Documented interaction" && (r.review_status !== "reviewed" || families.size < 2)) fail();
    if (r.type === "Hypothesis" && r.review_status !== "candidate") fail();
  }
  const executionId = (typeof $execution !== "undefined" && str(String($execution.id || ""))) ?
    String($execution.id) : "simulation";
  const isLiveReceipt = /^[1-9]\d{0,15}$/.test(executionId);
  const asOf = new Date().toISOString();
  const metrics = {
    events: g.events.length, sources: g.sources.length, event_links: g.relationships.length,
    evidence_edges: g.events.reduce((n, e) => n + e.source_ids.length, 0),
    candidate_links: g.relationships.filter(r => r.review_status === "candidate").length,
    reviewed_links: g.relationships.filter(r => r.review_status === "reviewed").length
  };
  const deliver = "normalized_output_prepared; acknowledgment_not_observed";
  const status = "STRUCTURAL_PASS_REVIEW_REQUIRED";
  const version = ["argusgraph-v1", g.cutoff.slice(0, 10), metrics.events, metrics.sources,
    metrics.event_links, executionId].join("-");
  const snapshot = {
    run_id: "argusgraph-" + executionId,
    as_of: asOf,
    coverage: { github: "partial" },
    items: [{
      source: "github",
      id: "argus-graph-human-review",
      version,
      title: "ARGUS structural graph passed; independent analyst review required",
      next_step: "Check claims and candidate event links; independently verify this n8n execution before Chief acceptance.",
      url: "https://github.com/2strongtrainers-art/Nicholas-AI-OS/blob/main/docs/ARGUS_EVENT_GRAPH_V1.md",
      observed_at: asOf,
      due_at: null,
      direction: "owner_action",
      priority: "high"
    }]
  };
  return [{ json: {
    schema: "trivalley.argus-graph-chief-handoff.v1", status,
    review_status: "HUMAN_REVIEW_REQUIRED", evidence_class: "SOURCE_INDEXED_UNVERIFIED",
    observed_at: asOf, graph_cutoff: g.cutoff, metrics,
    n8n_execution_id: isLiveReceipt ? executionId : null,
    receipt_state: isLiveReceipt ? "LIVE_EXECUTION_ID_OBSERVED" : "SIMULATED_NO_EXECUTION_ID",
    chief_delivery: deliver, chief_snapshot: snapshot,
    limitations: [
      "This gate checks structural consistency only, not evidence truth or actor attribution.",
      "No reviewed link is automatically causal.",
      "No Chief acknowledgment, message, external action or publication was performed."
    ]
  }}];
})();
