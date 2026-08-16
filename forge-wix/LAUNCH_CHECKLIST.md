# FORGE 90 — Launch Checklist

## Status legend

- ✅ Built / configured now
- 🧪 Requires end-to-end QA before public launch
- 🔐 Requires owner/payment-provider authorization in Wix
- 🎨 Requires visual Wix Editor placement because Wix does not expose arbitrary Editor element construction through the normal REST site-management API
- ⏸ Intentionally held until QA passes

---

## 1. Commerce and offer structure

- ✅ FORGE 90 Digital — `$349 / 90 days`
- ✅ FORGE 90 Coaching — `$699 / 90 days`
- ✅ FORGE 90 Elite — `$1,200 / 90 days`
- ✅ FORGE Continuation — `$129/month`
- ✅ Continuation is PRIVATE, preventing a public shortcut around FORGE 90
- ✅ Founding 25 launch incentive: `FORGEFOUNDING`, 10% off, max 25 redemptions, expires Sep 15, 2026
- ✅ Checkout onboarding form attached to Digital / Coaching / Elite
- 🔐 Verify/connect the **live** Wix payment provider that supports recurring billing. The Stripe workspace used during setup was sandbox/test-side and must not be treated as live customer settlement.

### Payment QA

- 🧪 Complete one Digital test purchase
- 🧪 Confirm the purchaser becomes a Wix site member / can sign in
- 🧪 Confirm the checkout form submission ID is available on the Pricing Plan order
- 🧪 Confirm dashboard entitlement succeeds only while the FORGE order is ACTIVE
- 🧪 Complete one test cancellation/expiration and verify dashboard access is denied afterward
- 🧪 Simulate Day 90 and confirm private Continuation checkout opens from inside the dashboard

---

## 2. Member onboarding

- ✅ First name
- ✅ Last name
- ✅ Email
- ✅ Age
- ✅ Primary goal
- ✅ Training experience
- ✅ Strength baseline
- ✅ Training days per week
- ✅ Preferred weekdays
- ✅ Session duration
- ✅ Equipment / gym access
- ✅ Preferred training style
- ✅ Injuries / limitations
- ✅ Current pain areas
- ✅ Optional baseline measurements
- ✅ Private `ForgeAssessments` fields match the form values
- ✅ Backend imports the checkout form submission into the member assessment once

### Onboarding QA

- 🧪 Verify each form field maps to the expected `ForgeAssessments` value
- 🧪 Verify missing optional values do not block workout generation
- 🧪 Verify a missing required assessment produces the onboarding-required dashboard state rather than generating a guess-based program

---

## 3. Adaptive daily workout engine

- ✅ Private exercise library seeded
- ✅ Training rules seeded
- ✅ 3-day templates seeded
- ✅ 4-day templates seeded
- ✅ 5-day templates seeded
- ✅ 6-day templates seeded
- ✅ Foundation / Build / Performance / Alumni phase logic
- ✅ Equipment-aware exercise filtering
- ✅ Beginner/advanced filtering
- ✅ Prior set/reps/load/RPE progression logic
- ✅ Low-recovery volume and intensity reduction
- ✅ Pain flag overrides progression
- ✅ Conservative pain-pattern substitutions / coach-review status
- ✅ No diagnosis logic
- ✅ No punishment/double-hard sessions after a missed workout
- ✅ Recovery / mobility daily session on non-lifting days
- ✅ One generated workout per member per local calendar day
- ✅ `dailyKey` field added to `ForgeDailyWorkouts`
- ✅ Unique CMS index `forge-daily-key-unique` ACTIVE
- ✅ Backend also handles a simultaneous-request race by re-reading the winning daily record

### Generator QA cases

- 🧪 Beginner + commercial gym + 3 days
- 🧪 Intermediate + home dumbbells + 4 days
- 🧪 Advanced + full gym + 5/6 days
- 🧪 High RPE previous session
- 🧪 Low sleep / low energy
- 🧪 High soreness
- 🧪 Shoulder pain flag
- 🧪 Knee pain flag
- 🧪 Low-back pain flag
- 🧪 Non-training preferred weekday
- 🧪 Double refresh / simultaneous dashboard requests return the same workout ID

---

## 4. Workout logging

- ✅ Exercise name
- ✅ Up to 3 working-set rows per current template
- ✅ Load
- ✅ Reps
- ✅ Set RPE
- ✅ Session duration
- ✅ Session RPE
- ✅ Energy
- ✅ Soreness
- ✅ Sleep quality
- ✅ Pain flag
- ✅ Pain notes
- ✅ Member notes
- ✅ Save-progress flow
- ✅ Complete-workout flow
- ✅ Completed workouts feed adherence and future progression

### Logging QA

- 🧪 Save partial workout, reload, then complete
- 🧪 Confirm completed session affects the next generated workout
- 🧪 Confirm pain flag changes the next generated session
- 🧪 Confirm duplicate completion does not double-increment rewards

---

## 5. Progress tracking

