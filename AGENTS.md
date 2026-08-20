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

## AI provider routing
- ChatGPT: supervisor, QA, connected-app actions, exception handling.
- Dify: repeatable workflow engine and routing.
- Fish Audio: TTS only while free/terms-safe policy permits.
- MiniMax: disabled unless paid-AI policy is explicitly enabled.
- Qoder: primary repo review/implementation agent.
- Freebuff: secondary agent for low-sensitivity work only.

## Code review focus
- Validate all external inputs.
- Timeouts on all network calls.
- No secrets hardcoded or logged.
- Explicit error handling and fail-closed behavior.
- Idempotent/deduplicated external writes.
- Tests for cost guards and side-effect guards.
- Flag any code path that can spend money or send externally.

## Privacy
Free/ad-supported services may have different data-use terms. Do not send sensitive client, grant, financial, health, credential, or proprietary information to a provider unless its data handling is approved for that data class.

## Definition of done
A change is not complete until it is testable, cost policy is respected, side effects are gated, source-of-truth ownership is clear, and important outputs can be audited.
