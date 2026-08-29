# Nicholas AI OS — Agent Rules

## Mission
Build reliable, low-cost, auditable automation that increases revenue or meaningfully reduces repeated work.

## Mandatory priorities
1. Preserve correctness and source-of-truth data.
2. Default to zero-spend or lowest-cost capable provider.
3. Never expose secrets, tokens, credentials, private client data, or personal data in logs/source.
4. Prefer deterministic code/rules before model calls.
5. Verify writes and external side effects.
6. Make changes reversible and reviewable.
7. Never automate a provider in a way its terms prohibit.

## Parallel work safety
Multiple ChatGPT/Codex/Hermes sessions may edit this repository at the same time. Before changing an existing subsystem, read `docs/PARALLEL_WORK_COORDINATION.md`, fetch the live `main` head, inspect overlapping open PRs/recent commits, and reconcile any newer work before merge. Do not use a stale branch or remembered chat state as the source of truth when `main` has advanced.

## Cost controls
- `ALLOW_PAID_AI=false` means no metered AI provider may be invoked.
- `ALLOW_APOLLO_CREDIT_SPEND=false` means no Apollo endpoint that spends credits may be invoked.
- `ALLOW_OUTBOUND_SEND=false` means no automated outbound email/message may be sent.
- Never work around these kill switches.

## CRM / lead rules
- HubSpot is canonical for contacts, companies, deals, lifecycle stage, and follow-up state.
- Apollo is prospect discovery/enrichment, not the CRM.
- Dedupe by stable identifiers before writes.
- Do not enrich or reveal paid contact data automatically.
- Do not activate cold outreach automatically.
- When a connector requires explicit confirmation for a write, preserve that review gate rather than bypassing it.

## AI provider routing
- ChatGPT: supervisor, QA, connected-app actions, scheduled research/monitoring, exception handling.
- GitHub Actions: zero-spend-first unattended health checks, tests, audit trail, and deterministic jobs.
- Dify: optional repeatable workflow engine once separately authenticated; the core must not depend on it.
- Fish Audio: optional TTS only while a verified free/terms-safe API window exists.
- MiniMax: disabled unless a verified free allowance exists or paid-AI policy is explicitly enabled.
- Qoder: optional automated repo review once its PAT/GitHub App is authorized; CI must still work without it.
- Freebuff: HUMAN-INITIATED ONLY. Its free-service terms prohibit bot/script/headless automation. Never invoke it from unattended jobs, wrappers, or autonomous agents.

## Autonomy tiers
- Tier A — unattended and reversible: research, monitoring, tests, health checks, ranking, drafts, issue creation, logging.
- Tier B — approval-gated side effects: CRM writes, outbound enrollment/sending, publishing, paid enrichment, provider spend.
- Tier C — optional vendor accelerators: Dify, Fish Audio, Qoder, MiniMax, Freebuff. Failure or absence of any Tier C service must not break Tier A.

## Code review focus
- Validate all external inputs.
- Timeouts on all network calls.
- No secrets hardcoded or logged.
- Explicit error handling and fail-closed behavior.
- Idempotent/deduplicated external writes.
- Tests for cost guards and side-effect guards.
- Flag any code path that can spend money or send externally.
- Flag any unattended Freebuff invocation as a policy violation.

## Privacy
Free/ad-supported services may have different data-use terms. Do not send sensitive client, grant, financial, health, credential, or proprietary information to a provider unless its data handling is approved for that data class.

## Definition of done
A change is not complete until it is testable, cost policy is respected, provider terms are respected, side effects are gated, source-of-truth ownership is clear, and important outputs can be audited.
