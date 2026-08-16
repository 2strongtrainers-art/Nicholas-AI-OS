# ElevenLabs Cloudflare Bridge

A stateless remote MCP bridge that lets ChatGPT call Nicholas's ElevenLabs account without a Replit server.

## What this replaces

The previous bridge depended on a paid Replit deployment. This version is designed for Cloudflare Workers and keeps the ElevenLabs API key server-side as a Worker secret.

## Exposed tools

- `bridge_status`
- `find_voices`
- `create_speech` / `get_speech`
- `create_image` / `get_image`
- `create_video` / `get_video`
- `upload_asset_base64`
- `create_lipsync_video`

The speech tool accepts a voice name, so requests can use `August Nick` without hard-coding the voice ID.

## Security

Never commit secrets to GitHub.

Required Worker secrets:

- `ELEVENLABS_API_KEY` — a restricted ElevenLabs API key with only the scopes this bridge needs and a sensible credit quota.
- `BRIDGE_TOKEN` — a long random bearer token used to protect `/mcp` from unauthorized use.

The public `/health` route contains no secrets. The `/mcp` route requires `Authorization: Bearer <BRIDGE_TOKEN>`.

## Local setup

```bash
npm install
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

## Status

The Cloudflare build configuration has been corrected and this commit is intended to trigger a fresh production deployment from `main`. The bridge is not considered fully live until the Worker deploys successfully, `ELEVENLABS_API_KEY` and `BRIDGE_TOKEN` are configured as Cloudflare runtime secrets, and end-to-end tool calls pass.
