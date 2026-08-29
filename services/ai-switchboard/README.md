# Nicholas AI Switchboard

Private routing layer for using Ox/GLM and Qwen from a ChatGPT custom GPT, plus task-scoped selection across the private Web Surfers / Nicholas-AI-OS Tool Intelligence catalog.

## Architecture

External-model routing:

`ChatGPT custom GPT -> GPT Action -> Cloudflare Worker -> OpenRouter -> selected model`

Tool selection:

`ChatGPT/runtime -> POST /tools/route -> Switchboard -> embedded private 1,414-resource catalog -> primary tool + limited fallbacks`

The Worker does not replace ChatGPT's native model. It gives the custom GPT explicit external-model actions and a private tool-selection contract.

## Routes

- `GET /health` — public liveness check.
- `GET /openapi.json` — public, self-hosted OpenAPI schema for the GPT Action editor.
- `GET /privacy` — plain-language privacy notice.
- `GET /models` — authenticated live alias resolution.
- `POST /ask` — authenticated external-model request.
- `POST /tools/route` — authenticated, task-scoped tool selection. Returns at most five allow-listed results and has no catalog-list/dump mode.

## Tool-routing behavior

The Worker contains the compressed private Web Surfers catalog directly. When `/tools/route` is called, it decodes and caches the catalog, ranks all 1,414 resource records, deduplicates canonical URLs, and returns only the small requested result set.

The repository-side canonical router remains `scripts/nicholas_tool_router.py`. Lucas provenance remains separate and authoritative in:

- `data/tool-intelligence/canonical-tools.json` — Confirmed Lucas mappings;
- `data/tool-intelligence/probable-review.json` — review-only mappings;
- `data/tool-intelligence/pending-evidence.json` — unresolved evidence with no speculative website identity.

The paid Web Surfers directory can help choose candidate tools. It does not prove a Lucas Part number.

Example request:

```json
{
  "task": "create a social media design in Canva",
  "runtime_adapters": ["Canva"],
  "limit": 3,
  "include_paid": true
}
```

`runtime_adapters` must contain only adapters the caller has actually verified are live in the current runtime. A directory match, domain match, or connector name never makes a tool executable by itself.

Normal embedded responses use:

`source = "embedded_private_websurfers"`

This means the Worker ranked the full private 1,414-resource catalog but returned only the task-scoped top results.

### Optional private-router override

`TOOL_ROUTER_URL` is optional. When configured, the Worker may ask that private HTTPS service to rank the task first. Its response is still stripped to the same allow-listed maximum-five-result schema. If the optional upstream router is absent or unavailable, the embedded full catalog remains the default; no second service is required.

### Selection is not execution

The Switchboard custom GPT is action-based. Tool selection through `/tools/route` does not install or activate third-party ChatGPT connectors. Actual connector execution must occur in a ChatGPT/runtime context where that connector is available and authorized. The route response therefore keeps `website_name`, `direct_connector`, `runtime_adapter_live`, and `can_execute_now` separate.

Unknown API/MCP/CLI availability is never guessed.

## Model aliases

- `ox` — live Z.AI GLM successor route from OpenRouter.
- `qwen` — newest detected Qwen generation, preferring the largest flagship variant within that generation; current fallback is `qwen/qwen3.8-2.4t-a95b`.
- `auto` — `openrouter/auto`.
- `openai` is intentionally not an API alias. The custom GPT instructions tell ChatGPT to answer natively for `/openai`.

## Required Cloudflare secrets

Never commit these values.

```bash
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put SWITCHBOARD_API_KEY
```

Optional Worker variables/secrets:

- `OX_MODEL`
- `QWEN_MODEL`
- `OPENROUTER_SITE_URL`
- `OPENROUTER_APP_NAME`
- `TOOL_ROUTER_URL` — optional HTTPS override router base URL;
- `TOOL_ROUTER_SHARED_SECRET` — optional bearer secret for that override.

## Deploy and verify

```bash
cd services/ai-switchboard
npm install
npm run typecheck
npm run deploy
```

Then verify public surfaces:

```bash
curl https://YOUR-WORKER.workers.dev/health
curl https://YOUR-WORKER.workers.dev/openapi.json
```

Verify authenticated tool routing without printing the key into shared logs/screenshots:

```bash
curl -X POST \
  -H "Authorization: Bearer $SWITCHBOARD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task":"create a social media design in Canva","runtime_adapters":["Canva"],"limit":3}' \
  https://YOUR-WORKER.workers.dev/tools/route
```

A successful embedded response should report `source: embedded_private_websurfers` and should never return more than five results.

## ChatGPT custom GPT

In the GPT editor:

1. Open the private **Nicholas AI Switchboard** GPT.
2. Paste the current `GPT_INSTRUCTIONS.md` into Instructions.
3. Under Actions, import the deployed Worker's `https://YOUR-WORKER.workers.dev/openapi.json`.
4. Configure Action authentication as **API key -> Bearer** with the same `SWITCHBOARD_API_KEY` stored in Cloudflare.
5. Test `/ox Return exactly OX_SWITCHBOARD_READY` and `/qwen Return exactly QWEN_SWITCHBOARD_READY`.
6. Ask `which tool should I use to create a social media design?` and verify the GPT calls `routeNicholasTool` rather than inventing a catalog result.

The GPT editor itself is not updated by repository commits; its action schema/instructions must reflect the deployed Worker before the new route can be invoked from that custom GPT.

## Privacy

Only explicitly routed external-model requests should leave ChatGPT for OpenRouter. Tool-routing requests remain inside the Switchboard unless the optional private-router override is configured.

The Worker has no endpoint that enumerates or dumps the paid Web Surfers membership catalog. The catalog is used as private routing data and responses are limited to task-scoped top results.
