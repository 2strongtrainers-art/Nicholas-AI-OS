# Open-source alternatives to Higgsfield and eight other services (13 Nov 2026)

> **Status: research / not deployed.** Verified public GitHub repositories, collected for review. This branch/PR changes no production services or billing and does not install or execute third-party software.

## The nine paid tools visible in the supplied Instagram screenshot

Only the *Higgsfield → Open-Generative-AI* mapping appeared in a supplied alternative slide. The remaining eight mappings below are **our recommendations**, not the unseen Instagram slides.

| Service on Instagram | GitHub replacement | Reality check |
|---|---|---|
| Higgsfield | [Anil-matcha/Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI) | Self-hostable UI; cloud video requests require MuAPI key and credits. Local image mode on compatible Macs; local video needs separate WanGP/Wan2GP CUDA/ROCm backend. |
| ElevenLabs | [RVC-Boss/GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) | Voice cloning and TTS on your own machine. Existing August Nick voice is **not** automatically migrated; use authorized user-owned voice reference audio and verify output before release. |
| Semrush | [towfiqi/serpbear](https://github.com/towfiqi/serpbear) | Keyword position tracking; not full paid competitive SEO/backlink database. Ranking lookup may depend on paid scraping API or proxies. |
| Notion | [AppFlowy-IO/AppFlowy](https://github.com/AppFlowy-IO/AppFlowy) | Docs/tasks/databases, with migration and hosting work. |
| Flow (AI video, assumed) | [Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI) | Node-based open-model video/image pipelines. Does not grant closed Google Flow model access. |
| Asana | [makeplane/plane](https://github.com/makeplane/plane) | Issue/task/roadmap management. |
| Calendly | [alextselegidis/easyappointments](https://github.com/alextselegidis/easyappointments) | Self-hosted appointment booking; protect customer information. [calcom/cal.diy](https://github.com/calcom/cal.diy) exists but warns it is for personal non-production use, so it is **not** first choice for a paid coaching operation. |
| Intercom | [chatwoot/chatwoot](https://github.com/chatwoot/chatwoot) | Customer support/chat with self-hosting; ongoing data security and maintenance required. |
| Loom | [CapSoftware/Cap](https://github.com/CapSoftware/Cap) | Screen recording, local editing and share options; hosted services/features may still cost money. |

## Higgsfield-replacement: a viable production architecture

Prefer to **replace the workflow, not just the interface**:

1. **Create brief and verified claims**: existing Nicholas-AI-OS research/ARGUS process; editorial and fact-check approvals.
2. **Visual generation**: [ComfyUI](https://github.com/Comfy-Org/ComfyUI) + [Wan 2.2 open weights](https://github.com/Wan-Video/Wan2.2), or [LTX Desktop](https://github.com/Lightricks/LTX-Desktop) on suitable hardware. Their model weights, licences and GPU requirements must be checked individually.
3. **Optional subject/character swaps**: [OpenJutsu](https://github.com/D3voz/openjutsu), integrated with self-hosted ComfyUI. Validate quality and use only authorized likenesses.
4. **Voice**: evaluate GPT-SoVITS using **your own voice reference recordings**. Do not retire the existing approved August Nick narration until a matched A/B quality test passes.
5. **Lip sync/avatar**: trial [MuseTalk](https://github.com/TMElyralab/MuseTalk) or [LivePortrait](https://github.com/KlingAIResearch/LivePortrait); verify model weight licences and actual mouth accuracy before commercial use.
6. **Edit/export**: FFmpeg + your existing caption/graphics pipeline; add real licensed/archival B-roll and label any AI presenter. Keep 9:16 format, readable captions, source ledger and a pre-publish review.
7. **Delivery**: private review first. Publish only after confirmation, no auto-posting or changes to existing Stripe/Wix/Cloudflare systems.

The screenshot's [Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI) is an optional user interface, **not** a self-contained local source of Sora, Kling, Seedance or Veo weights. Its readme explicitly distinguishes paid MuAPI-hosted models from local inference.

### If you want to use your iPhone while your Mac is powered off

The open-source editor can operate from the iPhone only if the actual generation is performed on an **always-on supported machine or rented GPU** with a secure remote interface. Code hosted in GitHub is not a running service. Renting GPUs is generally metered, so the accurate target is **lower recurring subscription spend**, not promised zero cost. Avoid exposing an unrestricted ComfyUI endpoint directly to the public internet. Require authentication and TLS, private storage and secrets in a vault.

For LTX Desktop, official Nov-2026 guidance recommends Apple Silicon with 48GB+ unified memory for full local jobs, macOS 26+, and 100GB+ available disk (32GB supports reduced tasks); on Windows/Linux, 24GB+ NVIDIA VRAM is recommended. Hardware is more important than the license fee.

## Get the code (download only)

Run from a Mac/Linux terminal **when you have an authorized machine**, or from a controlled GPU host. Scripts only clone repository source; they **do not** install packages, start servers, spend credits, or deploy anything.

```bash
bash research/open-source-alternatives-2026-11/clone-selected.sh list
bash research/open-source-alternatives-2026-11/clone-selected.sh video
# Optional:
bash research/open-source-alternatives-2026-11/clone-selected.sh business
```

Default clone destination: `$HOME/ai-open-source-repositories`. To change it, pass the directory as a second argument. The `video` group includes the exact screenshot repo and video-model support tools.

**Do not run unreviewed install scripts or Docker containers.** Before installation, check current commit, issue history, package integrity, model weight licence, hardware sizing, data exposure, and any provider API fees. Pin audited revisions before automation. Keep tokens and any client data out of this repository.

## Outcome and acceptance criteria

- [x] Correct exact screenshot repository identified.
- [x] Real GitHub repositories verified for each of nine categories.
- [x] Additional open-source video/voice tooling identified.
- [x] Clone-only retrieval script proposed in a draft PR.
- [ ] Copies cloned to your chosen hardware (NOT performed).
- [ ] GPU hardware or remote compute provisioned and secured (NOT performed).
- [ ] Benchmark 9:16 animated news reel + licensed B-roll on three representative scenes.
- [ ] Authorized-voice A/B testing and optional avatar assessment.
- [ ] Measured per-video costs and quality versus Higgsfield.
- [ ] End-to-end private review and published-video QA before canceling subscriptions.

## Key official sources

- https://github.com/Anil-matcha/Open-Generative-AI
- https://github.com/Anil-matcha/Open-Generative-AI/releases
- https://github.com/Comfy-Org/ComfyUI
- https://github.com/Lightricks/LTX-Desktop
- https://github.com/Wan-Video/Wan2.2
- https://github.com/D3voz/openjutsu
- https://github.com/RVC-Boss/GPT-SoVITS
- https://github.com/alextselegidis/easyappointments
- https://github.com/calcom/cal.diy

*Collected 2026-11-13. Repository and model details can change.*
