# Nick's Assistant / NK — Final v1.2 Action Update

Backend status: **LIVE**.

Verified production state:

- Switchboard version: `1.2.0`
- Ox/Qwen/Auto routing: enabled
- Private Tool Intelligence routing: enabled
- Hermes persistent job routing: enabled
- Hermes profile: read-only research/reasoning
- Hermes queue: Cloudflare Workers KV -> authenticated Mac worker
- Private Tool Intelligence scope: 1,800 resources / 1,501 normalized domains
- Production base: `https://nicholas-ai-switchboard.2strongtrainers.workers.dev`

## Existing GPT to update

Edit the existing **Nick's Assistant / NK / Nicholas AI Switchboard** GPT. Do not create a duplicate unless intentionally migrating to a different managed workspace.

## Required platform choice

Use **Actions** for this GPT if the goal is to call Ox, Qwen, Auto, Hermes, and the private Tool Router through the Nicholas AI Switchboard.

Do not configure the same GPT to use the Rube/Composio App at the same time. Current ChatGPT product behavior allows a custom GPT to use Apps or external Actions, but not both simultaneously. Rube/connected Apps remain available from normal ChatGPT conversations independently.

## Final editor update

1. Open the existing GPT in the ChatGPT **web** editor.
2. Set Instructions to the current contents of `services/ai-switchboard/GPT_INSTRUCTIONS.md`.
3. Make sure this GPT is configured for **Actions**, not the Rube/Composio App.
4. Open its existing Switchboard **Action** and refresh/import this schema URL:

   `https://nicholas-ai-switchboard.2strongtrainers.workers.dev/openapi.json?v=1.2.0`

   The version query is intentional to avoid retaining a stale v1.0/v1.1 schema response.
5. Confirm the detected Action list includes all six operations:
   - `switchboardHealth`
   - `switchboardModels`
   - `switchboardAsk`
   - `routeNicholasTool`
   - `createHermesJob`
   - `getHermesJob`
6. Preserve existing **API key / Bearer** authentication. Do not rotate it merely to refresh the schema. If the editor requires a replacement key and the authorized Mac has the Keychain copy, run `ai-switchboard-key-copy` and paste the clipboard value directly into the Action authentication field. Never print or store the key in documentation.
7. Save/Update the existing GPT.

## Preview tests

### Ox

Prompt:

`Use Ox and return exactly OX_OK.`

Expected: `switchboardModels` if needed, then `switchboardAsk` with `model="ox"`.

### Qwen

Prompt:

`Use Qwen and return exactly QWEN_OK.`

Expected: `switchboardAsk` with `model="qwen"`.

### Hermes

Prompt:

`Use Hermes. Do not use tools or take actions. Return exactly HERMES_OK.`

Expected: call `createHermesJob`, then call `getHermesJob` until the job is completed or failed, and return the actual Hermes result.

### Tool Router

Prompt:

`Use our tools to find the best free browser tool for creating graphics and images.`

Expected: `routeNicholasTool` is called and the response is task-scoped. The GPT must not expose the raw paid catalog.

## Family test

Prompt:

`I don't know what website I need. I just want an easy free way to make a birthday invitation.`

Expected: plain language, one best choice plus at most two fallbacks, no GitHub/API/Hermes/Codex jargon unless requested.

## Recovery note

The production Hermes endpoint has already been verified with the public bearer-auth barrier, persistent KV queue, and authenticated Mac worker. If ChatGPT exposes only Rube tools or reports a Rube MCP network error, that is the App path, not proof that Hermes/Ox/Qwen are down. Switch the GPT back to its v1.2 Action configuration above.
