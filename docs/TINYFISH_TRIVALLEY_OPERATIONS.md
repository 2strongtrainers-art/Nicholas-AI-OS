# TriValley.fit — TinyFish live operations and verification

**Scope:** public-site intelligence, low-cost page-change monitoring, and read-only operator handoff. **Owner:** TriValley.fit; delivery surfaces: TinyFish native Monitors, existing ChatGPT weekly business review, GitHub audit documentation. This is NOT a public website deployment, n8n credential connection, automated Chief acknowledgment, or proof of customer purchases.

**Observed deployment baseline:** 2026-11-21 04:22–04:23 UTC (Nov 20, Pacific). Five TinyFish monitors were created and returned baseline runs without errors. Scheduled follow-up execution and destination receipt remain unverified until a future run is observed.

## Active native monitors (public URLs only)

| Monitor | TinyFish monitor id | Schedule (America/Los_Angeles) | Change to review |
| --- | --- | --- | --- |
| Homepage and app entry | `72c5692b-1d49-48a6-b20b-5c3a83c13b82` | daily 07:15 | Public landing-page content, coaching/app/product calls to action |
| Coaching application | `f28f65d2-34e0-4c5d-bb8f-c6fe4aef0e74` | daily 07:18 | Public application page and advertised $297 assessment/$497 monthly online path |
| $39 dumbbell starter | `18a6358a-40e1-4150-9402-d35e9a34dbc5` | daily 07:21 | Product presence, description and advertised $39 one-time price |
| Free Training Companion | `58ba1d77-517f-4afe-837a-b1c55ea442c9` | daily 07:24 | Public entry text/reachability of `https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com/#/plan` |
| Tri-Valley local market | `58c0f603-ce04-460f-b5f1-076665080f03` | Monday 07:30 | Public search results about nearby personal training offers, **not** validated prices until the source pages are read |

All schedules use TinyFish native `CRON_TZ=America/Los_Angeles`. There is **no webhook target**, external posting, background GitHub API consumer or new n8n workflow. Existing monitors are the sole scheduled source: do not clone them in GitHub Actions or ChatGPT Automations.

## Known source-of-truth boundaries

1. **TinyFish Search/Fetch first.** Use available plan's free public Search/Fetch for research and public URL verification, within provider rate limits. For each fact use a real source URL, observed timestamp and confidence label. Free data fetch is not proof a checkout, iPhone native app or authenticated login works.
2. **Wix authoritative for site facts.** The published site is `https://www.trivalley.fit/`; native Wix Bookings/Forms/Analytics/Orders provide booking, submission and order records. The free workout app has a separate host. Distinguish page views, form starts, submissions, completed bookings and PAID orders. Check Stripe settlement for relevant online coaching sales. No fabricated conversion estimates.
3. **Existing weekly review owns the report.** The ChatGPT automation `TriValley Weekly Business & Content Review` (ID `Automation_51b4724593348191bc627c37a4569445`) was amended Nov 20 PT with the five monitor IDs, requiring read-only inspection and source verification. The schedule was preserved. A prompt update is only `CONFIGURED`, not evidence that a future scheduled run actually read TinyFish or that the Chief acknowledged it.
4. **Chief is not a second scheduled monitor.** Reuse the existing `TriValley Chief of Staff Briefing`, whose deployment/acknowledgment requirements are stricter. If the Chief needs these results, cite an actual verified weekly report or direct monitor result. Do not assert autonomous handoff until observed.
5. **GitHub is the code/audit control plane.** This runbook contains public URLs and non-secret monitor identifiers only. The TinyFish connector's authenticated access is specific to the interactive ChatGPT account and is NOT implicitly inherited by GitHub Actions, n8n or other assistants. Do not create an unattended paid integration without a securely scoped credential, separate approval and test.

## Cost and access guards

- At setup, wallet auto-reload was **OFF**. Do not enable it, add funds, or buy passes without an explicit subsequent owner decision.
- The verified wallet showed Hobby Search and Hobby Fetch at $0; native Monitor at $0.005 per run plus a Search/Fetch at the account's current rate. At 4 daily monitors and 1 weekly monitor, the nominal Monitor component is about **$0.62 per 30-day month** (4×30 + ~4.3 runs), before fees/rate changes. Verify actual billing from the current wallet instead of treating this estimate as a charge statement.
- Paid browser agent: account contract quoted $0.016 per step. Browser tasks can require additional metering. No paid agent, paid research, dataset-building, public posting or account-change permission is provisioned by this runbook.
- The current Wix connector authenticates to the correct site through its separately verified account. TinyFish browser profiles for Wix and n8n were **not verified signed-in** at setup. Never treat a profile label or cookies' existence as an authenticated n8n session.
- Respect existing `ALLOW_PAID_AI=false`, `ALLOW_OUTBOUND_SEND=false`, CRM approval/privacy gates, and the repository's `AGENTS.md`. Do not submit customer data to an external monitor.

## Weekly review/incident workflow

1. Read saved monitor status, last error, last run's URL/observed time and actual changed content. If direct monitor reads are unavailable, label **UNVERIFIED**; never hallucinate a completed scheduled run.
2. If a page changed or failed, verify a fresh direct URL fetch, canonical redirects and relevant Wix site information. Public page content alone cannot confirm real payment and access.
3. Check if a suspected offer or link regression affects a verified funnel step; use the existing Wix analytics views to measure effects. Correlate any booked assessment or paid coaching to native Wix/Stripe records without counting the same transaction twice.
4. For competitor research, reject education/advice/other non-fitness 'coaching' results; verify quoted prices by fetching the exact public page with date and offer details. Suggest one experiment, not an unsourced competitor score.
5. Report one line per outcome: `OK`, `CHANGED_REVIEW`, `FETCH_FAILED`, `AUTH_BLOCKED`, `SOURCE_UNVERIFIED`; include URL, timestamp, evidence, consequence, owner/next check, *actual* paid provider spend or `unknown`, and whether downstream Chief receipt was observed.
6. ROI: track verified assessment bookings ($297 offer), online enrollments ($497/month offer), $39 paid starter sales, recovered conversion errors and documented staff hours saved. Count attributable actual paid cash separately from hypothetical opportunity value.

## Deployment and rollback proof

- [x] Four fetch monitors active and returned initial public baselines without errors.
- [x] One weekly public competitor-search monitor active and returned an initial result set.
- [x] Existing Friday weekly business-review prompt updated and read back with unchanged schedule.
- [x] Wallet auto-reload observed OFF; no request to change.
- [ ] One naturally scheduled run per monitor verified after its baseline.
- [ ] Existing weekly review shown to consume monitor IDs in its actual scheduled execution.
- [ ] Independent Chief-of-Staff receipt/acknowledgment observed.
- [ ] TinyFish n8n/Wix private browser logins independently confirmed (optional to public monitoring).
- [ ] Physical iPhone, real client purchase/delivery and authenticated n8n end-to-end acceptance. Separate gates, not waived by these monitors.

Rollback: owner-authorized pause/cancel of native TinyFish monitors; remove or amend the specific weekly prompt suffix (preserving pre-existing content); this documentation is informational and requires no new GitHub Actions secret or hosting. Never cancel customer services, change payment processing, charge accounts or enable auto-reload as part of rollback.
