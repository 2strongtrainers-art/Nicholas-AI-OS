# TriValley FIT v4 — controlled release / acceptance checklist

Status: source changes staged in draft PR #184. Do not infer hosted release status from this document.

## Verified v4 source functions
- Reuses pinned OpenGym React/store/workout/stats/progression engine and AGPL credit.
- Puts Start or Resume workout above calendar. Does not mislabel an unconfigured guest as a rest day.
- Makes Scripture an optional inline Home card, keeping manual dialog and opt-out.
- Turns duplicate library filters into an accessible bottom sheet, keeping Saved, Plan and Recent.
- Adds search ranking/aliases and keeps historical exercise IDs.
- Adds checksum-verified backups, validated import and legacy backup compatibility. No upload to cloud.
- Prevents duplicate finish records and tests 320/375/390/430px layouts.
- Generates a versioned release file, tv-release.json, with sourceCommit and main-asset SHA256.

## Acceptance gates
1. Node deterministic unit tests for search/backup pass.
2. Original upstream training tests and Vite compilation pass; AGPL source and exercise-media licensing checks remain enforced.
3. Mobile Chromium tests cover Home CTA, saved plan, logged sets, history, search, modal filters, inline verse, backup continuity and offline reload.
4. The ACTUAL Wix deployment must pass hosted smoke tests pinned to its release JS and source commit.
5. Wix readback must show expected index.html, CSS, JS, worker, release manifest and site URL, followed by preview refresh.
6. Physical iPhone Safari and VoiceOver, Home Screen install, backup recovery and real-client usability require actual device acceptance. Automated Chromium cannot certify those.
7. Real client accounts, assigned programs, private sync, messages and filmed exercise videos have NOT been implemented and must not be claimed live.

## Cost and privacy controls
- Guest data stays browser-local, no new paid provider and no real client records in public GitHub.
- Preserve original business Wix Bookings, Stores, Plans, and Stripe checkout.
- Preserve the same free app site ID d32a63dd-3244-4033-b1ac-7b1bfeab6651.
- PR #184 remains draft until reviewed. Never auto-merge or duplicate existing workflows.

## Reversible rollback
1. Preserve user browser history. Never clear storage or change the app origin.
2. Select the last VERIFIED full-build artifact (not merely the latest code). Record exact SHA and main entrypoint.
3. Upload that build ZIP to the SAME Wix site with replaceAll=true.
4. Read index.html and tv-sw.js back, check hashed bundles and release manifest.
5. Run the hosted browser QA version appropriate to the restored release.
6. Record the rollback/verification receipt in PR #184. GitHub artifacts expire; keep a private immutable copy.

## Future secure coaching MVP (NOT DEPLOYED)
- Evaluate reuse of supported Wix Members Headless login without assuming sign-on across separate sites.
- Version ProgramTemplate, ProgramVersion, CoachAssignment, WorkoutSession and PerformedSet with immutable IDs and server-side ownership.
- Enforce access control on every object; passing an unguessable ID is not authorization.
- Offline sync must use idempotency keys, revision conflicts, retry and a defined delete/export policy.
- Before real-client migration, pass synthetic Client A/Client B isolation, coach-assignment and offline sync tests.
- Maintain coach review for individualized programming; do not claim fake AI guidance, medical clearance or copyright to borrowed exercise artwork.
