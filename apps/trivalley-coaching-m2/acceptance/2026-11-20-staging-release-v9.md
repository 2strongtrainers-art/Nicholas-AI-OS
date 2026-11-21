# TriValley Coaching M2 — isolated staging acceptance v9 (November 20, 2026 PT)

## Release decision
**Staging ACCEPTED for owner review. Production/client enrollment NOT YET approved.** Keep PR #191 in draft. Do not migrate real clients or enable enrollment/cloud sync without an actual tested recoverable off-provider backup, owner-reviewed consent notice and live two-member acceptance.

## Verified deployed assets
- Supabase project `kszzvzysxwetwapbhzgy`, `us-west-1`, Free, `ACTIVE_HEALTHY`. Backend Edge `trivalley-coaching-api` **v9 ACTIVE** using the real Wix member OAuth issuer/site/client binding.
- Main Wix Members site ID `9e6343d9-5a1c-45e2-8596-f73408e38402`. Canonical owner is the APPROVED Wix member under `2strongtrainers@gmail.com`. Separately approved `1strongtrainer@gmail.com` remains a strictly scoped alias of the same canonical owner.
- Owner portal: `https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com/coach-login.html`.
- Client pilot portal: `https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com/coach-client.html`.
- The original Wix guest PWA was preserved; Headless root `index.html` still loads `./assets/index-PG_8lqer.js`. Paid checkout untouched.

## Verified actual login
- Owner screenshot Nov 20, ~4:09 p.m. PT says `Coach account verified`, `Private Data access`, `0 Assigned active clients`.
- Independent Supabase function Edge logs observed authorized `GET /v1/me` HTTP 200 at `2026-11-21T00:09:28.780Z` and `GET /v1/coach/clients` HTTP 200 at `2026-11-21T00:09:29.489Z`.
- Screenshot/HTTP logs do not conclusively reveal whether the primary email or alias was used; do not claim two distinct real logins have passed.

## Verified program persistence
- Three private owner-published 3-Day Muscle Split programs, sourced from the pinned guest app's `apps/trivalley-opengym/tv-programs.mjs`, contain **16** exact approved exercise IDs: Back & Biceps (5), Chest & Triceps (6), Legs (5).
- SQL snapshot revision **2** with `programs=3`, `programVersions=3`, `assignments=0`, `clients=0`.
- Privileged program assignment routes require an enrolled client and exact consent notice version; no client is pre-assigned.

## Security and recovery
- Nine `coaching_private` tables use RLS with **no public policies**, and `anon`, `authenticated`, and `service_role` have no schema/table access. Supabase security advisor `rls_enabled_no_policy` INFO is intentional deny-by-default, not a request to open access.
- SQL release controls are `enrollment_enabled=false`, `workout_sync_enabled=false`, `privacy_notice_version=TVFIT-PILOT-2026-11-V1`; `privacy_approved_at=NULL`, `backup_verified_at=NULL` and no backup receipt.
- Endpoint `GET /health` returned `databaseReady:true`; public `GET /pilot-status` returned `enrollmentEnabled:false, syncEnabled:false`. Anonymous `GET /v1/coach/backup` and `/v1/coach/enrolled-clients` externally returned HTTP 401.
- Transactional in-database snapshot history exists (currently 2 revisions), but **this is NOT an independent off-provider backup**.
- Owner has an AES-256-GCM browser-side encrypted backup download and read-only decryption check. Recording backup attestation requires *actual saved and decrypted file* and owner confirmation; cannot assert that from a successful page render.
- Client portal uses Wix member OAuth, a member-partitioned IndexedDB queue for workout submissions, check-ins, personal export and deletion request. Client code is published but not real-user end-to-end verified. Enrollment and workout writes are server-blocked until owner approval.
- Owner-reviewed deletion route is staged with synthetic tests; upon approved request it removes client data from private snapshots/history, membership, consent and related audit records. Previously downloaded backups still require separate handling.
- Supabase performance advisor unindexed-FK findings were resolved by `007_coaching_fk_indexes.sql`; remaining unused-index INFO is expected for an unused staging app.
- GitHub Actions `44844617848` passed synthetic Node app/security tests, SQLite schema tests, JS parse checks, and synthetic mobile-browser preview. This does not substitute for real-client authorization and restore testing.

## External browser acceptance
TinyFish session `566ed7fb-c1a1-4627-a9c9-21d8d7ffc2f3` verified live mobile client pilot page loads, no private client information is shown, enrollment closed warning appears, and a single sign-in click reaches legitimate Wix member login without entering credentials.

## Manual acceptance and legal gates remaining
1. Owner sign in, create encrypted backup, save in a separate trusted location, re-open/decrypt and record backup attestation. Verify that a backup can actually be restored by an approved recovery operator before relying on it for paid-client data.
2. Owner review stable pilot privacy notice, confirm policies for consent/retention/deletion/security, then deliberately activate the **limited opt-in client pilot** (not mass production).
3. Invite an approved **test** Wix member, verify consent-specific enrollment, assign an owner-published program and verify distinct coach/client identity from two separate devices.
4. With a test account: offline-save sets, reconnect and sync exactly once; repeat same session ID with identical and changed payload and verify dedupe/409; coach retrieves exact submitted data.
5. Check-in review, personal export, deletion request and historical snapshot erasure, error/rate-limit handling, real restore and physical iPhone Safari/VoiceOver.
6. Evaluate Free-plan inactivity pause and no guaranteed automatic backup; approve operational owner, alerting, emergency incident response, recurring backups, and if necessary upgrade before broad production.

**Do not confuse public accessibility of a signed-out login page with a released, accepting coaching service.**