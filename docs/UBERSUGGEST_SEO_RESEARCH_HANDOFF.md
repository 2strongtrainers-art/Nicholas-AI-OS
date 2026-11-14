# Ubersuggest SEO Research — ChatGPT, Muse and TriValley.fit Handoff

**Status (November 14, 2026): Official Ubersuggest connector OAuth VERIFIED in a regular ChatGPT conversation. `auth_status` returned authenticated=true, tier=free; `user_limits` returned three daily reports remaining (0/3 used), one project slot available (0/1 used), and ten monthly keyword metrics updates remaining (0/10 used). `validate_site` confirmed `trivalley.fit` is a valid domain; `list_projects` returned no projects. No keyword/competitor report has been run, no Ubersuggest project created, and no Phil/Muse receipt established. ChatGPT Work usage exhaustion is separate from this functioning connector.**
**Owner:** TriValley.fit | **Data scope:** public business-site SEO and approved Ubersuggest account/project data.

## Objective

Improve demand-led selection, verification and tracking of original TriValley.fit website articles, fitness guides and educational social content. Use Ubersuggest as an optional **research data source**, not as a direct messaging bridge to Phil/Muse, not as a publisher, and not as proof of real Instagram engagement.

Follow `AGENTS.md` and `WORKFLOW_ROUTER.md`. Native tools and existing Wix/Google Drive/GitHub workflows remain authoritative for their own domains. Do not introduce a new Replit service simply to call Ubersuggest.

## Available connection paths (in preferred order)

1. **Official ChatGPT app:** Vendor page https://ubersuggest.com/en/chatgpt-app links to
   https://chatgpt.com/apps/ubersuggest/asdk_app_69457f8444848191918f7c00fea68076.
   Open on a supported ChatGPT surface, select Install/Connect when actually offered, and complete Ubersuggest sign-in/authorization in the provider's consent flow. App availability varies by ChatGPT plan, workspace, client and rollout. A vendor deep link does **not** prove that a tool is installed or callable in this runtime.
2. **Direct remote MCP (fallback where custom MCP support is allowed):** Use an authorized ChatGPT **web** custom MCP setup or an independently confirmed MCP-compatible client. Vendor's documented Streamable HTTP endpoint is
   `https://ubersuggest-mcp.neilpatelapi.com/mcp`. It requires OAuth 2.0 browser sign-in. Never paste access/refresh tokens into chats, files, GitHub commits or the public Worker. Custom-MCP creation capabilities differ by account/workspace and are not available from ChatGPT mobile alone. Do not choose Claude/Cursor from vendor examples unless that is the *actual* client in use.
3. **Muse/Phil:** Muse is an agent/production recipient, **not** an MCP client name in the vendor's drop-down. Once the Ubersuggest plugin is installed in ChatGPT, verify that it is available to Muse through its connected Plugins permissions (dot profile > Customize > Plugins), then have Muse call a **read-only** SEO tool. If the app isn't available to Muse, send an evidenced research summary through the previously approved private handoff inbox; do not claim a native Muse connection.
4. **Nicholas AI Switchboard / Cloudflare:** Future optional automation adapter, **not yet implemented**. Use only after separate security review, per-user OAuth refresh handling, access restrictions, quota guards, and end-to-end test evidence. Existing `/ask` / `/tools/route` cannot be represented as an Ubersuggest MCP bridge. Never silently turn the tool router into a general unrestricted MCP proxy.

Authoritative setup: https://ubersuggest-mcp.neilpatelapi.com/docs and
https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt.
Vendor marketing pages and MCP docs currently describe different tool counts; discover the tools actually exposed by the connected account instead of promising a hard count.

## First connection verification (do not skip)

**Verified read-only checks (2026-11-14):** successful authenticated account status, limits, public-site validation and empty projects list from this ChatGPT runtime. **Open:** keyword research sample, SEO metrics and independent Muse/Phil tool access. Respect the user's exhausted Work allocation; this connector currently works without Work.

