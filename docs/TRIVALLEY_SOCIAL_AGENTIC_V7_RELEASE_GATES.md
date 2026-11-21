# TriValley.fit — V7 Agentic Social Content & Learning Loop

**Owner requested:** durable Chief of Staff continuity, safe automatic production work and evidence-based iteration. **State:** implementation staged in DRAFT PR #188; NOT merged, scheduled as new workflow, or social-deployed. **Updated:** 2026-11-17, America/Los_Angeles.

## Canonical private evidence

The actual owner-photo Reel, 30-day draft source, 18 carousels, 3 Stories, 4 illustrative motion Reels, V6 QA hashes and scene candidate maps live in ChatGPT Library `/TriValley/Work Handoffs/TriValley_Content_Studio_V6_Production_Review.zip`.

V7 engine, tests and run receipts are in owner-private `/TriValley/Work Handoffs/TriValley_Social_Learning_V7_Tested_Implementation.zip`, with chief instructions in `TriValley_Social_Learning_V7_Chief_Handoff_2026-11-17.md`.

**Do not upload private portraits, original video files, client identities, ElevenLabs media or account tokens into this public repository.**

## Existing automation owners — no duplication

- The **existing Chief of Staff Briefing** runs weekdays at 03:00 and 12:00 Pacific; it should read the private V6/V7 handoffs, distinguish verified local packages from live outcomes, and report blocked gates and one owner decision.
- The **existing TriValley Weekly Business & Content Review** runs Fridays at 12:30 Pacific; it is the natural consumer for source-verified post metrics and the learning brief. It must not infer analytics from an unpublished Reel or run a paid workflow.
- Reuse the existing content-studio draft job, media renderer and n8n Reel review paths for authorized operations. No new cron, n8n webhook, duplicate Chief, automatic public releases or silent merges.

## State machine

`SOURCE_DISCOVERED → PRIVATE_DRAFT → MEDIA_QA → RIGHTS_CHECK → OWNER_REVIEW → OWNER_APPROVED → ACTUAL_POST_RECEIPT → 48H_METRICS → 7D_METRICS → TENTATIVE_HYPOTHESIS → NEXT_PRIVATE_DRAFT`.

If a step fails, report `BLOCKED`, not `DONE`. No automatic publish, spend, social DM, deletion or client data sharing. Exact source URLs, proof references and timestamps are mandatory for publishing/measurement claims.

## V7 tested learning implementation

- `scripts/social_learning.py`: read-only deterministic CSV analysis; produces `learning_receipt.json` + `learning_brief.md`.
- `tests/test_social_learning.py`: 9 local tests passed in isolated container, covering missing/invalid source metadata, blank vs zero values, duplicates, same-platform windows, stale evidence, no publishing.
- Input: user-private V6 30-day metric tracker extended with `approval_state, evidence_status, metrics_source, metrics_as_of_pacific, evidence_reference, hook_variant`. The actual CSV remains owner-private. The engine does not connect to a social account.
- Compares only 48-hour and seven-day windows from the **same platform**. Missing reach/saves/shares, unauthorized publication, invalid timestamps, sparse comparisons and stale data are rejected rather than fabricated. Source verification is declared by the operator and **not independently validated** by this script.
- When >=2 comparable posts on a platform each have >=100 reach, the engine proposes a **tentative** creative experiment. It never claims causal uplift, publishes drafts, or automatically trains model weights.
- In the real initial blank-data dry run: 3 candidate platform rows, **0 eligible**, status `INSUFFICIENT_VERIFIED_METRICS` — correct because the owner-private campaign was not published.
- A future Weekly review may consume these receipts **only when it actually retrieves/verifies platform evidence** and has runtime permission to execute scripts. Saved instructions by themselves are not evidence of autonomous ingestion.

## Known source/access blockers

- The separate personal `@kappy782` YouTube account is not authenticated in the current Google Studio session; no source MP4s. HAWC g is a separate gym-source rights case.
- Three Higgsfield source-video scene reports exist; their timestamps are AI analyses, not confirmed cut points.
- August Nick voice clone exists, but the new V6 narration attempt failed for insufficient credits. No custom voice is used in the photo Reel.
- Official Trinity knot master and permissions for other visible participants have not been verified.
- HubSpot Social channel and post-analytics requests currently return **missing Social permissions**; therefore there is no authenticated channel-level performance data.

## Acceptance to move beyond staged source

1. Run Python local tests and attach immutable CI receipt on the reviewed branch. **Passing tests do not prove platform connectivity.**
2. Chief genuinely reads the V6/V7 private handoff in a separately observed scheduled run and records the exact correlation key `trivalley-social-v7-agentic-20261117-verifiedlocal`.
3. Verify published post URL, exact approved media, destination/rights and receipt before writing any performance row.
4. Connect authorized Instagram/Facebook/YouTube insights, or supply source-authenticated exports, with consistent 48h/7d time windows.
5. Review tentative hypotheses; owner approves one-variable hook tests and any publication separately.
6. Only after independently observing the source-to-Chief receipt chain consider an n8n production hook. Don't create a competing scheduler by default.

**Never conflate a working local learner with an automatically deployed, continuously trained social platform agent.**
