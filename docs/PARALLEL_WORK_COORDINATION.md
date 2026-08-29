# Parallel Work Coordination

This repository is sometimes edited concurrently by multiple ChatGPT/Codex/Hermes sessions. Treat live `main` as the reconciliation point, not the memory or branch state of any individual session.

## Before changing an existing subsystem

1. Fetch the current `main` head.
2. Inspect open pull requests and recent commits touching the target paths.
3. Read the authoritative files listed below.
4. Start new work from current `main` unless the task explicitly owns an existing active branch.
5. If `main` advances during the work, inspect the new commit before merging. Reconcile it when paths or behavior overlap.
6. Never overwrite a stronger evidence record, a newer canonical registry, or another session's unrelated status/heartbeat update just to make a branch merge cleanly.
7. Run the subsystem's existing CI plus any new regression tests before merging.

## Tool Intelligence / Web Surfers / Lucas

Authoritative sources:

- `data/tool-intelligence/canonical-tools.json` — Confirmed Lucas mappings.
- `data/tool-intelligence/probable-review.json` — Probable, review only.
- `data/tool-intelligence/pending-evidence.json` — unresolved evidence only.
- `hermes/tool_registry/websurfers-index.json` + `hermes/tool_registry/websurfers/` — private Web Surfers discovery catalog.
- `scripts/nicholas_tool_router.py` — repository-side reconciled router.
- `services/ai-switchboard/src/tool-routing.ts` — private Switchboard task router.

Rules:

- Never create a second canonical Lucas registry when these files already exist.
- Web Surfers identity/capability data can rank a candidate; it cannot independently prove a Lucas Part number.
- Confirmed may be treated as canonical provenance. Probable remains review-only. Pending remains identity-free until stronger evidence exists.
- Unknown API/MCP/CLI support is not execution capability.
- The paid Web Surfers catalog is private routing data. Do not add a public list/dump endpoint.

Current design as of 2026-08-29:

- paid catalog: 1,414 resource records / 1,173 normalized domains;
- Switchboard `POST /tools/route`: authenticated and task-scoped, maximum five results;
- embedded full-catalog selection is the default inside the private Worker;
- `TOOL_ROUTER_URL` is only an optional private override;
- connector execution is enabled only when the current caller/runtime explicitly reports that adapter live;
- consequential side effects remain governed by repository/runtime approval policy.

## AI Switchboard

Authoritative implementation:

- `services/ai-switchboard/src/index.ts`
- `services/ai-switchboard/src/tool-routing.ts`
- `services/ai-switchboard/GPT_INSTRUCTIONS.md`
- `services/ai-switchboard/README.md`

Before editing, preserve `/ox`, `/qwen`, `/auto`, native `/openai`, debate behavior, bearer authentication, privacy rules, and the tool-routing response boundary unless the task explicitly changes them.

## OpenMontage / worker status

Status/heartbeat files may advance independently while another branch is open. Treat those updates as unrelated unless the target task changes the worker itself. Preserve the latest `main` status rather than restoring an older branch copy.

## Merge checklist

- Branch is based on or reconciled with current `main`.
- No duplicate source of truth was introduced.
- No parallel-session change was silently reverted.
- Existing tests still pass.
- New behavior has a regression test or deterministic validation where practical.
- CI/build is green.
- External deployment preview succeeds when the subsystem supports previews.
- Production is not claimed verified unless a production-specific signal or live check confirms it.
