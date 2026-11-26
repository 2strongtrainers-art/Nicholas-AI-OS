# Prototype verification

- Hyperframes npm package 0.8.162 and GSAP 3.14.2 pinned with package lock. This is a published CLI installation, not a build of the entire source monorepo.
- Local Chrome Headless Shell installed; Node 24.19.0 and FFmpeg 6.1.1 used.
- Final `hyperframes check --json`: lint/runtime/layout/motion/contrast passed, zero warnings/errors, browser checks executed. See check-results.json.
- Local render succeeded: 396.2 KB, eight seconds, 240 frames, 1080×1920 H.264 at 30 fps. Silent by design. ffprobe values and SHA-256 are in media-info.json.
- Render used screenshot capture with software GPU, approximately 24.1 seconds. No claim of byte-identical renders across hosts.
- Decoded output inspected at 1.5, 4 and 7 seconds: branded heading, support copy and CTA readable without clipped content.
- Calculator browser checks passed: five offers; initial $597 revenue / $417 after delivery+admin time at $50/hour; −$33 at $200/hour; coaching $497 requires two clients to exceed $500; zero-price input avoids division-by-zero; 390px layout has no document overflow; no runtime errors.
- No paid model API, hosted render, outreach, email send, order, payment or site publishing was performed. Customer demand is untested.
- Hyperframes CLI subscription usage was unknown (`no_subscription_login`). Optional doctor checks for local transcription/TTS/music and Docker remain unavailable; they are not used by this sample. CLI telemetry was disabled.

The initial acquisition report’s Hyperframes source-only renderer limitation is superseded for this specific local sample only. No claim is made about all possible rendering features, a Mac installation or the other eight applications.
