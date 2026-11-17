# ARGUS event graph -> Chief of Staff: controlled deployment

## Status and provenance

This repository is PUBLIC. The real source-of-truth ARGUS conflict case, including 52
selected events, 50 source entries, 64 source-to-event citations, and six
candidate-only shared-subject links, remains owner-private. The old 37-event
mission was backed up separately inside private ARGUS before reconciliation.
No source graph, private case notes, passwords, private URLs or credential values
are committed here.

### Implemented layers

- scripts/argus_event_graph.py: Python reference validator, typed event
  and source references, GraphML output, unsupported-causality rejection.
- chief_of_staff/argus_graph_gate.py: private case integrity gate, canonical
  SHA-256 content fingerprint, sanitized receipt, normalized Chief snapshot.
- scripts/argus_graph_n8n_gate.js: n8n Code-node JavaScript second gate;
  blocks bad endpoint IDs, orphan sources, reversed timelines, irrelevant
  link sources, absent shared context and unsupported relationship types.
- workflows/n8n/argus-graph-chief-gate.json: synthetic sample only,
  manual trigger, INACTIVE. No outbound nodes, webhooks, API calls, email,
  publication, payments or credentials.
- scripts/build_argus_graph_n8n.py --check: prevents code drift between
  independently tested JavaScript and embedded n8n Code node.
- .github/workflows/argus-graph-chief-ci.yml: synthetic Python, JS,
  adversarial and Chief normalized-snapshot acceptance tests.

## Private execution

Do not commit, paste into GitHub Actions, or publish the actual case file.

In an authorized PRIVATE runtime, the owner can execute:

    python -m pip install -r requirements/argus-event-graph.txt
    python chief_of_staff/argus_graph_gate.py /private/argus-case.json \
      --receipt /private/argus-structural-receipt.json \
      --chief-snapshot /private/argus-chief-review.json
    python chief_of_staff/brief.py /private/argus-chief-review.json \
      --state /private/argus-chief-state.sqlite

The permitted success state is STRUCTURAL_PASS_REVIEW_REQUIRED. Even if graph
references, URLs, date ranges and source families are valid, the case remains
unverified for incident truth and causation. SHA-256 is a content fingerprint,
not a signed authenticity or actor-attribution certificate.

## n8n import / hosted acceptance

Target the ALREADY CONNECTED owner's n8n project; do not alter any existing
active Wix, intake, booking, reel, market, ARGUS image-forensics or Hermes flow.
Import the staging JSON once as an INACTIVE manual review workflow. The committed
Set node contains fabricated synthetic data, NOT private event details.

First verify a synthetic manual execution:
- the Code node returns a nonempty, sanitized Chief-compatible packet,
- receipt_state is LIVE_EXECUTION_ID_OBSERVED only if n8n has supplied an actual ID,
- chief_delivery remains 'normalized_output_prepared; acknowledgment_not_observed',
- a deliberately unrelated event link or orphan source causes a failed run.

Only then, in the owner's private n8n workspace, replace the synthetic Set
node with an explicitly reviewed private case payload. Never insert the case
in a public repo, public URL, public webhook, automated logs, or screenshots.
Keep the workflow manual and inactive until an actual authenticated execution
receipt, safe private input route, and downstream Chief acknowledgment are
observed. Then a separately reviewed trigger can be considered.

## Truthful acceptance labels

- CODE_READY: GitHub main-branch CI completed successfully.
- PRIVATE_CASE_STRUCTURAL_PASS: the real owner-private case passed Python
  integrity checks with expected 52 events / 50 sources / 6 candidate links.
- N8N_SYNTHETIC_PASS: hosted n8n execution ID proves the gate ran on synthetic data.
- N8N_PRIVATE_CASE_PASS: hosted n8n tested with authorized private case,
  sanitized output and no private data in an outbound/public channel.
- CHIEF_ACKNOWLEDGED: actual Chief consumed the specific reviewed packet.
- HUMAN_REVIEWED: an independent analyst checked incident facts, source
  independence, contradictory explanations and sensitive link claims.

Green code CI never implies the remaining hosted or human-review stages.
The n8n workflow does NOT automatically notify a Chief, publish a report,
execute trading, or establish casualty or attacker identity.

## MCP exposure / privacy guard

The synthetic-only staging template explicitly sets `settings.availableInMCP=false`.
Do not auto-expose the graph gate to n8n MCP clients. n8n documents that
instance-level MCP clients may discover and operate on enabled workflows.
Before any owner-private graph is placed into n8n, inspect workflow execution
retention and redaction availability and do not store raw private case payloads
in execution history. Consider sending a sanitized review receipt rather than
the raw source graph. The existing synthetic-only workflow may retain manual
execution history for QA.
