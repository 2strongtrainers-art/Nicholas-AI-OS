# One Chief evidence handoff — manual, staging only

**Status: source staged; not imported or executed in the live n8n workspace.** This is the *one* review aggregation step for selected workflows, **not** another autonomous agent or a replacement for the existing ARGUS or reel pipelines.

## Purpose

A request chooses the minimum appropriate research/production route (see [WORKFLOW_ROUTER.md](../WORKFLOW_ROUTER.md)). Existing tools execute under their own explicit permissions. Their actual results flow through the appropriate **specialist** n8n review workflow, not directly to a public Chief endpoint. This manual aggregator receives sanitized reviewed packets, creates one deterministic `chief_of_staff.brief`-compatible snapshot, and leaves Chief acknowledgment **unobserved** until the actual owner/Chief consumes that exact output.

Import [mesh-chief-reviewed-handoff.json](../workflows/n8n/mesh-chief-reviewed-handoff.json) into an authorized **staging** project only. It is `active:false`, has a **manual** trigger, one Edit Fields input and one Code node. There are **no webhooks, schedules, generic command runners, credentials, HTTP requests, send nodes, external uploads or Data Table writes.**

## Current specialist sources

| Workflow | Input to this aggregator | Truthful boundary |
| --- | --- | --- |
| ARGUS image-forensics | `{kind:"argus", handoff:<complete output from existing ARGUS verification n8n code node>}` | The existing flow verifies current GitHub metadata and reader-reviewed artifact. The aggregator checks the fixed synthetic assertions and keeps `VERIFIED_SYNTHETIC` separate from full deployment. |
| Repository category | `{kind:"repo_category", index_receipt:{status:"SOURCES_INDEXED_NOT_DEPLOYED",n8n_execution_id:"<actual>", observed_at:"<ISO UTC>", commit_sha:"<actual SHA40>",indexed_sources:<actual integer>}}` | Manual/read-only indexing only. A source pin does **not** become an installed tool. The referenced n8n execution must actually exist and be reviewed. |
| Market Desk | `{kind:"market_desk",market_receipt:{status:"BLOCKED",reason:"SKIPPED_NO_ALPACA_DATA_CREDENTIALS",run_id:"<actual>",run_attempt:<actual>,commit_sha:"<actual SHA40>",observed_at:"<ISO UTC>",orders_sent:0}}` | Safe failure metadata only. No read of actual Alpaca bars or paper replay has been proved by this record. Later accepted outcomes require a separately reviewed contract change. |

**Do not type in an invented execution ID or copy a status from an earlier attempt.** Only paste fully sanitized, accurately reviewed outputs from the intended owner workspace. The ARGUS input is the **complete actual result** of the existing `ARGUS | Manual Verification Receipt to Chief` node, not a manually typed success claim.

### Actual ARGUS authentication evidence as of November 16

GitHub [run 43788561521, attempt 2](https://github.com/2strongtrainers-art/Nicholas-AI-OS/actions/runs/43788561521/attempts/2) returned `ARGUS_SYNTHETIC_PASS`: HTTP 401 unauthenticated, HTTP 200 authenticated, expected 69-byte PNG SHA-256 `5731a25f0c25c4e8b515f273b778da29ec74369400f93551a68507d5dacf77c3`, ExifTool PNG/1×1 and no sensitive metadata. The 705-byte GitHub artifact archive `argus-verification-43788561521-2` has verified SHA-256 `477a86559b61a7a3cb9ff531824b50ca2dc9ccd2b95b7373b670cd2fde77515e`. This is synthetic endpoint acceptance, **not** evidence that the newer attempt is already entered into or acknowledged by n8n. A prior manual n8n execution **55** captured attempt **1's BLOCKED** receipt and must not be reused as success for attempt 2.

## How to use — manual acceptance sequence

1. Inspect existing live n8n Wix intake, reel and ARGUS review workflows. Preserve consent queues, existing schedules and paid-provider controls; do not clone production webhooks.
2. Run the **existing ARGUS verification handoff** in the authenticated owner n8n Cloud project using the actual downloaded attempt-2 archive and digest. Confirm the returned `schema=argus-chief-handoff-v1`, `status=VERIFIED_SYNTHETIC`, GitHub `run_attempt=2`, and actual retained n8n execution ID. Stop if they do not agree.
3. If the repository-category audit is included, independently inspect its retained manual read-only execution (historically #46); keep `SOURCES_INDEXED_NOT_DEPLOYED`.
4. In this **new staging manual** workflow, replace the Edit Fields JSON with the strict envelope:

```json
{
  "schema": "trivalley-chief-review-batch-v1",
  "batch_id": "nov16-review-unique-id",
  "as_of": "2026-11-16T20:00:00Z",
  "records": [
    {"kind":"argus","handoff":{"REPLACE":"with the complete validated existing ARGUS handoff JSON"}}
  ]
}
```

The example contains placeholders and **will fail validation**; do not present it as an executed receipt. Actual `as_of` must follow all evidence timestamps. Each kind appears at most once, with no unknown fields or raw client/media payloads. Batch ID and `as_of` must stay identical on an exact replay.
5. Manually execute and inspect the final node. Confirm exactly one `chief_snapshot` with a stable `mesh-BATCH_ID`, genuine GitHub links, one entry per kind, and `chief_delivery=normalized_output_prepared; acknowledgment_not_observed`. Unrecognized sources, forged ARGUS fixtures, malformed provenance, future evidence, duplicates or missing receipts fail closed.
6. Have the authorized Chief reader consume **that exact snapshot** into `python -m chief_of_staff.brief` using an owner-private state file, and replay it. Then separately record the observed Chief result and n8n execution URL. The aggregator does **not** transmit a result to a Chief service or prove an autonomous acknowledgment.

## One accurate completion report

The aggregator always returns `BLOCKED` if any approved input has a blocker/failure; otherwise `PARTIAL_VERIFICATION`. It deliberately does **not** emit a blanket `DEPLOYED` or `COMPLETE` status even if ARGUS's synthetic test passed. Each component retains its own `receipt_key`, bounded status, reason and proof label.

A genuinely unattended **one-request → allowed tool execution → n8n receipt → Chief acknowledgment → owner report** still requires a reviewed n8n account/connection, a narrow authenticated event intake, explicit approval, durable deduplication and observed scheduled/triggered end-to-end receipts. This staged code is the safer manual bridge until those checks succeed.

## Tests, access and rollback

The [n8n mesh CI](../.github/workflows/n8n-mesh-ci.yml) runs `node --test tests/test_n8n_mesh.mjs` including this new normalization. Synthetic tests do not establish a live n8n execution. Existing `mesh-run-triage.json` and `mesh-error-receiver.json` stay inactive. On any unexpected output, **do not publish** the new workflow; leave original production workflows unchanged. No new spending, market order, client contact, image upload or schedule is authorized.

Owner-only access for n8n is the remaining integration requirement. Keep API credentials in supported secrets/credentials controls, not GitHub source, n8n Set nodes, or chat.
