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

## Model review workflow

1. Collect and verify evidence once using connected tools and GitHub checks. Use native ChatGPT (`/openai` in NK) for routine review.
2. For an external second opinion on public evidence, choose `free` for OpenRouter's free router or `qwen-flash` for Qwen3.7 Flash. The Flash route caps provider rates at $0.10 input and $0.30 output per million tokens with no per-request fee. Free-model availability and quotas depend on OpenRouter.
3. Use `ox`, `qwen`, or `auto` for an explicit paid-capable request. The configured Ox and Qwen routes use their pinned IDs directly. For `/debate`, send each model the same brief in sequence. To block every model alias except `free` across deployments, set the Worker secret `ALLOW_PAID_AI` to `false` or declare that value in the Wrangler deployment configuration.
4. Allow 1,500 output tokens by default. Specify `max_tokens` for deeper reviews. On a 402 with a lower affordable allowance, the Worker tries once at that allowance. If OpenRouter identifies an oversized request without giving a count, it tries once at 750. Other credit, rate, and transport failures return directly.
5. Compare the actual `response_model`, `cost_usd`, `attempts`, and `truncated` fields. A missing cost is unknown. For a blocked call, use `limit_source`, `retry_after`, and any rate limit reset to choose the next action. Check [OpenRouter Credits](https://openrouter.ai/settings/credits) and [API Keys](https://openrouter.ai/settings/keys) before adding funds.

Atlas AI Council runs on demand. Its GitHub Action keeps each review in the evidence packet with the response model, cost, and completion status. It flags an incomplete council after saving the available results.

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
npm ci
npm run typecheck
npm test
npm run deploy
```

Then verify `/health`, `/openapi.json`, authenticated `/models`, and authenticated `/tools/route`.

The test suite runs the Worker with mocked OpenRouter responses. The production OpenAPI schema should list `free` and `qwen-flash` and advertise the 1,500-token default. Refresh NK's imported schema and instructions to expose the new commands there.

### Deploy from GitHub without the Mac

The **Deploy AI Switchboard on GitHub** workflow runs on demand from `main`. In the repo's `switchboard-production` GitHub environment, allow deployments from `main`, set the `CLOUDFLARE_ACCOUNT_ID` variable, and store a `CLOUDFLARE_API_TOKEN` secret with Editor access scoped to the existing `nicholas-ai-switchboard` Worker. The owner authorizes this connection once.

Resolve any queued or running Mac deployment before starting the GitHub-hosted workflow. The workflow tests the checked-out commit, inherits existing secrets and variables, copies the active KV bindings to the staged version, checks its binding manifest, then promotes the version. It verifies the live schema and bearer boundary without a model call and restores the prior version if verification fails and this run's version is still active. A missing Hermes queue or runner requires its own recovery. See [Cloudflare Worker token scopes](https://developers.cloudflare.com/workers/authorization/workers/) and [GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

A normal embedded route should report `source: embedded_private_websurfers` and `catalog_scope: full 1800-resource private catalog; task-scoped top results only`.

## Custom GPT

Import the deployed Worker's `/openapi.json` into the private Nicholas AI Switchboard GPT Action and keep bearer authentication aligned with `SWITCHBOARD_API_KEY`. Repository commits update the backend/schema/instructions, but the GPT Builder configuration itself must be refreshed separately when its imported schema or instructions change.