- ✅ Challenge day / phase
- ✅ Adherence
- ✅ Workout streak
- ✅ Workouts completed
- ✅ Optional weight
- ✅ Optional waist/chest/hips/arm/thigh/calf measurements
- ✅ Push-up benchmark
- ✅ Plank benchmark
- ✅ Recovery score
- ✅ Sleep hours
- ✅ Progress notes
- ✅ Progress-history repeater logic staged
- ✅ Backend supports progress-photo URLs
- 🎨 Add secure member photo-upload control after the actual Wix Git Integration page is connected

---

## 6. Milestones and rewards

- ✅ FORGE 30 badge created
- ✅ FORGE 60 badge created
- ✅ FORGE 90 badge created
- ✅ Day 30 reward rule
- ✅ Day 60 reward rule
- ✅ Day 90 badge requires >=85% adherence
- ✅ Day 90 `$100 FORGE credit` requires >=85% adherence
- ✅ Reward ledger prevents duplicate milestone awards
- ✅ Completion is based on adherence, not pounds lost or appearance

### Reward QA

- 🧪 Simulate Day 29 → no Day 30 reward
- 🧪 Simulate Day 30 → one FORGE 30 reward
- 🧪 Simulate Day 60 → one FORGE 60 reward
- 🧪 Simulate Day 90 at 84% → no Day 90 completion reward
- 🧪 Simulate Day 90 at 85%+ → badge + $100 credit once

---

## 7. Native FORGE referrals

- ✅ No Slack / no referral SaaS dependency
- ✅ No Wix Referrals app dependency
- ✅ Member profile `referralCode`
- ✅ Member profile `referredByCode`
- ✅ Personal referral code generated for active paid members
- ✅ One referral redemption per new paid membership
- ✅ Self-referrals rejected
- ✅ Invalid codes rejected
- ✅ Referrer gets `$25 FORGE credit`
- ✅ New paid member gets `$25 FORGE credit`
- ✅ Credits stored in `ForgeRewards`
- ✅ Referral-credit business rule stored in `ForgeTrainingRules`
- ✅ Credits explicitly non-cash and intended for future FORGE purchases/services

### Referral QA

- 🧪 Member A loads dashboard and receives code
- 🧪 Member B buys FORGE and redeems A's code
- 🧪 A receives one $25 credit
- 🧪 B receives one $25 credit
- 🧪 B cannot redeem another code
- 🧪 A cannot redeem A's own code
- 🧪 Re-submitting the same code cannot duplicate either reward

---

## 8. Day-90 retention

- ✅ `$129/month` Continuation plan exists
- ✅ Continuation plan is private
- ✅ Day-90 dashboard card staged
- ✅ Direct Wix Pricing Plans checkout staged inside dashboard
- ✅ Existing Continuation member sees ACTIVE state rather than a second purchase CTA

---

## 9. FORGE member dashboard visual page

The page behavior is staged in `src/pages/forge-dashboard.js` and the exact required Wix element IDs are in `DASHBOARD_ELEMENT_SPEC.md`.

- 🎨 Create members-only page `/forge-dashboard`
- 🎨 Place elements using `DASHBOARD_ELEMENT_SPEC.md`
- 🎨 Apply black/charcoal + silver/white + muted gold FORGE design
- 🎨 Mobile-first layout
- 🎨 Paste/link the page code through the Wix Git Integration repo
- 🧪 Preview as non-member
- 🧪 Preview as active Digital member
- 🧪 Preview as Coaching member
- 🧪 Preview as Elite member
- 🧪 Preview as Day-90 member
- 🧪 Preview as Continuation member

---

## 10. Wix Git Integration / deployment

The current code is safely staged on GitHub branch:

`2strongtrainers-art/Nicholas-AI-OS` → `forge-wix-build`

- ✅ Backend configuration staged
- ✅ Adaptive generator staged
- ✅ Member engine staged
- ✅ Native referral engine staged
- ✅ Dashboard page code staged
- ✅ Element blueprint staged
- ✅ Landing-page copy staged
- 🔐/🎨 Connect the **actual TriValley.fit Wix site** to its Wix-managed Git Integration repository if it is not already connected
- 🎨 Copy the staged `forge-wix/src/backend` and page code into that Wix-linked repository / page
- 🧪 Run Wix preview / dev checks
- 🧪 Publish only after payment + entitlement + workout + reward QA passes

Do **not** merge the staging branch into unrelated production code merely to make it disappear; deployment should be intentional.

---

## 11. FORGE Online Program shell

- ✅ Draft secret program exists: `FORGE 90 — Adaptive Training Challenge`
- ✅ Program ID `96b0076e-9cfd-4f34-b226-041397b59fd5`
- ✅ Secret access
- ✅ Sequential progress / future steps hidden
- ⏸ Keep DRAFT while the custom dashboard is under QA
- ⏸ Publish only if the Online Program shell adds value after the custom member dashboard is live; the custom daily engine does not depend on publishing it

---

## 12. Launch decision

FORGE is ready for public enrollment only when all four are true:

1. **Live payment provider verified**
2. **Wix member dashboard elements connected to the staged code**
3. **One full paid-member journey passes QA**
4. **No test/sandbox checkout appears in the public path**

Everything else above can remain private while those final gates are completed.
