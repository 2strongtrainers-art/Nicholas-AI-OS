# Nicholas AI Switchboard

Private routing layer for using Ox Alpha and Qwen from a ChatGPT custom GPT while keeping native ChatGPT available as `/openai`.

## Architecture

`ChatGPT custom GPT -> GPT Action -> Cloudflare Worker -> OpenRouter -> selected model`

The worker does not replace ChatGPT's native model. It gives the custom GPT an explicit external-model action.

## Routes

- `GET /health` — public liveness check.
- `GET /openapi.json` — public, self-hosted OpenAPI schema for the GPT Action editor.
- `GET /privacy` — plain-language privacy notice.
- `GET /models` — authenticated live alias resolution.
- `POST /ask` — authenticated model request.

Aliases:

- `ox` — live Ox Alpha model from OpenRouter; current fallback is `stealth/ox-alpha`.
- `qwen` — newest detected Qwen generation, preferring the largest flagship variant within that generation; current fallback is `qwen/qwen3.8-2.4t-a95b`.
- `auto` — `openrouter/auto`.
- `openai` is intentionally not an API alias. The custom GPT instructions tell ChatGPT to answer natively for `/openai`.

## Required Cloudflare secrets

Never commit these values.

```bash
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put SWITCHBOARD_API_KEY
```

`SWITCHBOARD_API_KEY` should be a new random secret used only between the private GPT Action and this worker.

Optional Worker variables/secrets:

- `OX_MODEL` — pins an exact OpenRouter Ox model if needed.
- `QWEN_MODEL` — pins an exact OpenRouter Qwen model if needed.
- `OPENROUTER_SITE_URL` — attribution URL sent to OpenRouter.
- `OPENROUTER_APP_NAME` — defaults to `Nicholas AI Switchboard`.

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

## ChatGPT custom GPT

In the GPT editor:

1. Create a private GPT named **Nicholas AI Switchboard**.
2. Paste the contents of `GPT_INSTRUCTIONS.md` into Instructions.
3. Under Actions, create a new action.
4. Import the deployed Worker's `https://YOUR-WORKER.workers.dev/openapi.json` URL.
5. Configure Action authentication as **API key -> Bearer** and enter the same `SWITCHBOARD_API_KEY` stored in Cloudflare.
6. Keep the GPT private/workspace-only while testing.
7. In Preview, test `/ox Return exactly OX_SWITCHBOARD_READY` and `/qwen Return exactly QWEN_SWITCHBOARD_READY`.
8. Ask `which models are active?` and verify the exact `resolved_model` values returned by `/models`.

OpenAI's GPT editor is the only part of this setup that cannot be configured by repository code. The backend, schema, model resolution, routing rules, and Mac launcher are kept in this repository.

## Privacy

Only explicitly routed requests should leave ChatGPT for OpenRouter. Do not send passwords, API secrets, financial account data, medical records, or private client data through external-model routes unless disclosure is deliberate and appropriate.

Ox Alpha is a third-party stealth model. Provider handling can differ from OpenAI's handling of native ChatGPT conversations.
