# TriValley.fit Content Studio — 30-day starter release

**Scope:** the seven editorial techniques extracted from the owner's November 16, 2026 screenshots, implemented as a public-safe static workspace and zero-spend daily draft job.

**Campaign:** November 17 to December 16, 2026, America/Los_Angeles. The 7 a.m. weekday and 9 a.m. weekend posting windows are hypotheses, not validated channel analytics.

## Included

1. 30 dated drafts across seven fitness/coaching pillars.
2. 50 original ideas with hooks, takeaways and formats.
3. 10 complete 0–35-second Reel scripts with 3-second hooks, visual directions, pattern interrupts, CTAs and captions.
4. Three ten-slide Instagram carousel storyboards (30 slides; not yet rendered PNGs).
5. Example content repurposed as five Reels, three carousel outlines, five short posts and two LinkedIn posts.
6. Five rule-based caption variants and five niche hashtags for each topic (not a live trending-hashtag service).
7. Daily GitHub Actions draft packaging into JSON, Markdown and a SHA-256 receipt. No model API or social posts.

## Preview and hosting

The existing Global Intelligence Desk GitHub Pages workflow publishes the entire intel-desk directory. The studio lives in intel-desk/content-studio to use the same deployment artifact **without** replacing the intelligence dashboard, creating a second Pages publisher or requiring new hosting credentials.

Expected address **only after a successful Pages deployment and live check**:

https://2strongtrainers-art.github.io/Nicholas-AI-OS/content-studio/

The parent repository is public. This is NOT a private login portal. Do not enter any sensitive client records, passwords, private portrait/voice source files, financial information or unapproved testimonials. The noindex tag is a search-engine request, not access control.

## Local testing and daily drafts

Use Node.js 22 from the repository root:

- Test: node --test tests/test_content_studio.mjs
- Syntax: node --check intel-desk/content-studio/data.js
- Daily pack: ALLOW_PAID_AI=false ALLOW_OUTBOUND_SEND=false node intel-desk/content-studio/build-daily.mjs 2026-11-17 /tmp/trivalley-content-draft
- Local preview: serve the intel-desk/content-studio folder with an ordinary static HTTP server.

The workflow at .github/workflows/trivalley-content-studio.yml runs at 16:15 UTC (8:15 a.m. PST; 9:15 a.m. PDT, subject to GitHub delay). It checks the Pacific date; outside this campaign it produces OUT_OF_CAMPAIGN rather than content. The workflow remains scheduled after Dec 16, so the Chief should explicitly disable or extend it after review.

## Existing production integrations

The Reel script button exports JSON with fields that can be manually mapped to the **existing** n8n TriValley.fit Show Me One Rep Data Table: episode_id, headline, cue, shot_list, caption, asset_status=awaiting_footage, review_status=draft, booking_url.

**No authenticated n8n call, n8n execution receipt, automatic social publishing, Wix edit, media rendering, payment, model call or Chief acknowledgment is implemented.** Do not clone the live Reel intake/review/status triggers. Any later integration must use the existing owner-authorized Data Table and observe a deduplicated n8n receipt.

The approved private media route remains scripts/render_trivalley_reel.py, .github/workflows/render-trivalley-reel.yml and scripts/render_trivalley_lesson.py. Source/claim review guidance is docs/FITNESS_VIDEO_PLAYBOOK.md. Visual creative standard is .agents/skills/trivalley-chief-of-staff/references/carousel-standard.md, including 1080×1350 output and legibility when downscaled to 360×450. The interface contains storyboards only, not finished creative files.

Research signals for topic selection:
- ACSM 2026: https://doi.org/10.1249/fit.0000000000001110
- ACSM 2027: https://doi.org/10.1249/fit.0000000000001208

The surveys do not validate virality or treatment outcomes. Independently review all scientific/health claims and filming permissions.

The public $297 Elite Assessment and existing booking URL are unchanged. Preserve the live $497 monthly coaching checkout, $39 product checkout and Stripe/Wix workflows.

## Release acceptance

1. CI tests pass and the PR is reconciled against current main/open PRs.
2. Existing GitHub Pages workflow actually deploys the content-studio directory.
3. An external fresh browser loads the live site and checks mobile UI, copy and export.
4. A real GitHub daily draft run produces matching JSON, Markdown and receipt with verifiable hash.
5. A separate Chief or authorized reviewer acknowledges the artifact. Only then schedule approved media production. Social posting still requires its own authorization and provider receipt.

Repository code alone means BUILT, not DEPLOYED. A draft receipt means PREPARED_NOT_PUBLISHED, not published or END_TO_END.
