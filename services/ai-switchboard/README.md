# Nicholas AI Switchboard

Private routing layer for Ox/GLM and Qwen plus task-scoped selection across Nicholas-AI-OS Tool Intelligence.

## Architecture

External models:

`ChatGPT custom GPT -> GPT Action -> Cloudflare Worker -> OpenRouter -> selected model`

Tool selection:

`ChatGPT/runtime -> POST /tools/route -> Switchboard -> private 1,800-resource Web Surfers catalog -> primary tool + limited fallbacks`

## Routes

- `GET /health` — public liveness check.
- `GET /openapi.json` — public self-hosted OpenAPI schema.
- `GET /privacy` — privacy notice.
- `GET /models` — authenticated model-alias resolution.
- `POST /ask` — authenticated external-model request.
- `POST /tools/route` — authenticated task-scoped tool selection, maximum five results and no list/dump mode.

## Tool-routing behavior

The Worker loads the historical compact AI/Design/Education catalog, filters two unnamed URL-only Design rows, appends the canonical Gaming supplement, and ranks **1,800 valid resources across 1,501 domains**.

Repository-side routing remains `scripts/nicholas_tool_router.py`. Lucas provenance remains authoritative and separate in:

- `data/tool-intelligence/canonical-tools.json`
- `data/tool-intelligence/probable-review.json`
- `data/tool-intelligence/pending-evidence.json`

Web Surfers membership can select candidates. It cannot prove a Lucas Part.

### Selection is not execution

`runtime_adapters` must contain only adapters actually known to be live. A platform connector is not considered an execution adapter for unrelated capabilities hosted on that platform. For example, GitHub can inspect a repository but cannot automatically execute the product represented by that repository.

The catalog currently has 64 records on connector-related domains, but only 21 records are conservatively marked as direct-connector candidates for the listed service itself. Canva, Figma, Notion, Replit, HeyGen, native ChatGPT and the GitHub service itself are examples when applicable.

Unknown API/MCP/CLI support is never guessed.

## Privacy

The Worker has no endpoint that enumerates or dumps the paid membership database. Responses expose only task-scoped top results. Consequential operations still follow normal product/user approval policy.

## Deploy and verify

```bash
cd services/ai-switchboard
npm install
npm run typecheck
npm run deploy
```

Then verify `/health`, `/openapi.json`, authenticated `/models`, and authenticated `/tools/route`.

A normal embedded route should report `source: embedded_private_websurfers` and `catalog_scope: full 1800-resource private catalog; task-scoped top results only`.

## Custom GPT

Import the deployed Worker's `/openapi.json` into the private Nicholas AI Switchboard GPT Action and keep bearer authentication aligned with `SWITCHBOARD_API_KEY`. Repository commits update the backend/schema/instructions, but the GPT Builder configuration itself must be refreshed separately when its imported schema or instructions change.
