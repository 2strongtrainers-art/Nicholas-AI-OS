# OpenMontage bridge modes

The Mac worker classifies every OpenMontage queue job before rendering.

- `fast_reel` is the default for ordinary Reels and short social edits. ChatGPT acts as the editor/director, supplies the hook, on-screen beats, CTA, optional narration, and—when footage is available—an edit decision list. The Mac worker assembles the selected clips with FFmpeg, renders the reusable 1080x1920 Remotion template, validates H.264/size/duration, creates a QA contact sheet, copies the MP4 to iCloud Drive, and publishes completion metadata.
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
    "branding": "TriValley.fit",
    "clips": [
      {"media": "/path/to/clip-1.mp4", "start_seconds": 1.5, "end_seconds": 6.0},
      {"media": "/path/to/clip-2.mp4", "start_seconds": 0.0, "duration_seconds": 5.0},
      "/path/to/clip-3.mp4"
    ],
    "audio": "optional/local/or/http/path.mp3"
  }
}
```

`clips` is the preferred input when ChatGPT has multiple source videos. It accepts up to 12 **local** video paths. Each clip can be a path string or an object with `media`/`src`/`path`, `start_seconds`, and either `end_seconds` or `duration_seconds`. Remote URLs are rejected for multi-clip EDL input so signed URLs or credentials cannot leak into worker command logs. The worker resets clip timestamps, normalizes selected segments to 1080x1920/24fps, concatenates them without source audio, and pads the final frame when necessary so the assembled footage matches the requested Reel duration before Remotion adds graphics and optional narration/audio.

For one background image or video, `media` is still supported. `branding`, `media`, `clips`, and `audio` are optional. No paid service is invoked by the Fast Reel renderer itself.

## Normal ChatGPT behavior

A user should not need special syntax. Requests such as **“turn these clips into a Reel”**, **“edit these three videos into a 45-second Reel”**, or **“OpenMontage bridge this into an Instagram Reel”** should be treated as Fast Reel jobs unless the user explicitly asks for a more advanced production.

ChatGPT should make the edit decisions before queueing the job: choose the strongest opening, order and trim the clips, write concise visual copy, add narration only when it improves the result, then send the deterministic job to the Mac renderer. Add “make this a full professional production” only when the autonomous full-production path is wanted.
