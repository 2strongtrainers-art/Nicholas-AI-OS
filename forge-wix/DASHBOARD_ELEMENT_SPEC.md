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

Recommended card labels:

- Tier
- Challenge Day
- Phase
- Adherence
- Current Streak

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

## Session feedback

- `forgeDuration` — number input, minutes
- `forgeSessionRpe` — number input, 1–10
- `forgeEnergy` — number input, 1–10
- `forgeSoreness` — number input, 1–10
- `forgeSleep` — number input, 1–10
- `forgePainFlag` — checkbox, label `I experienced pain that should affect my next workout`
- `forgePainNotes` — text input / text box
- `forgeMemberNotes` — text box

## Actions

- `forgeSaveButton` — button, label `Save Progress`
- `forgeCompleteButton` — primary button, label `Complete Workout`
- `forgeSaveStatus` — text for success/error state

## Mobile layout

1. FORGE logo/title
2. Day + phase
3. Adherence + streak
4. Today's workout title/focus/time
5. Warmup
6. Exercise repeater
7. Conditioning
8. Cooldown
9. Recovery/session feedback
10. Save Progress / Complete Workout
11. Reward banner

Keep every tap target at least mobile-button size and keep load/reps/RPE inputs on one row per set where screen width allows.

## Access behavior

The page itself should require site-member login. The backend independently verifies an ACTIVE FORGE Pricing Plan on every load and save, so page visibility alone never grants program access.
