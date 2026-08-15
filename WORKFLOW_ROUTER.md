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
