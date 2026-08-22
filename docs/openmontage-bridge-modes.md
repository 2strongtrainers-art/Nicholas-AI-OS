# OpenMontage bridge modes

The Mac worker classifies every OpenMontage queue job before rendering.

- `fast_reel` is the default. It directly renders the reusable 1080x1920 Remotion template, performs lightweight H.264/size/duration validation, creates a QA contact sheet, copies the MP4 to iCloud Drive, and publishes completion metadata.
- `full_production` retains the existing autonomous OpenMontage pipeline for requests that explicitly call for research, internet footage, cinematic/custom production, complex audio or AI generation, multi-stage editorial work, or deeper QA.

An explicit `render_mode` always wins. When it is omitted, the router defaults to `fast_reel` unless the request text contains a full-production trigger.

## Fast Reel job fields

```json
{
  "type": "openmontage_video",
  "status": "queued",
  "render_mode": "fast_reel",
  "fast_reel": {
    "duration_seconds": 24,
    "hook": "A STRONG 1–2 SECOND HOOK",
    "title": "CONFIGURABLE TITLE",
    "body_lines": ["FIRST BEAT", "SECOND BEAT", "THIRD BEAT"],
    "cta": "CONFIGURABLE CALL TO ACTION",
    "branding": "",
    "accent_color": "#67E8F9",
    "background_color": "#07111F",
    "media": "optional/local/or/http/path.mp4",
    "audio": "optional/local/or/http/path.mp3"
  }
}
```

`branding`, `media`, and `audio` are optional. Local assets are reused through OpenMontage's installed Remotion project. No paid service is invoked by the fast path.

In normal ChatGPT, use: **“OpenMontage bridge this into an Instagram Reel.”** Add the content or brief in the same message. Add “make this a full professional production” only when the autonomous full-production path is wanted.
