# Repository reconnaissance — 2026-08-25

## Objective

Find public repositories that can materially improve Nicholas-AI-OS Fast Reel without replacing the proven GitHub -> Mac worker -> FFmpeg/Remotion -> QA/delivery architecture.

## Executive decision

**Best architecture reference:** `mutonby/openshorts`.

Why: its current implementation combines scene detection, active-speaker/face tracking, per-scene layout selection, an ffmpeg-native reframe path, subtitle/layout handling, MCP/API access, and a broad regression suite. It is also under active development in August 2026.

**Do not vendor OpenShorts wholesale.** Its repository LICENSE states MIT for repository content outside `cloud/`, with `cloud/` separately licensed. GitHub also reports OpenShorts as a fork of `kamilstanuch/Autocrop-vertical`, whose repository metadata does not declare a license. Because provenance of inherited code is not sufficiently clear for blind copying, treat OpenShorts as a YELLOW architectural reference rather than a GREEN verbatim-copy source.

**Best clearly permissive reframe reference:** `KazKozDev/auto-vertical-reframe` (MIT). Its architecture is scene-aware and uses PySceneDetect, YOLO/ByteTrack, MediaPipe cues, subject ranking, and a smoothed virtual camera before ffmpeg encoding. Its main weakness is maturity: the repository is much smaller and less battle-tested than OpenShorts.

**Best mature deterministic editing utility:** `WyattBlue/auto-editor` (Unlicense). It is strong for silence/motion-driven pacing and deterministic local preprocessing, but it does not solve the primary subject-tracking/reframing gap.

## Internal fit ranking

Scores are architecture-fit scores for Nicholas-AI-OS, not general project-quality scores.

| Rank | Repository | Fit score | Best use here | Decision |
| --- | --- | ---: | --- | --- |
| 1 | mutonby/openshorts | 94/100 | Architecture, scene-aware/speaker-aware reframing, render strategy | Study/adapt concepts; do not wholesale copy |
| 2 | KazKozDev/auto-vertical-reframe | 84/100 | Clearly MIT scene-aware vertical reframe | Safe source for selective adaptation with attribution |
| 3 | WyattBlue/auto-editor | 83/100 | Silence/motion cleanup and pacing | Consider as optional preprocessing layer |
| 4 | DojoCodingLabs/remotion-superpowers | 78/100 | Remotion production/review patterns | Select ideas only; overlaps existing stack |
| 5 | jongan69/ClipCaptionAI | 75/100 | Deterministic Remotion manifests/QA, captions, B-roll | Watch; too small to replace current stack |
| 6 | hassancs91/claude-faceless-shorts-creator | 72/100 | Word-exact captions, reusable SFX/media patterns | Useful for faceless track, not supplied-footage core |
| 7 | el-frontend/video-wizard | 70/100 | Clip selection/caption ideas | Already selectively adapted in Nicholas-AI-OS |
| 8 | MoneyPrinterTurbo | 68/100 | Script-to-video automation | Already integrated; not the missing layer |

## Existing architecture audit

Nicholas-AI-OS already has:

- GitHub-backed control/queue routing.
- OpenMontage Mac rendering.
- Fast Reel default routing for normal short-form jobs.
- deterministic FFmpeg multi-clip assembly.
- 1080x1920 Remotion rendering and QA.
- Video Wizard-inspired clip ranking, captions, and optional face focus.
- MoneyPrinter integration.
- ElevenLabs/August Nick support.
- iCloud/chat delivery.

Therefore replacing the renderer or control plane would create duplication rather than improvement.

## High-value defect found during comparison

`video_intelligence` can emit per-clip `focus_x` / `focus_y`, but `scripts/openmontage_fast_reel_edl.py` previously discarded those fields during normalization and always center-cropped the actual EDL render.

This branch fixes that disconnect:

1. normalize and clamp per-clip focus metadata;
2. feed the focus coordinates into the FFmpeg crop expression;
3. record applied focus points in EDL job metadata;
4. preserve center crop as the default/fallback;
5. add regression tests for focus preservation, bounding, nonnumeric rejection, and generated crop expressions.

This is intentionally dependency-free and does not alter the control plane.

## Next highest-value adaptation

After the focus-metadata fix proves stable on real clips, add a feature-gated scene-aware trajectory layer:

1. detect scene boundaries;
2. reset subject-tracking state on every source shot cut;
3. identify/track subjects inside each shot;
4. optionally use mouth activity + audio energy when multiple faces are present;
5. produce a deduplicated crop trajectory;
6. let ffmpeg perform native dynamic crop/render;
7. fall back to the current static per-clip focus when dependencies or confidence are insufficient.

OpenShorts provides strong evidence for the scene-cut reset principle: its 2026-08-24 change reports lower first-frame framing error and much faster settling after shot changes. That behavior should be independently implemented or adapted only from a clearly licensed source.

## Audio issue discovered, not changed in this branch

The EDL assembler currently uses `-an`, and the Fast Reel Remotion background video is explicitly muted. Audio is supplied separately through `audioSrc`. Therefore an EDL of supplied clips will not preserve source audio unless a separate audio asset/narration is configured.

This likely explains prior silent supplied-footage renders. It should be fixed in a separate media-tested change because source-audio preservation, narration mixing, and mixed clips with/without audio require explicit policy rather than an unreviewed behavior change.

## Security notes

OpenShorts pins most heavy Python dependencies and runs backend tests plus a frontend build in CI. It also contains an explicit SSRF guard for user-supplied server-side URLs. No unfamiliar external repository code is executed or installed by this reconnaissance branch.

## License policy

- GREEN: clearly permissive code such as MIT/Unlicense, with required notices preserved.
- YELLOW: OpenShorts architectural concepts due to mixed licensing/provenance; avoid verbatim wholesale transplantation.
- RED: `cloud/` in OpenShorts unless its separate commercial license is deliberately reviewed and accepted.

## Branch scope

Branch: `research/openshorts-fast-reel-focus`

This branch deliberately does **not**:

- change `main`;
- install a new SaaS;
- add paid APIs;
- publish content;
- replace OpenMontage;
- replace MoneyPrinter;
- copy OpenShorts `cloud/` code;
- enable untested active-speaker tracking.
