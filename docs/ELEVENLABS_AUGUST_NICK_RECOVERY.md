# ElevenLabs August Nick — connection preflight and repair (public-safe)

**Source-of-truth:** Private `/TriValley/Work Handoffs/August Nick Voice Recovery/August_Nick_ElevenLabs_Source_of_Truth.md` contains owner-only voice and asset references. Do not copy voice IDs, API keys, access/refresh tokens, provider generation IDs, browser profile identifiers, or signed URLs to this public repository.

## What is established as of 2026-11-18

- The former `ElevenLabs_Bridge` routed to a retired Replit deployment; its MCP SSE probe returns HTTP 404. Do **not** treat it as a current production connector or re-create the Replit deployment.
- The existing Cloudflare replacement runs at `https://nicholas-ai-os.2strongtrainers.workers.dev`; its public `/health` response reported `ok:true`, `service:nicholas-elevenlabs-bridge`, `replit_required:false`, `grant_storage_bound:true`, and **`oauth_configured:false`**.
- Source `src/oauth.ts` defines OAuth readiness as `OAUTH_SIGNING_SECRET && CHATGPT_SETUP_CODE && OAUTH_GRANTS`. The deployed grant binding is present; the secret configuration has not been established. Do not assume which individual secret is missing.
- An independent ElevenLabs provider service incident began 2026-11-18 15:34 UTC, affecting TTS, voices/API, and the Creative UI. Official Creative connector read calls returned unspecified internal errors; distinguish this incident from the separate Cloudflare OAuth misconfiguration.
- Historical productions used the **existing** `August Nick` voice. Its present account/workspace membership has not been independently read back during this incident. Never clone, replace or regenerate simply to diagnose a connection.

## Zero-credit repair sequence

1. Check [ElevenLabs service status](https://status.elevenlabs.io). If degradation remains, do not generate paid media or interpret transient API errors as deleted voices.
2. Run `node scripts/elevenlabs_bridge_doctor.mjs`; expected result while incomplete is `OAUTH_SECRETS_MISSING`. This only reads the public Worker `/health` endpoint. It cannot inspect secrets or authenticate ChatGPT.
3. In the **authenticated owner Cloudflare account**, open the existing Worker `nicholas-ai-os` and its Secrets/Variables. Configure **both** `OAUTH_SIGNING_SECRET` and `CHATGPT_SETUP_CODE` as secret values if absent. Generate strong, unique random values privately and **never paste them into ChatGPT, GitHub, issues, logs, or documents**. Also verify existing `ELEVENLABS_API_KEY` and `BRIDGE_TOKEN` are configured, but do not unnecessarily overwrite a valid key. Confirm correct Worker environment. `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` are optional for this implementation. Inspect/verify `OAUTH_GRANTS` binding and `oauth-grants-v1` migration without re-creating the deployed Worker.
4. Read `/health` again. `oauth_configured:true` and `grant_storage_bound:true` are necessary but **not sufficient** to prove access to ElevenLabs.
5. In ChatGPT Settings → Plugins (or Apps, depending on available UI), connect one custom MCP connector to the deployed Worker. MCP `https://nicholas-ai-os.2strongtrainers.workers.dev/mcp`, authorize `https://nicholas-ai-os.2strongtrainers.workers.dev/oauth/authorize`, token `https://nicholas-ai-os.2strongtrainers.workers.dev/oauth/token`, scope `elevenlabs`; authorization-code flow with PKCE S256. Enter the **owner-only setup code** on the Worker approval page, not in the chat. Dynamic client registration is unsupported; use the supported client credentials fields only if the ChatGPT setup flow requires them.
6. With the **authenticated** MCP connection, verify the tool listing includes `bridge_status`, `find_voices`, `create_speech`, `get_speech`, `get_speech_audio`, and `speech_to_text`. Invoke **read-only** `bridge_status` and `find_voices(search="August Nick")`; verify exact voice name, identity and account/workspace before any synthesis. Test a provider read endpoint (`GET /v1/user` or exact voice read) under an authorized authenticated route, recording a private receipt. Do not mistake `health.ok` for a successful provider call.
7. Prefer the official ElevenLabs Creative connector once its read actions are healthy. Do not use the retired Replit connector again. Existing finished generation history/media should be retrieved or downloaded without regenerating. Provider generation IDs are not interchangeable with history item IDs.
8. **Paid generation is a separate gate.** Respect `ALLOW_PAID_AI=false`, the per-video credit cap, current voice rights, source accuracy, and explicit production scope. A connectivity probe should cost zero ElevenLabs generation credits.

## Troubleshooting decision table

| Symptom | What it supports | Next move |
| --- | --- | --- |
| Retired Replit MCP 404 | Old bridge endpoint no longer serves | Ignore/remove retired connection; use existing Cloudflare bridge |
| Cloudflare `/health` HTTP 200, `oauth_configured:false` | OAuth setup incomplete | Set/check both owner-only OAuth secrets in the correct Worker environment |
| `/health` HTTP 200, OAuth true | Worker config and storage present, **not** proven ChatGPT auth | Authenticate custom MCP; run read-only `bridge_status` and `find_voices` |
| MCP returns 401/403 | No valid access token / OAuth grant or wrong scope | Verify ChatGPT connected account, complete PKCE authorization; don't rotate key without cause |
| Provider voice lookup 401/403 | Provider API key scope or validity issue | Review the secret/account in ElevenLabs; do not post the key |
| Provider exact voice 404 | Wrong workspace/voice ID or resource not available | Recheck workspace and live voice catalog, never auto-clone |
| Provider 429 | Provider rate limit/plan | Back off; do not regenerate on an ambiguous timeout |
| Provider 5xx / Creative internal error during published incident | Likely provider-service instability, not proven owner misconfiguration | Check status, wait for service recovery, retry one **read-only** lookup |
| Cloudflare health unreachable | Worker routing/deployment issue | Verify actual deployed Worker and route, not the old Replit URL |

## Acceptance gates

- `[ ]` Provider status suitable for read-only test.
- `[ ]` Existing Worker `/health` says OAuth configured and grants bound.
- `[ ]` ChatGPT's **new Cloudflare MCP** is connected and offers the expected tools.
- `[ ]` `bridge_status` confirms provider-key configuration; one authenticated provider read succeeds.
- `[ ]` Exact existing `August Nick` voice read back in the **intended** workspace.
- `[ ]` Existing recordings are recoverable without creating duplicate billable generations.
- `[ ]` New script generation, if separately authorized, has a credit estimate, approved provider model, and actual audio QA receipt.

Only label the connection **fully restored** after the authenticated steps pass. No repo merge, public health check, OAuth readiness flag, or script test alone can establish this.

## References

- [Existing bridge implementation](../services/elevenlabs-cloudflare-bridge/README.md)
- [Existing Muse handoff](MUSE_VIDEO_HANDOFF.md)
- [Existing content system](ELEVENLABS_CONTENT_SYSTEM.md)
- [Official ElevenLabs status](https://status.elevenlabs.io)
- [OpenAI plugin/account troubleshooting](https://help.openai.com/en/articles/20001497-troubleshooting-plugins-and-apps-in-chatgpt)