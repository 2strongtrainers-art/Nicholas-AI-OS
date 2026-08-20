# Free AI 8 — Zero-Spend-First Automation Stack

This stack turns eight AI/business tools into one operating system without duplicating responsibilities.

## Design rule

ChatGPT is the supervisory control plane. GitHub/Nicholas-AI-OS is durable wiring and version control, not a ninth AI product. HubSpot owns CRM truth. Apollo owns prospect discovery. Dify owns repeatable automation. Fish Audio owns voice. MiniMax is an optional metered multimodal fallback. Qoder and Freebuff are development agents that work against the same repository rather than separate production systems.

## The eight tools and exactly one job each

1. **ChatGPT — Supervisor / QA / decision layer**
   - Chooses workflow, reviews outputs, uses connected HubSpot/Apollo/GitHub tools, and handles exceptions.
   - Never stores the canonical lead/customer database.

2. **HubSpot Free — CRM source of truth**
   - Contacts, companies, deals, lifecycle stages, tasks, landing pages.
   - Every qualified lead ultimately lands here.

3. **Apollo Free — Prospect discovery**
   - Net-new people/company discovery and zero-credit searches where possible.
   - Credit-spending enrichment and real outbound sends remain gated.

4. **Dify Sandbox / Community — Workflow engine**
   - Triggers, branching, tool calls, model routing, retries, logging.
   - Use rule-based nodes before LLM calls to conserve free message credits.

5. **Fish Audio — Voice layer**
   - TTS for reels, explainers, client updates, and sales content.
   - Developer free API is treated as temporary and policy-gated.

6. **MiniMax — Optional multimodal fallback**
   - Text/video/audio only when free credits are available or spending is explicitly enabled.
   - Disabled by default in zero-spend mode.

7. **Qoder — Primary code QA / repo agent**
   - GitHub PR review, implementation support, security/test checks.
   - Uses the same Nicholas-AI-OS repo and AGENTS/rules as every other coding agent.

8. **Freebuff — Secondary free coding agent**
   - Rapid implementation/prototyping on low-sensitivity work.
   - Never becomes the source of truth; all accepted changes return to GitHub.

## Core automated pipelines

### Revenue Engine

Apollo zero-credit people search -> qualification/ranking -> HubSpot dedupe/upsert -> deal/task creation -> personalized outreach draft -> human approval before irreversible sending -> response tracked in HubSpot -> follow-up queue.

### Inbound Lead Engine

Landing page/form -> HubSpot contact -> Dify qualification -> lead score -> task/deal -> ChatGPT review for high-value leads -> booking/follow-up.

### Content Engine

Topic/research -> Dify outline -> ChatGPT QA -> script -> Fish Audio TTS -> optional MiniMax visual generation only when budget policy allows -> packaged content -> performance data back to HubSpot/content analytics.

### Build Engine

Feature request -> Nicholas-AI-OS issue/branch -> Qoder review + Freebuff optional implementation -> automated tests -> PR -> ChatGPT/Codex QA -> merge after verified checks.

## Non-negotiable guards

- Default monthly AI API budget: **$0**.
- No secret keys in source control.
- No paid API call unless `ALLOW_PAID_AI=true`.
- No Apollo enrichment or organization search that spends credits without an explicit budget rule and approval.
- No automatic cold-email activation; outbound content may be prepared automatically but activation/sending remains approval-gated.
- HubSpot is canonical for leads/customers. Apollo is not the CRM.
- Dedupe before creating CRM records.
- Log every automated decision and provider used.
- Sensitive/proprietary code should prefer Qoder/GitHub workflows over ad-supported Freebuff.
- Fish free developer API expires/changes; the health workflow must flag this before use.
- MiniMax is disabled in strict zero-spend mode.

## Current live-account status discovered 2026-08-19

- HubSpot: connected; CONTACT/COMPANY/DEAL/TASK/LANDING_PAGE writes available. Portal onboarding is incomplete. Only sample contacts were present when checked.
- Apollo: connected; no sequences yet. Current cycle showed 200 lead credits and 5,000 AI credits available; direct-dial credits were exhausted.
- ChatGPT scheduled-task capacity: currently full at 5 active tasks, so GitHub/Dify should carry recurring automation until a task slot is freed.
- Qoder, Freebuff, Dify, Fish Audio, MiniMax: no direct ChatGPT connector was found; they must connect through GitHub, API keys, or Dify plugins.

## Deployment order

1. Finish HubSpot onboarding and define lifecycle/deal stages.
2. Create Dify Sandbox account/workspace and import/build workflows.
3. Add provider secrets to GitHub/Dify secret stores, never source.
4. Connect Qoder to the Nicholas-AI-OS repo and add Qoder PAT as a GitHub Actions secret.
5. Install Freebuff CLI only for low-sensitivity development tasks.
6. Create Fish API key; enable the free developer model only while terms/availability allow.
7. Leave MiniMax disabled until a free allowance or approved budget exists.
8. Run health check; then enable automation one pipeline at a time.

## Success metric

The stack is working when one lead/content/build request enters once, every tool receives only the information it needs, duplicate work is eliminated, costs remain within policy, and the final result returns to the correct system of record with a complete audit trail.