1. Confirm the intended Ubersuggest account and approved TriValley.fit project, if one exists. Do not recreate duplicates.
2. Have the actual client enumerate its **live** tools. Try `auth_status` and `user_limits` if present. These vendor tools report account sign-in/tier and plan quotas; handle errors as errors.
3. Verify the account can access useful **read-only** functionality: `validate_site` for `trivalley.fit`, a keyword report, domain competitor analysis, or a site audit. Use `location_suggest` to resolve exact location IDs rather than guessing them. Target English and the relevant U.S./California/Tri-Valley market if the account allows local granularity.
4. Record date, query, country/location, language, source tool, returned metric names, quota/cost, and links to original evidence. Search-volume and traffic numbers are estimates, not exact visits, conversion guarantees or social-virality predictions.
5. Check whether the relevant Muse/Phil recipient can independently read the approved summary or live tools. **Received** requires explicit acknowledgment; a committed document, assigned task or shared link is only **prepared**.
6. Only after these checks set the state to `VERIFIED_READONLY`. Otherwise `CONNECTION_PENDING` or `BLOCKED` with exact missing permissions.

## SEO research -> content production workflow

**Research owner:** ChatGPT / Chief of Staff, with Ubersuggest when live. **Production owner:** Phil/Muse when assigned. **Business verification:** Wix/owner. **Approval:** owner or distinct authorized standing mandate.

1. **Select topic** using query demand, search intent, topical relevance, site content gap and seasonality. Example candidates: *HYROX beginner training*, *preparing for your first HYROX*, *running after sled pushes*. Do not claim actual volumes until retrieved from live Ubersuggest tools.
2. **Evidence card** per selected topic:
   - Brief/task ID; headline/question; audience and intent; location/language; measured as-of date.
   - Actual keyword terms, monthly search-volume **estimates**, SEO difficulty, CPC or trend if returned (do not fabricate missing figures).
   - Main competing domains/pages and their demonstrated content gaps, plus original source links and rights review.
   - Practical viewer takeaway, claim ledger, intended channel (web page, guide, carousel, Reel), one offer and canonical verified CTA.
   - Known limits and uncertainty; estimated quota use, and whether paid credit-consuming actions are disabled.
3. **Handoff**: write the evidence card to the *authorized private* Phil inbox or an already verified channel. Mark `PREPARED`, then require actual `ACKNOWLEDGED` from Phil before calling it delivered.
4. **Create**: Phil produces original content, readable on a phone, with accurate human movement references and TriValley.fit brand assets. SEO evidence informs framing; it is not permission to copy a competitor's content or photos. Make social hooks platform-appropriate, not keyword stuffing.
5. **QA + owner review**: facts checked against primary sources; price/offer and booking link verified in Wix, rights cleared, no false partnership claims, source notes attached. Preserve publication and paid-generation gates.
6. **Measure separately**: for site content, evaluate Search Console impressions/clicks, rankings and actual bookings; for Instagram, evaluate saves/reach, shares/reach and qualified traffic. Do not attribute results to Ubersuggest without a controlled comparison.

## Proposed cadence (not active until approved and connected)

- Per new fitness product/content request: lightweight keyword opportunity check; reuse cached same-day subjects where possible.
- Weekly: top three evidenced topics, competing page opportunities and website technical blockers for the Chief of Staff.
- Monthly: compare the tracked keywords/AI visibility with actual Wix bookings and content outcomes.

Avoid unnecessary provider calls. Ubersuggest says MCP calls share the plan's existing daily-report/monthly-credit quotas. `generate_article` consumes **100 monthly credits** and is **NOT** a default permitted action; do not use paid-writing, project mutations, list deletions, outbound sends or publications without required authorization and applicable kill-switch status. Respect `ALLOW_PAID_AI=false` and `ALLOW_OUTBOUND_SEND=false` in existing repo workflows.

## Acceptance test

- [x] The ChatGPT Ubersuggest tool is callable, the account is authenticated and its free-tier limits were read successfully on November 14, 2026.
- [x] `auth_status` + `user_limits` returned real account data. `validate_site` confirmed trivalley.fit. No daily report quota was consumed.
- [ ] One read-only TriValley.fit keyword/site query succeeds with actual data and documented units/time/location.
- [ ] A source-backed content evidence card is stored in the private handoff.
- [ ] Phil independently acknowledges the exact task/version and returns one deliverable/QA receipt.
- [ ] No tokens/credentials/private assets in GitHub, logs, public URLs or model prompts.
- [ ] Production and publication gates remain intact, with no unapproved credits spent.

**Not an integration success criterion:** a documentation screenshot, a healthy unauthenticated MCP URL, a GitHub commit, a Google Doc link, or a model saying it has read the source. Those do not establish account connectivity or Phil receipt.
