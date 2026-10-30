# ElevenLabs Cloudflare Bridge

A remote MCP bridge that lets ChatGPT call Nicholas's ElevenLabs account without a Replit server.

## What this replaces

The previous bridge depended on a paid Replit deployment. This version is designed for Cloudflare Workers and keeps the ElevenLabs API key server-side as a Worker secret.

## Exposed tools

- `bridge_status`
- `find_voices`
- `create_speech` / `get_speech` / `get_speech_audio`
- `preview_speech` — short voice preview; the owner approves this before full narration
- `create_image` / `get_image`
- `create_video` / `get_video`
- `upload_asset_base64`
- `create_lipsync_video`

The speech tool accepts a voice name, so requests can use `August Nick` without hard-coding the voice ID.

## Security

Never commit secrets to GitHub.

Required Worker secrets:

- `ELEVENLABS_API_KEY` — a restricted ElevenLabs API key with only the scopes this bridge needs and a sensible credit quota.
- `BRIDGE_TOKEN` — a long random bearer token used to protect `/mcp` from unauthorized use (kept for API clients and as a fallback).
- `OAUTH_SIGNING_SECRET` — signs ChatGPT OAuth tokens. Required for the ChatGPT connector flow.
- `CHATGPT_SETUP_CODE` — a high-entropy secret the owner enters in the browser approval page when connecting ChatGPT. Required for the ChatGPT connector flow.
- `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` — optional. When set, the token endpoint enforces them; when unset, any client id is accepted.

The public `/health` route contains no secrets. Its `oauth_configured` and `grant_storage_bound` fields report configuration presence, not a completed login or successful ElevenLabs request. The `/mcp` route requires `Authorization: Bearer <BRIDGE_TOKEN>` or a valid OAuth access token issued by this bridge. Audio tools only ever return public `https://` URLs — never local filesystem paths.

## Connecting ChatGPT (persistent OAuth connection)

ChatGPT custom connectors use OAuth authorization-code flow with PKCE. This bridge uses signed tokens plus a SQLite Durable Object for each authorization grant:

1. Deploy with the included OAUTH_GRANTS binding and oauth-grants-v1 migration, and set all secrets above, including `OAUTH_SIGNING_SECRET` and `CHATGPT_SETUP_CODE`.
2. In ChatGPT, add a custom connector with:
   - MCP server URL: `https://nicholas-ai-os.2strongtrainers.workers.dev/mcp`
   - Authorization URL: `https://nicholas-ai-os.2strongtrainers.workers.dev/oauth/authorize`
   - Token URL: `https://nicholas-ai-os.2strongtrainers.workers.dev/oauth/token`
   - Scope: `elevenlabs`
3. ChatGPT opens the approval page. Enter the `CHATGPT_SETUP_CODE` once and approve. ChatGPT keeps the refresh token, so the connection persists — access tokens last up to 1 hour and refresh tokens rotate within a fixed 30-day grant. Reusing a code or refresh token revokes that grant.
4. PKCE S256 is required. Configure a static client ID/secret if the connector setup asks for them; dynamic client registration is not implemented.
5. Discovery documents live at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`.

Earlier stateless OAuth tokens are invalid after this update; reconnect that custom bridge once after deployment. Existing BRIDGE_TOKEN API clients remain supported.

If secrets or grant storage are missing, `/oauth/*` returns 503 and the old Bearer-token path still works for API clients.

## Local setup

```bash
npm ci
npm test
npm run typecheck
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put BRIDGE_TOKEN
npm run dev
```

## Deploy

```bash
npm run deploy
```

Wrangler will return a Worker URL similar to:

```text
https://nicholas-elevenlabs-bridge.<account-subdomain>.workers.dev
```

Use this MCP endpoint:

```text
https://nicholas-elevenlabs-bridge.<account-subdomain>.workers.dev/mcp
```

Configure the MCP client to send the `BRIDGE_TOKEN` as a Bearer token.

## Important billing distinction

Cloudflare is only the bridge/hosting layer. Using the Worker does not remove ElevenLabs generation costs. Speech, image, video, lip-sync, music, and other generations consume the credits and plan entitlements of the connected ElevenLabs account.

## Image/video notes

- Image default: `gpt-image-2`
- Video default: `veo-3.1-fast-generate-001`
- Lip-sync helper: `creatify-aurora`
- Model-specific options can be passed in `extra_json`, allowing new ElevenLabs settings to be used without redeploying the bridge for every API field.
- `upload_asset_base64` is intended for taking a photo available to ChatGPT, uploading it securely to ElevenLabs Assets, and then using the returned asset ID as a video reference.

## Example workflow: photo + August Nick

1. Upload the user's photo with `upload_asset_base64`.
2. Generate narration with `create_speech`, `voice_name: "August Nick"`.
3. Poll `get_speech` until complete.
4. Use the photo asset and speech generation with a supported lip-sync/video model.
5. Poll `get_video` until complete and return the signed result URL to the client.

## Video workflow (upload, voice, preview, finished MP4)

This is the workflow ChatGPT drives once connected. Nothing publishes without the owner's word at the preview step:

1. **Upload footage** — send the clip or photo with `upload_asset_base64`; keep the returned asset id.
2. **Select the voice** — `find_voices` (search "August Nick") or pass `voice_name: "August Nick"` directly.
3. **Preview narration** — `preview_speech` with the full script generates only the first ~280 characters. Fetch its audio with `get_speech_audio` and play it for the owner.
4. **Owner approval** — only after the owner approves the preview, run `create_speech` on the full script.
5. **Finish the MP4** — combine the footage asset and the full narration with `create_lipsync_video` (or `create_video` with a start frame), poll `get_video`, and return the signed MP4 URL. That URL is the deliverable; no local path is ever returned.
6. **iPhone Share Sheet shortcut (assessed, not yet built)** — after the core connection works, a Share Sheet shortcut can send a clip to a small upload endpoint and queue this same workflow. It needs an upload endpoint that accepts a shortcut's file post plus the owner's approval step, so it is a follow-up build, not part of this bridge change.

## Status

This source has local regression tests; production deployment and a real ChatGPT login must be verified separately. The bridge is not considered fully live until the Worker deploys successfully, `ELEVENLABS_API_KEY` and `BRIDGE_TOKEN` are configured as Cloudflare runtime secrets, and end-to-end tool calls pass.

The previous Replit bridge (`eleven-labs-bridge.replit.app`) is retired: its deployment is not serving (Replit reports no successful current build, and `/api/mcp` returns its "app isn't live yet" page). The Cloudflare Worker above is the supported production endpoint.
