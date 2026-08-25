# Video Wizard adaptation for Nicholas-AI-OS

## Decision

Do not install the full `el-frontend/video-wizard` application into Nicholas-AI-OS. The existing OpenMontage stack already owns rendering, Fast Reel routing, August Nick narration, QA, GitHub job transport, and iCloud delivery.

Instead, adapt only the high-value intelligence concepts that improve editorial decisions before the existing render path:

1. Timestamp-grounded viral clip ranking.
2. Standardized 0-100 candidate scoring.
3. Caption-style presets that translate into existing Fast Reel color/branding inputs.
4. Optional MediaPipe face-focus estimation with a centered fallback.
5. Deterministic subject-focused FFmpeg cropping helpers.

## Flow

```text
source footage
  -> transcript
  -> Hermes / GPT-5.6 Sol clip intelligence
  -> validated top candidates
  -> optional face-focus analysis
  -> Fast Reel-ready EDL metadata
  -> existing OpenMontage / MoneyPrinter render
  -> existing August Nick narration when requested
  -> existing QA + iCloud delivery
```

## Safety and cost boundaries

- No publishing is performed by the intelligence runner.
- No external messaging is performed.
- No new video SaaS is introduced.
- Hermes uses the existing OpenAI Codex/ChatGPT OAuth configuration on the Mac.
- MediaPipe/OpenCV are optional; absence of either falls back to centered framing.
- Existing OpenMontage Fast Reel remains the renderer and source of delivery/QA truth.

## Clip score

Nicholas-AI-OS asks Hermes to score candidate segments using a 100-point rubric:

- Hook / immediate attention: 25
- Complete thought or story arc: 20
- Emotional or curiosity impact: 15
- Satisfying conclusion: 15
- Standalone clarity: 15
- Shareability / discussion value: 10

The prompt forbids invented timestamps and prefers useful instruction, visible transformation, surprising coaching insight, and complete stories over generic motivational fragments.

## Caption presets

Available names:

- `viral`
- `minimal`
- `modern`
- `default`
- `highlight`
- `colorshift`
- `hormozi`
- `mrbeast`
- `mrbeastemoji`
- `trivalley_elite`

The presets are Nicholas-AI-OS-native configurations; the external web application is not required at runtime.

## Source / attribution

Concepts were evaluated against the public `el-frontend/video-wizard` project, which is MIT licensed (Copyright 2026 Video Wizard Contributors). Nicholas-AI-OS uses a new native implementation rather than importing the project's Next.js/PostgreSQL/FastAPI application stack.

Upstream project: `https://github.com/el-frontend/video-wizard`
