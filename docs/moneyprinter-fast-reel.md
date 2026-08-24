# MoneyPrinterTurbo Fast Reel Sidecar

## Purpose

MoneyPrinterTurbo is the preferred engine for normal Fast Reel jobs while the existing OpenMontage/Remotion path remains the automatic fallback.

The integration is pinned to upstream commit `110997c15abd1660b00add8e41feefedb3df6a8c` so upstream changes cannot silently change production behavior.

## Routing

Normal Fast Reel jobs prefer MoneyPrinterTurbo by default.

Override per job:

```json
{
  "render_engine": "openmontage"
}
```

or:

```json
{
  "fast_reel": {
    "moneyprinter": {
      "enabled": false
    }
  }
}
```

The default can also be changed on the Mac with `NICHOLAS_FAST_REEL_ENGINE=openmontage`.

## Job options

```json
{
  "fast_reel": {
    "moneyprinter": {
      "enabled": true,
      "video_source": "pexels",
      "broll_queries": [
        "boxing footwork training",
        "heavy bag combinations"
      ],
      "clip_duration_seconds": 4,
      "concat_mode": "sequential",
      "subtitle_position": "center",
      "font_size": 68,
      "fallback_to_openmontage": true,
      "auto_install": true
    }
  }
}
```

If local `fast_reel.clips` or `fast_reel.media` are supplied, the sidecar uses MoneyPrinterTurbo's local-material mode instead of a stock provider.

## Voiceover

Preferred path: provide the existing ElevenLabs-generated local audio file through `fast_reel.audio`. MoneyPrinterTurbo then uses that file as `--custom-audio-file` and transcribes it for subtitles.

Alternative path: configure either:

- `MPT_VOICE_NAME=elevenlabs:<voice-id>:<display-name>`
- `MPT_ELEVENLABS_VOICE_ID=<voice-id>`

The sidecar does not silently use a different TTS provider unless `allow_default_tts` is explicitly enabled.

## Stock footage credentials

No credentials are committed to GitHub. The Mac can expose one or more of:

- `PEXELS_API_KEY`
- `PIXABAY_API_KEY`
- `COVERR_API_KEY`

At runtime the sidecar writes them only into MoneyPrinterTurbo's local ignored `config.toml`.

## Bootstrap

On first eligible Reel, the worker can automatically:

1. clone MoneyPrinterTurbo into `~/MoneyPrinterTurbo`;
2. pin the checkout to the reviewed upstream commit;
3. create a small bootstrap virtual environment;
4. install `uv` there;
5. run `uv sync --frozen --no-dev` to build MoneyPrinterTurbo's managed `.venv`.

Set `fast_reel.moneyprinter.auto_install=false` to disable automatic setup.

## Safety and fallback

Before delivery, the sidecar requires:

- H.264 video;
- exactly 1080×1920;
- duration between 15 and 90 seconds.

If setup, rendering, or QA fails, the job records `moneyprinter_fallback` and runs the existing EDL/Remotion Fast Reel path unless `fallback_to_openmontage=false` was explicitly requested.

## Upstream

MoneyPrinterTurbo is MIT licensed. See `third_party/MoneyPrinterTurbo-LICENSE.txt`.
