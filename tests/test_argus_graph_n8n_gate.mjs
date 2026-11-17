import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const js = readFileSync(path.join(ROOT, "scripts/argus_graph_n8n_gate.js"), "utf8");
const fixture = JSON.parse(readFileSync(path.join(ROOT, "tests/fixtures/argus-event-graph.synthetic.json"), "utf8"));
const workflow = JSON.parse(readFileSync(path.join(ROOT, "workflows/n8n/argus-graph-chief-gate.json"), "utf8"));
const copy = obj => JSON.parse(JSON.stringify(obj));
function run(graph, id = "121") {
  const context = {$input: {first: () => ({json: {graph}})}, $execution: id === null ? undefined : {id}, URL};
  return vm.runInNewContext(js, context, {timeout: 2500})[0].json;
}
function blocked(graph) { assert.throws(() => run(graph), /ARGUS_GRAPH_VALIDATION_BLOCKED/); }

test("stage contains no live credentials or external service actions", () => {
  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes.length, 3);
  assert.deepEqual(workflow.nodes.map(n => n.type),
    ["n8n-nodes-base.manualTrigger","n8n-nodes-base.set","n8n-nodes-base.code"]);
  assert.equal(workflow.nodes[2].parameters.jsCode, js);
  assert.equal(JSON.parse(workflow.nodes[1].parameters.jsonOutput).graph.visibility, "synthetic-public");
  assert.ok(!workflow.nodes[1].parameters.jsonOutput.includes("owner-private"));
  assert.ok(!workflow.nodes.some(n => /webhook|httpRequest|email|executeCommand|dataTable/i.test(n.type)));
});

test("sanitized structural-only Chief packet with n8n execution", () => {
  const result = run(copy(fixture), "121");
  assert.equal(result.status, "STRUCTURAL_PASS_REVIEW_REQUIRED");
  assert.equal(result.review_status, "HUMAN_REVIEW_REQUIRED");
  assert.equal(result.metrics.events, 3);
  assert.equal(result.metrics.sources, 2);
  assert.equal(result.metrics.event_links, 1);
  assert.equal(result.metrics.evidence_edges, 3);
  assert.equal(result.n8n_execution_id, "121");
  assert.equal(result.receipt_state, "LIVE_EXECUTION_ID_OBSERVED");
  assert.equal(result.chief_delivery, "normalized_output_prepared; acknowledgment_not_observed");
  assert.equal(result.chief_snapshot.items[0].priority, "high");
  assert.equal(JSON.stringify(result).includes("Fictional harbor"), false);
});

test("simulation lacks live runtime evidence", () => {
  const result = run(copy(fixture), null);
  assert.equal(result.receipt_state, "SIMULATED_NO_EXECUTION_ID");
  assert.equal(result.n8n_execution_id, null);
});

test("orphan event, cross-theater link, bad source, reversed chronology and inferred causation block", () => {
  for (const mutate of [
    d => {d.relationships[0].target_event_id = "no-event";},
    d => {d.relationships[0].target_event_id = "evt-c";},
    d => {d.events[0].source_ids = ["missing"];},
    d => {d.sources[0].url = "http://example.org/plain";},
    d => {d.relationships[0].source_event_id="evt-b";d.relationships[0].target_event_id="evt-a";},
    d => {d.relationships[0].type = "Caused";}
  ]) {const doc=copy(fixture);mutate(doc);blocked(doc);}
});

test("link sources must be attributable to one of its two endpoints", () => {
  const doc=copy(fixture);
  doc.sources.push({id:"source-3",title:"Extraneous record",publisher_family:"Fictional",url:"https://example.org/third"});
  doc.relationships[0].source_ids=["source-3"];
  blocked(doc);
});

test("reviewed link requires multiple publisher families", () => {
  const doc=copy(fixture);
  doc.relationships[0].source_ids=["source-1"];
  doc.relationships[0].review_status="reviewed";
  blocked(doc);
});

test("hypothesis cannot be auto promoted", () => {
  const doc=copy(fixture);
  doc.relationships[0].type="Hypothesis";
  doc.relationships[0].review_status="reviewed";
  blocked(doc);
});

test("empty graph and future event block", () => {
  const a=copy(fixture);a.events=[];blocked(a);
  const b=copy(fixture);b.events[0].occurred_on="2027-01-30";blocked(b);
});
