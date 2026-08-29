# Parallel Work Coordination

This repository is sometimes edited concurrently by multiple ChatGPT/Codex/Hermes sessions. Treat live `main` as the reconciliation point, not the memory or branch state of any individual session.

## Before changing an existing subsystem

1. Fetch the current `main` head.
2. Inspect open pull requests and recent commits touching the target paths.
3. Read the authoritative files listed below.
4. Start new work from current `main` unless the task explicitly owns an existing active branch.
5. If `main` advances during the work, inspect the new commit before merging and reconcile overlapping changes.
6. Never overwrite stronger evidence, a newer canonical registry or an unrelated status/heartbeat update merely to make a branch merge cleanly.
7. Run existing CI plus new regression tests before merging.

## Tool Intelligence / Web Surfers / Lucas

Authoritative sources:

- `data/tool-intelligence/canonical-tools.json` — Confirmed Lucas mappings.
- `data/tool-intelligence/probable-review.json` — Probable, review only.
- `data/tool-intelligence/pending-evidence.json` — unresolved evidence only.
- `hermes/tool_registry/websurfers-index.json` + `hermes/tool_registry/websurfers/` — private Web Surfers discovery catalog.
- `scripts/nicholas_tool_router.py` — repository-side reconciled router.
- `services/ai-switchboard/src/tool-routing.ts` — private Switchboard task router.

Rules:

- Never create a second canonical Lucas registry.
- Web Surfers data can rank a candidate; it cannot independently prove a Lucas Part.
- Confirmed may be canonical provenance. Probable stays review-only. Pending remains identity-free.
- Unknown API/MCP/CLI support is not execution capability.
- A platform/hosting connector is not an execution adapter for every product hosted there.
- The paid catalog is private routing data; never add a list/dump endpoint.

Current design as of 2026-08-29:

- paid catalog: **1,800 valid resource records / 1,501 normalized domains** from AI, Design, Education and Gaming directories;
- 64 records are on connector-related domains, while 21 are conservatively classified as direct-connector candidates for the listed service itself;
- Switchboard `POST /tools/route` is authenticated, task-scoped and returns at most five results;
- embedded full-catalog selection is the default;
- `TOOL_ROUTER_URL` is only an optional private override;
- execution requires the current runtime to explicitly report the actual service adapter live;
- consequential side effects remain governed by repository/runtime approval policy.

## AI Switchboard

Authoritative implementation:

- `services/ai-switchboard/src/index.ts`
- `services/ai-switchboard/src/tool-routing.ts`
- `services/ai-switchboard/GPT_INSTRUCTIONS.md`
- `services/ai-switchboard/README.md`

Preserve `/ox`, `/qwen`, `/auto`, native `/openai`, debate behavior, bearer authentication, privacy rules and the top-N tool-routing boundary unless a task explicitly changes them.

## OpenMontage / worker status

Status/heartbeat files may advance independently while another branch is open. Preserve the latest `main` status rather than restoring an older branch copy.

## Merge checklist

- Branch is based on or reconciled with current `main`.
- No duplicate source of truth was introduced.
- No parallel-session change was silently reverted.
- Existing tests still pass.
- New behavior has deterministic validation where practical.
- CI/build is green.
- External deployment preview succeeds when supported.
- Production is not claimed verified unless a production-specific signal or live check confirms it.
