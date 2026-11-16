# n8n Mesh — safe staging templates

Canonical issue: https://github.com/2strongtrainers-art/Nicholas-AI-OS/issues/170

Status: **one staged source repair; real n8n import/replay remains to be verified.** The owner's existing n8n draft ID `KonVvZYGI1NQlGEt` was previously imported with a malformed classifier and three invalid Upsert branches; a private structural backup exists in ChatGPT Library. Do not label live production accepted before n8n version/readback and serial receipt-table replay. Hermes is out of scope.

## New templates

- `mesh-run-triage.json`: inactive manual-only GitHub metadata triage plus **one** keyed metadata receipt Upsert into existing private n8n Data Table `mesh_receipts_v1` (`xBXICbM5r7KDV1qv`). Real source success remains UNVERIFIED until an artifact is independently reviewed. The Upsert is intended to keep serial replays of the same run ID/attempt on one row. This source-side configuration is not proof that the currently saved n8n workflow was repaired or that actual rows were persisted.
- `mesh-error-receiver.json`: inactive Error Trigger that sanitizes errors to fixed codes. It contains no send, retry, Data Table write or alert destination. n8n Error Triggers must be connected to another published workflow and tested using an actual failed execution; manual execution does not emulate it.

## Activation gates in the real owner workspace

1. Sign into the intended owner n8n Cloud project via a supported secure browser or access-specific integration. Current ChatGPT connector has no authenticated n8n operations. Inspect existing active Wix intake and reel workflows and backups FIRST.
2. Import both templates into a **staging project**, leave inactive, inspect nodes and expressions. Do not publish or connect a duplicate production webhook/schedule.
3. Manually run triage only against the intended owner GitHub repository. If 401/403, use a supported scoped read-only GitHub credential rather than relaxing security. Confirm no successful job is called verified. Test replay, newest attempt and blocked status.
4. Optionally attach a small private receipt Data Table (`receipt_key`, `source_ref`, `status`, `reason_code`, `observed_at`, `evidence_link`) AFTER controlled import. Use an upsert keyed by receipt_key; for concurrent high-volume events use a transactional dedupe backend, because a check-then-write is not an atomic lock.
5. Publish the error receiver only after a staged controlled failed workflow proves sanitized output. Connect ONE non-client workflow via workflow Settings > Error Workflow and verify no secret/body/stack is emitted. Preserve existing error handling.
6. Require an independently verified GitHub artifact, market data quality record, ARGUS forensic fixture or playable MP4 before upgrading an UNVERIFIED source status. A GitHub green run alone is not acceptance. Chief receipt must be observed, not inferred.
7. Inspect n8n Security Audit, plan/concurrency, credential scope and execution data retention before switching production. Preserve the working Wix intake, consent gates and existing reel approvals.

No extra real-time schedule, autonomous model call, brokerage order, production webhook, external media upload, SMS or publication is introduced by these files.

Official docs: https://docs.n8n.io/hosting/securing/security-audit/ and https://docs.n8n.io/workflows/executions/all-executions/ .


## Exact n8n restoration gate (November 16)

The owner has approved repairing the **existing inactive draft workflow**, not creating a parallel client-facing scheduled workflow. An authenticated n8n read of `KonVvZYGI1NQlGEt` returned version `952c3140-d45d-4c56-bc17-c2e4ce58691e`, six nodes including three malformed Upserts, and a classifier that incorrectly rejects normal run IDs (`r.id>1` instead of `r.id<1`). Private backup: `/TriValley/Work Handoffs/n8n_live_triage_config_structural_snapshot_2026-11-16.json`. It is a structural snapshot, not a byte-identical native export; download a native backup first if available.

Once the reviewed JSON is on `main`, in **the same existing n8n draft** use the n8n editor menu **Import from URL** using the exact raw GitHub file, verify four nodes and only **one** classifier output, save while keeping the draft inactive, then read back the saved n8n API document and compare the classifier and table mapping. Run the manual-only workflow serially twice, verify the receipt table has one row per `receipt_key` with the same total unique count on replay, and save actual execution IDs and timestamped row evidence in Issue #170. If the import would create a new workflow instead of replacing the existing draft, STOP and reconcile; don't publish clones. Upsert is not an atomic lock across parallel workflows; this first pilot remains manual and serialized. 
