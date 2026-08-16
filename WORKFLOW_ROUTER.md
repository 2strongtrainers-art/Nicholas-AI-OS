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
2. GitHub Actions for deterministic, reusable compute/code workflows.
3. Specialist managed service only when quality, speed, or capability justifies extra cost.
4. Replit only as a fallback/prototype environment when GitHub or native tools are insufficient.

## Default video routing
A normal plain-English request to **make, create, render, produce, or turn something into a video** routes to `workflows/default-video.yaml` unless the user explicitly requests a different engine or the requested format cannot be produced by that workflow.

Examples that should trigger the default workflow without special syntax:
- “Make me a video about the stock market.”
- “Give me a 90-second wildfire update.”
- “Turn this into a video.”
- “Make another video on this topic.”

Default video toolchain:
1. ChatGPT orchestrates and researches with the best connected/public sources for the topic.
2. ChatGPT writes separate **spoken narration** and **on-screen visual copy**.
3. ElevenLabs synthesizes the configured August Nick voice using the GitHub Actions secret-backed integration.
4. GitHub Actions + FFmpeg render and validate the video.
5. The finished MP4 and QA artifact are returned to ChatGPT after successful execution.

### Hard routing rule for Nicholas video requests
- **GitHub Actions is the primary and first execution path for video generation.**
- Do **not** probe, test, or call the legacy Replit ElevenLabs Bridge before attempting the GitHub workflow.
- A 404, timeout, or connection failure from the old Replit/ElevenLabs bridge does **not** indicate that the August Nick video workflow is unavailable.
- Use the configured GitHub Actions `ELEVENLABS_API_KEY` secret and the hard-locked August Nick voice ID for narration.
- Check the relevant GitHub Actions workflow run and artifact status before declaring a video workflow unavailable.
- Replit may be used only when the user explicitly requests Replit or when the GitHub/native workflow has been attempted and a required capability cannot be satisfied there.
- If a legacy bridge is ever used as a fallback, identify it as a fallback and never treat its health as the health of the main video system.

Do **not** default video work to Replit. Use Replit only if the user explicitly asks for it or GitHub/native tooling cannot satisfy a required capability.

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
- Video creation -> `workflows/default-video.yaml` -> research tools + ElevenLabs August Nick via GitHub Actions secrets + GitHub Actions/FFmpeg.
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
