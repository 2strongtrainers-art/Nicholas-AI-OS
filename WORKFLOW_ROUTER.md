# Workflow Router

## Objective
Turn a plain-English request into the smallest reliable toolchain that completes the job, verifies the result, and preserves reusable improvements.

## Routing sequence
1. **Intent** — classify domain, output, urgency, freshness, privacy, and cost sensitivity.
2. **Context** — retrieve only the private or connected context needed for the task.
3. **Plan** — choose the minimum sufficient toolchain.
4. **Execute** — perform the work using native/connected tools first.
5. **Verify** — check factual accuracy, completion, formatting, and acceptance criteria.
6. **Deliver** — return the finished artifact/result.
7. **Learn** — record reusable improvements when a workflow repeats or materially improves.
8. **Automate** — convert recurring work into GitHub Actions or ChatGPT automations where appropriate.

## Default routing priority
1. Native ChatGPT capability or directly connected plugin if it fully fits the task.
2. GitHub Actions or the GitHub-backed Mac worker for deterministic, reusable compute/code workflows.
3. Specialist managed service only when quality, speed, or capability justifies extra cost.
4. Replit only as a fallback/prototype environment when GitHub or native tools are insufficient.

## Default video routing
Video requests are split by the kind of editing actually required instead of sending every job through one production pipeline.

### 1. Short-form social video / supplied footage
Requests for an Instagram Reel, Short, TikTok-style edit, or a roughly 15–90 second social video—especially when the user supplies clips—route to the GitHub-backed **OpenMontage Fast Reel** path.

ChatGPT is the editor/director. Before queueing the job it should:
1. Inspect the available source footage and identify the strongest opening moments.
2. Choose the clip order and trim points.
3. Write the hook, concise on-screen beats, and CTA.
4. Add August Nick narration only when it improves the video.
5. Queue one deterministic `openmontage_video` job using `fast_reel.clips` for the edit decision list.
6. Let the Mac worker assemble the clips with FFmpeg, render the 1080x1920 Remotion template, validate the MP4, create QA output, and deliver it through iCloud/chat delivery.

Normal requests such as these should use Fast Reel without requiring special syntax:
- “Turn these three clips into a 45-second Reel.”
- “Edit this training footage into an Instagram Reel.”
- “OpenMontage bridge this into a Reel.”
- “Make a quick social video from these clips.”

### 2. Narrated informational video without supplied footage
Research-driven explainers such as a market update, wildfire brief, or informational video that does not primarily depend on user-supplied footage route to `workflows/default-video.yaml`.

Default informational-video toolchain:
1. ChatGPT researches with the best connected/public sources for the topic.
2. ChatGPT writes separate **spoken narration** and **on-screen visual copy**.
3. ElevenLabs synthesizes the configured August Nick voice using the GitHub Actions secret-backed integration.
4. GitHub Actions + FFmpeg render and validate the video.
5. The finished MP4 and QA artifact are returned to ChatGPT after successful execution.

### 3. Full production
Use OpenMontage `full_production` only when the request explicitly calls for research-heavy sourcing, internet footage, documentary/cinematic treatment, custom scene development, extensive AI generation, complex audio, or multi-stage editorial work.

An explicit `render_mode` always wins. Ordinary Reel requests default to `fast_reel`; advanced-production phrases may route to `full_production`.

### Hard routing rules for Nicholas video requests
- GitHub remains the control plane and audit trail. For short-form footage editing, the Mac OpenMontage worker is the renderer; for informational videos, GitHub Actions is the renderer.
- Do **not** probe, test, or call the legacy Replit ElevenLabs Bridge before attempting the appropriate GitHub-backed workflow.
- A 404, timeout, or connection failure from the old Replit/ElevenLabs bridge does **not** indicate that the current video system is unavailable.
- Use the configured GitHub Actions `ELEVENLABS_API_KEY` secret and the hard-locked August Nick voice ID for narration when narration is requested.
- Check the relevant queue job, worker heartbeat, workflow run, and artifact status before declaring a video workflow unavailable.
- Replit may be used only when the user explicitly requests Replit or when the GitHub/native workflow has been attempted and a required capability cannot be satisfied there.
- If a legacy bridge is ever used as a fallback, identify it as a fallback and never treat its health as the health of the main video system.

Do **not** default video work to Replit.

For narration, default to the `conversational_nick` delivery profile: speech should sound like Nicholas explaining something naturally to one person, not reading the on-screen cards or a written report verbatim.

## Domain routing
- Personal finance / balances / spending / debts / holdings -> Finances.
- Live market data / options / pricing -> Alpaca.
- Email -> Gmail.
- Scheduling -> Google Calendar; resolve people with Google Contacts when needed.
- CRM / client pipeline -> HubSpot; prospecting -> Apollo.
- Human-readable knowledge / SOPs -> Notion.
- Structured operations registry -> Airtable when structure adds value.
- Websites -> Wix.
- Payments / products / payment links -> Stripe.
- Product analytics -> PostHog.
- Design -> Canva or native image generation.
- Short-form video with supplied footage -> GitHub queue -> OpenMontage Fast Reel -> FFmpeg EDL + Remotion -> QA/delivery.
- Research/narrated informational video -> `workflows/default-video.yaml` -> research tools + ElevenLabs August Nick via GitHub Actions secrets + GitHub Actions/FFmpeg.
- Advanced/cinematic production -> OpenMontage `full_production`.
- Current public research -> web; deep web/data research -> Exa; academic -> Sider Scholar; freshness/unknown-unknown support -> Acumen when useful.
- Durable automation / scripts / versioned workflows -> GitHub.

## Cost Guard
Prefer, in order:
1. Included/native capabilities.
2. Included GitHub Actions quota and free/owned APIs.
3. Paid specialist tools only when the expected benefit is material.
4. Replit only when it solves a unique problem that cheaper options cannot.

Never expose secrets in repository source files. Secrets must be entered through GitHub Actions Secrets or another secure credential store.

## QA Gate
Before calling a workflow complete:
- Verify current facts against appropriate sources.
- Confirm code/workflow execution when execution is required.
- Check output against the user's requested format and acceptance criteria.
- Do not claim a workflow works until it has been tested end-to-end.

## Learning Loop
For repeated workflows, preserve:
- What input pattern triggered the workflow.
- Which tools were used.
- What failed or caused friction.
- What improved speed, quality, or cost.
- The version that produced the best verified result.

This is operational learning, not modification of the underlying GPT model weights.
