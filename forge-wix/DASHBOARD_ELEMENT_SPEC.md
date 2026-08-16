# FORGE Member Dashboard — Wix Editor Element Blueprint

Create one **members-only** page named `FORGE Dashboard` with route `/forge-dashboard`. Keep the visual system premium and simple: black/charcoal background, white/silver body copy, muted gold accents, large readable workout prescriptions, mobile-first spacing.

The page code in `src/pages/forge-dashboard.js` expects these element IDs.

## Page state containers

- `forgeLoading` — text/loading indicator
- `forgeNoAccessBox` — box, collapsed by default
  - `forgeNoAccessTitle` — text
  - `forgeNoAccessText` — text
- `forgeDashboardBox` — main box, collapsed while loading

## Member summary

- `forgeTier` — text
- `forgeDay` — text
- `forgePhase` — text
- `forgeAdherence` — text
- `forgeStreak` — text
- `forgeRewardBanner` — text/box, hidden by default

Recommended card labels: Tier, Challenge Day, Phase, Adherence, Current Streak.

## Today's workout

- `forgeWorkoutName` — heading
- `forgeFocus` — text
- `forgeTime` — text
- `forgeReason` — text; use smaller muted style
- `forgeWarmup` — text
- `forgeConditioning` — text
- `forgeCooldown` — text

## Exercise repeater

Repeater ID: `exerciseRepeater`

Inside each repeater item:

- `exerciseName` — heading/text
- `exercisePrescription` — text
- `exerciseGuidance` — text
- `exerciseAlternatives` — text

Set 1 container: `set1Box`
- `set1Load` — number input, label `Load`
- `set1Reps` — number input, label `Reps`
- `set1Rpe` — number input, label `RPE`

Set 2 container: `set2Box`
- `set2Load`
- `set2Reps`
- `set2Rpe`

Set 3 container: `set3Box`
- `set3Load`
- `set3Reps`
- `set3Rpe`

The seeded FORGE strength templates currently prescribe a maximum of 3 working sets per exercise; unused set containers collapse automatically.

## Daily session feedback

- `forgeDuration` — number input, minutes
- `forgeSessionRpe` — number input, 1–10
- `forgeEnergy` — number input, 1–10
- `forgeSoreness` — number input, 1–10
- `forgeSleep` — number input, 1–10
- `forgePainFlag` — checkbox, label `I experienced pain that should affect my next workout`
- `forgePainNotes` — text box
- `forgeMemberNotes` — text box
- `forgeSaveButton` — button, label `Save Progress`
- `forgeCompleteButton` — primary button, label `Complete Workout`
- `forgeSaveStatus` — text for success/error state

## FORGE referral card

Every active paid member gets a personal referral code. When a new paid member applies an existing member's code, both members receive a `$25 FORGE credit`. Each new membership can redeem one referral code and self-referrals are rejected.

- `forgeReferralBox` — collapsible box
- `forgeReferralCode` — prominent text showing the member's personal code
- `forgeReferralOffer` — explanatory text
- `forgeReferralRedeemBox` — collapsible box containing the redemption controls
- `forgeReferralInput` — text input, label `Referral code`
- `forgeReferralButton` — button, label `Apply Referral Code`
- `forgeReferralStatus` — text

Credits are stored in `ForgeRewards`, are not cash redeemable, and remain unredeemed until they are applied to a future FORGE purchase/service.

## FORGE consistency leaderboard

The leaderboard is **opt-in only** and ranks consistency rather than body composition. Default state is private. A member can choose a public display name; email, legal name, weight, photos, measurements, pain data, and assessment details are never returned by the leaderboard API.

- `forgeLeaderboardBox` — collapsible box
- `forgeLeaderboardMetric` — explanatory text, e.g. `Adherence first • then streak • then workouts completed`
- `forgeLeaderboardOptIn` — checkbox, label `Show me on the FORGE consistency leaderboard`
- `forgeLeaderboardDisplayName` — text input, label `Leaderboard display name`
- `forgeLeaderboardSaveButton` — button, label `Save Leaderboard Preference`
- `forgeLeaderboardStatus` — text
- `forgeLeaderboardRepeater` — repeater containing the top 20 opted-in members

Inside each leaderboard row:
- `leaderboardRank` — text
- `leaderboardName` — text
- `leaderboardAdherence` — text
- `leaderboardStreak` — text

Ranking order: adherence percentage descending, then current streak descending, then workouts completed descending.

## 30 / 60 / 90 progress check-in

Use a separate card or collapsible section below the workout. Body weight and measurements are optional and are never challenge-completion requirements.

- `forgeProgressWeight` — number input, optional
- `forgeProgressWaist` — number input, optional
- `forgeProgressChest` — number input, optional
- `forgeProgressHips` — number input, optional
- `forgeProgressArm` — number input, optional
- `forgeProgressThigh` — number input, optional
- `forgeProgressCalf` — number input, optional
- `forgeProgressPushups` — number input, optional
- `forgeProgressPlank` — number input, seconds, optional
- `forgeProgressRecovery` — number input, 1–10
- `forgeProgressSleepHours` — number input
- `forgeProgressPerformanceNotes` — text box
- `forgeProgressNotes` — text box
- `forgeProgressButton` — button, label `Save Progress Check-In`
- `forgeProgressStatus` — text

Progress-history repeater ID: `forgeProgressHistory`

Inside each progress-history row:
- `progressHistoryDay` — text
- `progressHistoryWeight` — text
- `progressHistoryWaist` — text
- `progressHistoryRecovery` — text

The backend supports `photoUrls` in the progress record. Progress-photo upload should be added after the page is linked to the actual Wix Git Integration repo so Wix Media Manager upload can be bound to the member page safely.

## Day-90 completion recognition

This card is hidden until the member reaches Day 90 with at least 85% adherence. It is designed as a clean black/gold screenshot-ready recognition card that pairs with the member's FORGE 90 badge.

- `forgeCompletionBox` — collapsible card/box
- `forgeCompletionTitle` — heading
- `forgeCompletionBadge` — large badge-style text
- `forgeCompletionStats` — text
- `forgeCompletionShareText` — text formatted cleanly for a screenshot/share

Recommended visual treatment: centered black card, thin muted-gold border, large `FORGE 90`, smaller adherence line, tagline `Strength. Discipline. Brotherhood.`

## Day-90 continuation card

This card stays collapsed before Day 90. On Day 90 and later it gives qualified members a direct in-dashboard purchase path to the private `$129/month` FORGE Continuation plan.

- `forgeContinuationBox` — collapsible box
- `forgeContinuationTitle` — heading
- `forgeContinuationText` — text
- `forgeContinuationButton` — button
- `forgeContinuationStatus` — text

The page code calls Wix Pricing Plans checkout directly using the private Continuation plan ID. If the member already owns Continuation, the card displays the active state and hides the purchase button.

## Mobile layout

1. FORGE logo/title
2. Day + phase
3. Adherence + streak
4. Today's workout title/focus/time
5. Warmup
6. Exercise repeater
7. Conditioning
8. Cooldown
9. Daily recovery/session feedback
10. Save Progress / Complete Workout
11. Reward banner
12. Referral card
13. Consistency leaderboard
14. 30/60/90 progress check-in
15. Progress history
16. Day-90 completion card when qualified
17. Day-90 Continuation card when eligible

Keep every tap target at least mobile-button size and keep load/reps/RPE inputs on one row per set where screen width allows.

## Access behavior

The page itself should require site-member login. The backend independently verifies an ACTIVE FORGE Pricing Plan on every load and save, so page visibility alone never grants program access.
