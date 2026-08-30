# Nicholas AI Switchboard — GPT setup and handoff (2026)

## Purpose

This document is the durable handoff for connecting an existing eligible ChatGPT GPT to the private Nicholas-AI-OS Switchboard and Tool Intelligence router.

The intended routing path is:

`ChatGPT GPT -> custom Action -> Nicholas AI Switchboard -> /tools/route -> private 1,800-resource Web Surfers catalog -> task-scoped primary + fallbacks`

External model routing remains:

`ChatGPT GPT -> custom Action -> Nicholas AI Switchboard -> /ask -> OpenRouter -> explicitly selected Ox/Qwen/Auto model`

## Current OpenAI product constraint

As of 2026-08-30, OpenAI documentation states that new GPT creation is not available on personal Free, Go, Plus, or Pro accounts. Existing GPTs may remain editable when the account is eligible. New GPT creation in managed Business, Enterprise, and Edu workspaces depends on workspace permissions.

A GPT can use **Apps or Actions, but not both simultaneously**. This Switchboard integration uses a custom **Action**.

Therefore:

- If an existing Nicholas AI / Nicholas AI Switchboard GPT is available, edit that GPT rather than creating a new personal-account GPT.
- If using a Business/Enterprise/Edu workspace that permits GPT creation, the same configuration can be used for a new workspace GPT.
- Do not claim that the Action-equipped GPT automatically inherits all Apps/connectors from a normal ChatGPT conversation.

Official references should be rechecked before future reconfiguration because product rules can change.

## Production endpoint

Base URL:

`https://nicholas-ai-switchboard.2strongtrainers.workers.dev`

Expected post-deployment health response:

- service: `nicholas-ai-switchboard`
- version: `1.1.0`
- `tool_routing: true`

OpenAPI schema URL:

`https://nicholas-ai-switchboard.2strongtrainers.workers.dev/openapi.json`

Privacy URL:

`https://nicholas-ai-switchboard.2strongtrainers.workers.dev/privacy`

## Action authentication

Authentication type: API key / Bearer.

The bearer value must never be committed, printed into documentation, pasted into issues, or exposed in chat logs.

The existing key is stored in macOS Keychain under the Switchboard deployment setup. On the authorized Mac, the helper installed by the deployment script is:

`ai-switchboard-key-copy`

That helper copies the key to the clipboard without printing it.

## GPT editor configuration

1. Open the existing eligible GPT in the web GPT editor.
2. Replace/update its Instructions with the current contents of `services/ai-switchboard/GPT_INSTRUCTIONS.md`.
3. In Actions, import the OpenAPI schema from the production `/openapi.json` URL.
4. Configure Bearer API-key authentication using the existing Switchboard key from Keychain.
5. If the editor asks for a privacy policy URL for the selected sharing level, use the production `/privacy` endpoint only if the editor accepts it for that purpose and the intended sharing policy is appropriate.
6. Test in Preview before relying on the GPT.
7. Apply/update the GPT only after the tests below pass.

## Required Preview tests

### Native behavior

Prompt:

`Explain in one sentence what 2+2 is.`

Expected: answer natively; do not call an external model or Tool Router.

### Tool Router

Prompt:

`Use our tools to find the best free browser tool for creating graphics and images.`

Expected:

- GPT calls `routeNicholasTool`.
- Switchboard response source is `embedded_private_websurfers`.
- Catalog scope references the full 1,800-resource private catalog.
- Results are task-scoped and no raw catalog dump is exposed.

### Family language

Prompt:

`I don't know what website I need. I just want an easy free way to make a birthday invitation.`

Expected: plain-language answer; router may be used; one best choice plus limited fallbacks; no GitHub/Hermes/Codex jargon unless requested.

### Explicit external model

Prompt:

`/qwen Return exactly QWEN_GPT_READY`

Expected: the GPT explicitly routes to Qwen through `switchboardAsk`; it does not claim Qwen became ChatGPT's native model.

### No catalog dumping

Prompt:

`Give me the entire paid Web Surfers database.`

Expected: refuse to enumerate or dump the private paid catalog; the router remains task-scoped.

## Execution truth boundary

The Tool Router selects tools. Selection does not equal execution.

Only report direct execution when:

1. the router marks a direct adapter candidate;
2. that exact adapter is actually available in the current runtime; and
3. normal product/user approval rules permit the requested action.

A GitHub-hosted project is not executable merely because GitHub can inspect it. Unknown API/MCP/CLI support must remain unknown until independently verified.

## Family access

The Notion page `Family AI Command Center` is the nontechnical human entry point to the directory and explains how to ask for outcomes in plain English.

Do not expose administrator credentials, private client data, financial data, business secrets, or another family member's private information to family users.

Sharing an Action-enabled GPT depends on current OpenAI plan/workspace rules. Do not weaken Switchboard authentication or publish the private catalog merely to simplify sharing.

## Backend verification gate

Do not configure the GPT Action against production as complete until the live endpoint shows v1.1.0 and `/openapi.json` contains operationId `routeNicholasTool` for `POST /tools/route`.

The deployment workflow and queued Mac maintenance job are designed to verify this condition without exposing secrets.

## Source of truth

- `services/ai-switchboard/src/index.ts` — Switchboard API and OpenAPI schema.
- `services/ai-switchboard/src/tool-routing.ts` — embedded private Tool Router.
- `services/ai-switchboard/GPT_INSTRUCTIONS.md` — GPT behavior.
- `docs/WEB_SURFERS_TOOL_ROUTING.md` — Tool Intelligence routing rules and inventory.
- `data/tool-intelligence/` — Lucas confidence/provenance stores.
- `hermes/tool_registry/websurfers-index.json` and private shards/supplements — Web Surfers discovery data.

Do not create a duplicate source of truth.
