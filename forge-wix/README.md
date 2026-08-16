# FORGE 90 — TriValley.fit Wix Member System

This folder stages the custom Velo code for the existing Tri Valley Fit Wix site. It is **not** a second website and does not use Replit or Slack.

## Target Wix site

- Site: Tri Valley Fit
- Site ID: `9e6343d9-5a1c-45e2-8596-f73408e38402`
- Domain: `https://www.trivalley.fit/`
- Timezone: `America/Los_Angeles`

## Active FORGE Pricing Plans

- Digital — `$349 / 90 days` — `29a65654-344b-4402-8d39-4da780952458`
- Coaching — `$699 / 90 days` — `500d70cb-e3c8-487e-974c-4d84bce3c4d0`
- Elite — `$1,200 / 90 days` — `7d6e11bc-a7f9-45a4-81b9-482bcf4f089e`
- Continuation — `$129/month` — `28a0386f-a21e-43ba-a171-f4dd92c945d9`

Continuation is intentionally PRIVATE and is a post-Day-90 alumni offer.

## Signup incentive

- Coupon: `FORGEFOUNDING`
- 10% off
- Maximum 25 redemptions
- Expires September 15, 2026
- Coupon ID: `9307b49d-0d62-4203-a93b-8cc54bac5710`

## FORGE forms

- Checkout/onboarding assessment: `074bfc09-c2f6-439d-abd7-fe584a01756d`
- Daily recovery/check-in: `ffb66361-d798-463b-94f9-c58ecf0825e6`

Onboarding captures age, primary goal, training experience, strength baseline, training frequency, preferred training days, session duration, equipment, training preference, injuries/limitations, current pain, and optional baseline measurements.

## Private CMS collections

- `ForgeMemberProfiles`
- `ForgeAssessments`
- `ForgeDailyWorkouts`
- `ForgeWorkoutLogs`
- `ForgeProgress`
- `ForgeRewards`
- `ForgeTrainingRules`
- `ForgeExerciseLibrary`
- `ForgeWorkoutTemplates`

The exercise library, training rules, and 3/4/5/6-day workout templates are already seeded in Wix.

## Milestone system

- FORGE 30 badge: `f4afde34-d36a-4917-b105-4769c12b7796`
- FORGE 60 badge: `6b6fae59-779c-49ec-9500-9a32429011f1`
- FORGE 90 badge: `a16884cc-f1cf-4c26-afe0-36c165ef84eb`
- Day 90 completion credit: `$100 FORGE credit` when adherence is at least 85%

Completion is based on participation/adherence, not pounds lost or appearance.

## Online Program shell

- Program: FORGE 90 — Adaptive Training Challenge
- Program ID: `96b0076e-9cfd-4f34-b226-041397b59fd5`
- Current status: DRAFT / SECRET
- Slug: `forge-90-adaptive-training`

Do not publish the Online Program until member dashboard/runtime QA is complete.

## Daily workout architecture

FORGE does not require a cron job. When an entitled member opens the FORGE dashboard for the first time on a local calendar day, the backend:

1. Verifies an active FORGE Pricing Plan.
2. Syncs the checkout onboarding assessment if it is not already stored.
3. Calculates challenge day and phase.
4. Checks whether today's workout already exists.
5. If not, selects the correct 3/4/5/6-day template and adapts it using equipment, goal, experience, prior loads/reps/RPE, energy, soreness, sleep, pain and missed sessions.
6. Writes exactly one `ForgeDailyWorkouts` record for that member/date.
7. Serves that same record for the rest of the day.
8. Saves set-by-set results and recovery feedback to `ForgeWorkoutLogs`.
9. Recalculates adherence and awards 30/60/90 milestones without duplicates.

Pain/recovery overrides progression. The engine does not diagnose medical conditions and does not use random exercise generation.

## Launch gates still requiring final connection/QA

1. Connect/verify a **live** recurring-capable payment provider in Wix. The connected Stripe workspace used during build is a sandbox.
2. Link TriValley.fit to its Wix Git Integration repository, then copy the staged `src/backend` and page code into that Wix-managed repository.
3. Create/wire the member dashboard visual elements in the Wix editor and run a test purchase/member journey.
4. Install Wix Referrals if the referral incentive is to be native inside Wix; the site currently reports Referrals as not installed.
5. Publish the secret FORGE Online Program only after the dashboard and checkout flow pass QA.
