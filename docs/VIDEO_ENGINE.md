# Video Engine

## Current stage: proof renderer

The proof renderer demonstrates the complete GitHub execution loop without paid external APIs:

1. ChatGPT writes a job JSON into `jobs/`.
2. A push triggers `.github/workflows/render-video.yml`.
3. GitHub Actions runs `scripts/render_video.py`.
4. FFmpeg renders a 1080x1920 H.264/AAC MP4.
5. The renderer validates dimensions, duration, and audio/video streams.
6. GitHub uploads the MP4 plus a QA manifest as a workflow artifact.
7. ChatGPT can inspect the run and retrieve the artifact.

## Production upgrade

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
