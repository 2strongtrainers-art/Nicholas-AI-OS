# Video Engine

## Proof renderer

The proof renderer demonstrates the complete GitHub execution loop without paid external APIs:

1. ChatGPT writes a job JSON into `jobs/`.
2. A push triggers `.github/workflows/render-video.yml`.
3. GitHub Actions runs `scripts/render_video.py`.
4. FFmpeg renders a 1080x1920 H.264/AAC MP4.
5. The renderer validates dimensions, duration, and audio/video streams.
6. GitHub uploads the MP4 plus a QA manifest as a workflow artifact.
7. ChatGPT can inspect the run and retrieve the artifact.

## Earlier market-renderer upgrade path

Production video mode will preserve the same job-driven architecture while adding:

- ElevenLabs narration using the configured August Nick voice.
- Licensed Pexels footage and/or generated visual assets.
- Captions synchronized to narration.
- Music where appropriate.
- Brand overlays and transitions.
- Media QA before artifact delivery.

## Secrets

Never put API keys in a job JSON, source file, README, issue, pull request, or chat message.

The production renderer will read these encrypted GitHub Actions repository secrets when enabled:

- `ELEVENLABS_API_KEY`
- `PEXELS_API_KEY`

The non-secret ElevenLabs voice ID may remain in workflow configuration.

## Cost guard

Proof mode must not call paid APIs. Production mode should prefer GitHub Actions for compute, use the user's existing API accounts directly, and avoid Replit as a render bridge unless it provides a unique benefit.

## Avatar and fitness production handoff — November 13, 2026

The completed tool-enabled reference production used an approved talking-avatar opening, August Nick narration, timed captions, generated illustrative footage, precise charts and a local FFmpeg composition. See [the production runbook](AVATAR_VIDEO_WORKFLOW.md), [Muse entry point](MUSE_VIDEO_HANDOFF.md) and [fitness playbook](FITNESS_VIDEO_PLAYBOOK.md). That completed workspace render is separate from verification of an unattended production service.

### Current short-Reel route

[`scripts/render_trivalley_reel.py`](../scripts/render_trivalley_reel.py) renders existing local video/audio/image assets; it does not create an avatar or call ElevenLabs. It accepts a private folder containing `reel.json`, one to ten video segments (1–15 seconds each), and a 3–8 second end card, with a total of 8–60 seconds. Output is 720 × 1280 at 30 fps, H.264/AAC. Its per-shot captions are static; word highlighting requires an additional caption compositor or prepared captioned footage.

Provide a `narration` audio filename for each shot when using a clean voiceover; the renderer then selects that file instead of source-video sound. Cut the correct speech interval first, because this audio input starts at its own beginning. Each audio slice must fit the shot. Set end-card copy explicitly for each current offer; the existing default assessment copy is not a substitute for verifying the requested product.

```bash
python3 scripts/render_trivalley_reel.py /private/episode-inbox /private/episode-review
```

The existing [`render-trivalley-reel.yml`](../.github/workflows/render-trivalley-reel.yml) has a private-media route through its configured environment and a separate synthetic smoke-test route. The review workflow and render-status workflow live under [`workflows/n8n`](../workflows/n8n). Verify configuration and the actual job result before claiming either route is operational for an episode. Use the private extended compositor for a longer reference-style video; do not force its 26-shot timeline into the short-Reel schema.

A successful production record includes the final file, exact format and duration, full decode, visual/caption review, audio check, private save receipt and Watch link. Device playback is a separate observation and must only be claimed when actually tested.
