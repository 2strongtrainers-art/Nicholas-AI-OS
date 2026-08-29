# Nicholas AI Switchboard

Private routing layer for using Ox/GLM and Qwen from a ChatGPT custom GPT, plus a task-scoped tool-routing surface backed by the Nicholas-AI-OS Tool Intelligence system.

## Architecture

External-model routing:

`ChatGPT custom GPT -> GPT Action -> Cloudflare Worker -> OpenRouter -> selected model`

Tool selection:

`ChatGPT/runtime -> POST /tools/route -> Switchboard -> private Tool Router when configured -> primary tool + limited fallbacks`

The worker does not replace ChatGPT's native model. It gives the custom GPT explicit external-model actions and a private tool-selection contract.

## Routes

- `GET /health` — public liveness check.
- `GET /openapi.json` — public, self-hosted OpenAPI schema for the GPT Action editor.
- `GET /privacy` — plain-language privacy notice.
- `GET /models` — authenticated live alias resolution.
- `POST /ask` — authenticated model request.
- `POST /tools/route` — authenticated, task-scoped tool selection. Returns at most five allow-listed results and never exposes the paid catalog as a list/dump endpoint.

Model aliases:

- `ox` — live Z.AI GLM successor route from OpenRouter.
- `qwen` — newest detected Qwen generation, preferring the largest flagship variant within that generation; current fallback is `qwen/qwen3.8-2.4t-a95b`.
- `auto` — `openrouter/auto`.
- `openai` is intentionally not an API alias. The custom GPT instructions tell ChatGPT to answer natively for `/openai`.

## Tool-routing behavior

The full private discovery router is implemented in `scripts/nicholas_tool_router.py` and uses:

- the private Web Surfers catalog for candidate discovery;
- `data/tool-intelligence/canonical-tools.json` for Confirmed Lucas provenance;
- `data/tool-intelligence/probable-review.json` for review-only Lucas candidates;
- `data/tool-intelligence/pending-evidence.json` for unresolved evidence only.

The Switchboard endpoint accepts a task such as:

```json
{
  "task": "create a social media design in Canva",
  "runtime_adapters": ["Canva"],
  "limit": 3,
  "include_paid": true
}
```

`runtime_adapters` must contain only adapters the caller has actually verified are live in its current runtime. A directory match, domain match, or connector name never makes a tool executable by itself.

If `TOOL_ROUTER_URL` is configured, the Worker forwards the task to that private HTTPS router and then strips the response to an allow-listed, maximum-five-result schema before returning it. If the private router is not configured or is unavailable, the Worker falls back to a small connector-capable subset rather than pretending it searched all 1,414 Web Surfers resources.

### Important ChatGPT product boundary

The Switchboard custom GPT is action-based. Tool selection through `/tools/route` does not magically install or activate third-party ChatGPT connectors. Actual connector execution must occur in a ChatGPT/runtime context where that connector is available and authorized. The route response therefore separates `website_name` from `can_execute_now`.

## Required Cloudflare secrets

Never commit these values.

```bash
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put SWITCHBOARD_API_KEY
```

`SWITCHBOARD_API_KEY` should be a random secret used only between the private GPT Action and this worker.

Optional Worker variables/secrets:

- `OX_MODEL` — pins an exact OpenRouter Ox/GLM model if needed.
- `QWEN_MODEL` — pins an exact OpenRouter Qwen model if needed.
- `OPENROUTER_SITE_URL` — attribution URL sent to OpenRouter.
- `OPENROUTER_APP_NAME` — defaults to `Nicholas AI Switchboard`.
- `TOOL_ROUTER_URL` — HTTPS base URL of the private full-catalog tool-router service. The Worker calls `<base>/route`.
- `TOOL_ROUTER_SHARED_SECRET` — optional bearer secret used only between the Switchboard and the private tool-router service.

If `OX_MODEL` or `QWEN_MODEL` is set but that model disappears from the live OpenRouter catalog, the worker falls back to live family discovery rather than silently using an unavailable ID.

## Deploy

```bash
cd services/ai-switchboard
npm install
npm run typecheck
npm run deploy
```

Expected worker name: `nicholas-ai-switchboard`.

After deployment, verify:

```bash
curl https://YOUR-WORKER.workers.dev/health
curl https://YOUR-WORKER.workers.dev/openapi.json
```

Then verify authenticated model resolution without printing the key into logs or shared screenshots:

```bash
curl -H "Authorization: Bearer $SWITCHBOARD_API_KEY" \
  https://YOUR-WORKER.workers.dev/models?refresh=1
```

Verify tool routing without printing the key:

```bash
curl -X POST \
  -H "Authorization: Bearer $SWITCHBOARD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task":"create a social media design in Canva","runtime_adapters":["Canva"],"limit":3}' \
  https://YOUR-WORKER.workers.dev/tools/route
```

## ChatGPT custom GPT

In the GPT editor:

1. Create or open the private **Nicholas AI Switchboard** GPT.
2. Paste the contents of `GPT_INSTRUCTIONS.md` into Instructions.
3. Under Actions, import the deployed Worker's `https://YOUR-WORKER.workers.dev/openapi.json` URL.
4. Configure Action authentication as **API key -> Bearer** and enter the same `SWITCHBOARD_API_KEY` stored in Cloudflare.
5. Keep the GPT private/workspace-only while testing.
6. Test `/ox Return exactly OX_SWITCHBOARD_READY` and `/qwen Return exactly QWEN_SWITCHBOARD_READY`.
7. Ask `which models are active?` and verify the exact `resolved_model` values returned by `/models`.
8. Ask `which tool should I use to create a social media design?` and verify the GPT calls `routeNicholasTool` rather than inventing a catalog result.

The GPT editor is the only part of this setup that repository code cannot update automatically. Backend code, schema, model resolution, routing policy, tests, and deployment configuration are maintained here.

## Privacy

Only explicitly routed external-model requests should leave ChatGPT for OpenRouter. Do not send passwords, API secrets, financial account data, medical records, or private client data through external-model routes unless disclosure is deliberate and appropriate.

Tool-routing responses are deliberately task-scoped. The Worker has no endpoint that returns the entire paid Web Surfers membership catalog, and upstream router responses are reduced to an allow-listed top-N schema before being returned.
