# n8n Mesh — safe staging templates

Canonical issue: https://github.com/2strongtrainers-art/Nicholas-AI-OS/issues/170

Status: **SOURCE READY FOR REVIEW; NOT IMPORTED OR ACTIVE IN N8N CLOUD.** Hermes is out of scope.

## New templates

- `mesh-run-triage.json`: inactive, manual-only, read-only latest 50 GitHub Action run metadata records. All success is UNVERIFIED until an authenticated artifact/actual outcome is reviewed. Skipped, failed, pending and blocked are distinct. Stable per-run/attempt key supports deduplication, but this template DOES NOT persist any state or run external jobs.
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

