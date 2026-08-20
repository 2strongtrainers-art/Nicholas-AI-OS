# Free AI 8 — Zero-Spend-First Automation Stack

This stack turns eight AI/business tools into one coordinated operating system while keeping vendor lock-in, duplicate work, and accidental spend to a minimum.

## Operating principle

The system must keep functioning even when optional third-party AI accounts are unavailable. ChatGPT is the supervisory control plane. GitHub/Nicholas-AI-OS is the durable execution/audit layer. HubSpot owns CRM truth. Apollo owns prospect discovery. Dify, Fish Audio, MiniMax, Qoder, and Freebuff are accelerators, not single points of failure.

## The eight tools and one job each

1. **ChatGPT — Supervisor / QA / decision layer**
   - Routes work, uses connected apps, checks outputs, handles exceptions, and runs scheduled monitoring.

2. **HubSpot Free — CRM source of truth**
   - Contacts, companies, deals, lifecycle state, tasks, landing pages.
   - Writes remain subject to the connector's required confirmation rules.

3. **Apollo Free — Prospect discovery**
   - Net-new people discovery and zero-credit searches where possible.
   - Paid enrichment and real outbound activation remain explicitly gated.

4. **Dify Sandbox / Community — Optional workflow engine**
   - Useful for branching, tool calls, retries, and model routing once separately authenticated.
   - The autonomous core must continue without Dify.

5. **Fish Audio — Optional voice layer**
   - TTS for reels, explainers, client updates, and sales content.
   - The current `s2.1-pro-free` developer window is treated as temporary and hard-gated by date/terms checks.

6. **MiniMax — Optional multimodal fallback**
   - Text/video/audio only when a verified free allowance exists or spending is explicitly enabled.
   - Disabled by default.

7. **Qoder — Optional code QA / repo agent**
   - Automated PR review after its PAT/GitHub App is authorized.
   - CI and merge safety do not depend on it.

8. **Freebuff — Human-started coding assistant only**
   - Useful for free interactive coding/prototyping.
   - Its free-service terms prohibit bot/script/headless automation, so it is never part of unattended jobs.

## Autonomous core that is live without new vendor accounts

- ChatGPT connected-app supervision and scheduled monitoring.
- HubSpot read access and review-gated writes through the connected account.
- Apollo free search capacity and credit/spend guardrails.
- GitHub Actions CI, daily health checks, audit trail, and cost kill switches.
- Futurepedia high-ROI AI scan scheduled daily in ChatGPT.

This means the system degrades gracefully: if Dify, Fish, Qoder, MiniMax, or Freebuff are unavailable, the core research, QA, monitoring, code testing, and routing functions continue.

## Core pipelines

### Revenue Engine
Apollo free people search -> qualification/ranking -> HubSpot duplicate check -> review-gated CRM write -> personalized outreach draft -> explicit approval before irreversible enrollment/sending -> response/follow-up tracking.

### Inbound Lead Engine
Landing page/form -> HubSpot -> deterministic qualification -> optional Dify scoring -> high-value lead review -> follow-up/booking.

### Content Engine
Topic/research -> ChatGPT outline/QA -> script -> Fish TTS when free/approved -> optional MiniMax visuals only when policy permits -> publish package -> performance feedback.

### Build Engine
Feature request -> Nicholas-AI-OS branch -> CI/tests -> optional Qoder review -> optional human-started Freebuff session -> PR -> ChatGPT/Codex QA -> verified merge.

## Non-negotiable guards

- Default monthly AI API budget: **$0**.
- No secrets in source control.
- No paid API call unless `ALLOW_PAID_AI=true`.
- No Apollo credit-spending enrichment unless explicitly approved.
- No automatic cold-email activation.
- HubSpot remains canonical for leads/customers.
- Dedupe before CRM creation.
- Log automated decisions and provider usage.
- Freebuff is human-initiated only; unattended invocation is prohibited.
- Fish free API access is blocked after its verified free window until revalidated.
- MiniMax is disabled in strict zero-spend mode.

## Live status — 2026-08-19

- **HubSpot:** connected. CONTACT/COMPANY/DEAL/TASK/LANDING_PAGE write capability exists, but the portal's own onboarding is incomplete and the connector exposes no onboarding action in this chat.
- **Apollo:** connected. 200 lead credits and 5,000 AI credits were available in the current cycle when checked; no sequences existed. Credit spending remains disabled by policy.
- **Futurepedia scan:** active daily, replacing the lower-ROI Weekend Long Read task so the automation limit is respected.
- **Dify / Fish / Qoder / Freebuff / MiniMax:** no direct ChatGPT connectors are currently available. Gmail also showed no existing account/verification mail for these providers, so no existing authorization could be recovered.
- **Qoder:** workflow is installed and will activate automatically once a Qoder PAT is added; CI remains independent.
- **Freebuff:** kept interactive-only because its terms prohibit autonomous/headless operation.
- **MiniMax:** kept disabled because its general API is metered rather than permanently free.

## External authorization boundary

The only remaining non-automatable step is first-party account authorization for providers that require a browser sign-in, OAuth consent, or a secret created inside the vendor account. ChatGPT cannot manufacture those credentials or accept third-party terms on the user's behalf when no account-creation connector is exposed.

After any optional credential is added to the prepared GitHub/Dify secret slot, the existing code can use it without redesigning the stack.

## Success metric

One request enters once, every service receives only the minimum information it needs, the lowest-cost capable route is chosen automatically, provider failures do not break the system, irreversible actions remain properly gated, and the final state is auditable in HubSpot/GitHub.
