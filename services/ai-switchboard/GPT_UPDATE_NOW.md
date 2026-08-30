# Nick's Assistant / NK — Final v1.1 Action Update

Backend status: **LIVE**.

Verified production state:

- Switchboard version: `1.1.0`
- `tool_routing: true`
- Tool Action path: `POST /tools/route`
- Operation ID: `routeNicholasTool`
- Private Tool Intelligence scope: 1,800 resources / 1,501 normalized domains
- Production base: `https://nicholas-ai-switchboard.2strongtrainers.workers.dev`

## Existing GPT to update

Edit the existing **Nick's Assistant / NK / Nicholas AI Switchboard** GPT. Do not create a duplicate unless intentionally migrating to a different managed workspace.

## Final editor update

1. Open the existing GPT in the ChatGPT **web** editor.
2. Set Instructions to the current contents of `services/ai-switchboard/GPT_INSTRUCTIONS.md`.
3. Open its existing Switchboard **Action** and refresh/import this schema URL:

   `https://nicholas-ai-switchboard.2strongtrainers.workers.dev/openapi.json?v=1.1.0`

   The version query is intentional to avoid retaining a stale v1.0 schema response.
4. Confirm the detected Action list includes:
   - `switchboardHealth`
   - `switchboardModels`
   - `switchboardAsk`
   - `routeNicholasTool`
5. Preserve existing **API key / Bearer** authentication. If the editor requires the key again, run `ai-switchboard-key-copy` on the authorized Mac and paste the clipboard value directly into the Action authentication field. Never print or store the key in documentation.
6. Preview test:

   `Use our tools to find the best free browser tool for creating graphics and images.`

   Expected behavior: `routeNicholasTool` is called and the response is task-scoped. The GPT should not expose the raw paid catalog.
7. Save/Update the existing GPT.

## Family test

Prompt:

`I don't know what website I need. I just want an easy free way to make a birthday invitation.`

Expected: plain language, one best choice plus at most two fallbacks, no GitHub/API/Hermes/Codex jargon unless requested.

## Important platform boundary

The Action-equipped GPT uses the private Switchboard API. Current OpenAI product rules allow a GPT to use Apps or Actions, but not both simultaneously. Normal ChatGPT conversations can still use their connected Apps independently.
