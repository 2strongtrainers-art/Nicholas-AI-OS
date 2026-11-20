# TriValley FIT — Milestone 2 security gates

## OWNER LOGIN REPAIR — November 20, 2026, after failed iPhone sign-in

- The iPhone screenshot at 3:48 PM PT showed the staging page's generic sign-in rejection. An Edge 401 was seen in the relevant server log window, but those logs do not identify the specific user and the browser error did not distinguish Wix callback failure from API denial. Do not assert a verified root cause.
- An official Wix provider verification was independently tested using a visitor OAuth token: `POST https://www.wixapis.com/oauth2/token-info` returns live camelCase `active, subjectType, subjectId, clientId, siteId`; its real VISITOR response confirmed the exact main Wix site ID and staging OAuth client ID. This replaces the potentially permission-blocked Ricos site-context proof in the Edge service.
- `src/wix-token-info.mjs` now requires active Wix token, `MEMBER` subject, exact site and OAuth client, valid member UUID and nonexpired token; token-info responses are never trusted without verifying the actual `Get My Member` member ID and APPROVED status. Anonymous visitors, wrong-site, wrong-client and malformed tokens fail closed.
- Corrected Wix Get My Member REST parameter from `?fieldsets=EXTENDED` to official `?fieldSet=FULL` in both browser and server adapters and corresponding tests.
- Configured a private, narrowly scoped owner alias: only the previously verified site member `1strongtrainer@gmail.com` maps to canonical `2strongtrainers@gmail.com` coach record. No separate duplicate coach business identity is created. The private `owner_member_aliases` table enforces exact ID and canonical FK, with RLS and no browser grants.
- Supabase `trivalley-coaching-api` is ACTIVE **v4**, with the corrected auth provider module and alias lookup. Readback from published Wix Training Companion confirms guest root app still exists, both emails appear in private pilot text, diagnostic errors identify Wix vs API stage, and `fieldSet=FULL` is live.
- Latest GitHub M2 synthetic/security CI run `44840406221` passed, and independent external tests showed `/health` `databaseReady:true` and unauthenticated `/v1/me` HTTP 401. These checks do NOT establish successful Wix member sign-in.
- No browser-saved Wix credentials are available to the execution environment; the connected Wix administrator credential does not equal an interactive OAuth member token. **Next gate**: owner personally signs into `https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com/coach-login.html` as either Wix Member email; report the page's new nonsecret error stage/code if it fails. Never request or log passwords, access tokens or OAuth callback codes.
- Public/free workouts and paid checkout unchanged. No real clients migrated. Production remains gated by live user acceptance, account/role isolation tests, recoverable backup strategy, consent, private exports/deletion and physical iPhone acceptance.

---


## AUTHENTICATION REPAIR — November 20, 2026 (current checkpoint)

- Owner's iPhone screenshot showed Wix redirect back to the private coaching pilot followed by a generic error. Supabase function logs showed an actual `GET /v1/me` HTTP 401 at approximately 3:48 p.m. Pacific. This did **not** prove which verification sub-step failed.
- Corrected the fragile Ricos site-URL authorization dependency by verifying the actual Wix OAuth bearer through official `POST https://www.wixapis.com/oauth2/token-info`. A real disposable Wix anonymous token independently proved the provider returns `active`, `subjectType`, `subjectId`, `siteId`, `clientId`, `iat`, `exp` in camelCase; timestamps are decimal Unix-second strings. Protected access requires `MEMBER` (never `VISITOR`), exact main site ID, exact dedicated OAuth client ID, matching approved Wix member ID, unexpired token, and database-provisioned coach role.
- Both Wix Member accounts were rechecked and remain APPROVED and verified: `2strongtrainers@gmail.com` is the canonical coach identity; `1strongtrainer@gmail.com` is a narrowly provisioned, enabled owner alias in the separate private `coaching_private.owner_member_aliases` table. There is still only **one canonical coach row** and zero clients. Both logins resolve to the same coaching identity; no email merge, password transfer, or Wix administrator-role elevation occurred.
- `src/wix-token-info.mjs` now validates numeric-string issue/expiry timestamps (the live Wix format), not only numeric expiry. `src/wix-verify.mjs` uses official `fieldSet=FULL`. The private Edge function **v4** is ACTIVE; external `/health` confirmed `databaseReady:true`, and unauthenticated `/v1/me` remains HTTP 401. GitHub Actions coaching QA on commit `cdc02f8` passed after fixing stale simulated Wix fieldset and canonical-alias expectations.
- The published isolated `/coach-login.html` now explicitly offers either verified member email and differentiates Wix member verification failures from API denial, without disclosing tokens. Published HTML and JavaScript were independently read back; no existing guest PWA files were replaced.
- **Not a full release:** Neither real member identity has yet completed the corrected sign-in callback in an observed acceptance test. No client migration, live offline workout sync, backup/restore or physical iPhone acceptance. Do not merge PR #191 or enable real client data until the owner confirms successful live login and all remaining production gates pass.

---

## LIVE STAGING CHECKPOINT — November 20, 2026 (supersedes the historical no-project notes below)

**Status: STAGING API AND PILOT LOGIN PAGE DEPLOYED; PRODUCTION COACH-CLIENT WORKFLOW NOT VERIFIED.**

- **Primary ownership:** Supabase organization `2strongtrainers@gmail.com's Org`, Free plan. Main published Wix site is owned through connected administrator `1strongtrainer@gmail.com` while its published site contact is `2strongtrainers@gmail.com`. Both known emails have APPROVED/verified Wix Members accounts. Only the primary `2strongtrainers@gmail.com` member is provisioned in the private coaching database as an active coach; the other is not a duplicate/alias coach.
- **Cloud:** Supabase project `kszzvzysxwetwapbhzgy`, name `TriValley Coaching Secure Staging`, `us-west-1`, health `ACTIVE_HEALTHY`, project creation quote **$0/month**.
- **Private schema:** `supabase/private-staging-schema.sql` applied successfully. Four `coaching_private` tables (organizations, wix_memberships, snapshots, audit_events) have RLS enabled with no public policies and no USAGE/SELECT/INSERT grants for `anon`, `authenticated`, or `service_role`. Postgres provider credentials stay inside Supabase Edge runtime, not in the browser or GitHub. One empty org, one owner member, zero clients and zero client workouts. Security advisor's "RLS enabled no policy" informational findings are intentional deny-by-default for this private schema.
- **Live server:** `trivalley-coaching-api` Supabase Edge Function v2 ACTIVE. `https://kszzvzysxwetwapbhzgy.supabase.co/functions/v1/trivalley-coaching-api/health` returned `databaseReady:true` after a real private SQL query. Anonymous `/v1/me` request independently returned **HTTP 401**. The gateway `verify_jwt=false` is necessary for Wix OAuth tokens; **every protected path performs Wix member/site verification plus private DB role lookup**, so public access is denied. See `supabase/edge/index.mjs`. This is not a live user acceptance receipt.
- **Isolated member-login pilot:** New Headless OAuth client `d61ad4ca-bfe1-4792-b1d6-099567dd79d0` registered against main site's Members Area, with exact callback `https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com/coach-login.html`. Wix static Training Companion was patched with exactly three **added** files: `coach-login.html`, `coach-login-client.mjs`, `coach-login-wix.mjs`. **0 replaced, 0 deleted**; guest Training Companion and paid Wix/Stripe checkout not altered. Files independently fetched and browser clicked sign-in; legitimate Wix-hosted login page opened, with no login error. No real member completed the callback or accessed coaching data.
- **Owner action still needed:** Complete one interactive member login as `2strongtrainers@gmail.com` on the new pilot page, then verify that `/v1/me` succeeds with real Wix token and correct site binding. If Wix's site-context endpoint denies the member token, fail closed and resolve permissions/identity; do not bypass the site verification.
- **Production release is blocked:** No opted-in client has been provisioned/migrated, and the public workout app does not consume the private API. Exercise-catalog synchronization, client invitation/provisioning, actual two-identity offline workout replay, check-in review, export/deletion, hosted access isolation, backup/restore, incident response, privacy consent, and physical iPhone acceptance are still mandatory. **Supabase Free does not include guaranteed automatic database backups and can pause after inactivity**: do not store real client workout history until an approved recoverable backup/retention plan and completed acceptance receipts exist. Never claim this checkpoint is a full release.

---


**Not production-ready. No real member data, no live server, and no automatic access to main Wix accounts.**

This branch builds a synthetic, deterministic data-contract and authorization proof. The standalone Wix PKCE login adapter exists only as tested staging source; it has not been activated in the public app. A dedicated public OAuth client was provisioned on the owner's existing main business Wix site, but no secure coaching API or durable cloud database has been deployed. No real member login, invitations, messages, billing actions, or client records have been migrated.

## Verified foundation required to move into production
1. **Identity** — Select one Wix Headless member identity that actually applies to the training host, with official OAuth login, correct callback/redirect allowlist, server-side member-token verification, expiry, refresh and logout. The paid main site and free training site are distinct Wix sites. Do not assume users can reuse sessions automatically.
2. **Storage** — Use durable, backed-up, encrypted-at-rest storage with strong transactional uniqueness for client session IDs, assignment revisions, and check-in IDs. This repository's InMemoryCoachingStore is a test fixture only.
3. **Authorization** — Every route derives user, role and organization from validated server-side identity, then checks actual membership and relationships for each object. No user-controlled clientId or role values may grant privileges. Test cross-client and cross-coach denial at the real deployed API.
4. **Offline** — Store client events locally with stable idempotency keys. Replay must not duplicate workouts; conflicting event payloads return 409; stale or revoked assignments do not accept new logs. Before syncing, reconcile identity and ownership.
5. **Privacy** — Document consent, retention, export/deletion workflow, provider data-processing terms, encryption, audit logging, incident response, and data handling for exercise feedback. A web form must not claim individualized rehabilitation clearance or upload client medical histories without a separate approved process.
6. **Operations** — Add server API tests, 401/403/404 object-isolation probes, backup recovery, failure alerts, rate limiting and independent hosted acceptance receipt. Make the rollout reversible.
7. **Commercial** — Read verified Wix pricing plans and owner-approved memberships; do not use a client-supplied paid flag or make checkout changes in the training app.

## Current verified pilot checkpoint — November 17, 2026
- **Live Wix OAuth configuration:** Dedicated main-site OAuth client `82db080c-df7a-4995-9e72-d9fe9babd503` accepted an anonymous visitor-token grant and returned a valid Wix PKCE sign-in URL. CI [#44134635520](https://github.com/2strongtrainers-art/Nicholas-AI-OS/actions/runs/44134635520), result `WIX_OAUTH_ANONYMOUS_REDIRECT_PASS`. This does NOT log in a member, create member tokens, prove privileged role permissions or host a coaching API.
- **Exact Wix site URL proof:** Official GET `/ricos/v1/site-context/site-url` returned published `https://www.trivalley.fit` through connected site-owner tools. `src/wix-site-binding.mjs` implements fail-closed token-scoped site URL verification, independently combined with APPROVED member lookup in `src/wix-verify.mjs`. **Unverified with an actual member OAuth bearer token**; the site-context permission may be unavailable and must be confirmed on the staging server. Deny access on API failure.
- **Durable staging SQLite:** `src/sqlite-staging.mjs` uses transactional Node 22 SQLite with hash-checked snapshots. It refuses to instantiate outside `NODE_ENV=test`. Synthetic HTTP/writing through a real SQLite file, cross-client denial, exactly-once offline replay, coach review and reopen-after-close passed.
- **DB invariant hardening:** `db/002_security_invariants.sql` adds defensive role, relationship, immutability and review triggers. It is **not applied to production**. The normal `db/001_coaching_core.sql` schema is still design-only.
- **Latest local verification:** CI [#44133115229](https://github.com/2strongtrainers-art/Nicholas-AI-OS/actions/runs/44133115229): 59 Node app/security tests + 17 Python SQLite schema tests + synthetic Chrome preview; all passing. One-time Wix OAuth provider CI [#44134635520](https://github.com/2strongtrainers-art/Nicholas-AI-OS/actions/runs/44134635520) also passing.
- **Production remains OFF:** No member login callback was completed, no approved real test account has been provisioned, no protected cloud DB or server API is connected to Wix, and no real coaching data has been accepted.
- **Connection required:** A managed database/backend provider must be connected and authorized before any remote persistence. Supabase connectivity was verified on November 19, 2026; its account currently has zero projects. No protected database, API, or auth integration has been provisioned. TinyFish Cloudflare-named browser profile has no confirmed `cloudflare.com` signed-in site; do not use that profile to claim production admin access. Choose a securely supported provider with a verified test database and explicit retention/export/deletion policy. No paid resource or data migration without confirmation of terms and permissions.

## Verified staging evidence — November 17, 2026
- Main business Wix site owns the Members Area. The separate free static Headless training app is not itself a member portal.
- A dedicated OAuth client exists on the main Wix site, client ID `82db080c-df7a-4995-9e72-d9fe9babd503`, allowed callback `https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com/index.html`. Client IDs are public; NEVER commit its client secret or tokens.
- `src/wix-login-browser.mjs` implements documented PKCE verifier/challenge/state, Wix-managed login redirect, OAuth code exchange and approved-member lookup; browser login is NOT mounted in the free app.
- `src/wix-verify.mjs` intentionally refuses to start without provider-verified exact-site token binding and protected role membership lookup. The Wix Get My Member response alone does NOT prove a tenant/site relationship.
- `src/domain.mjs`, `src/offline-queue.mjs` and `src/http.mjs` implement deterministic synthetic domain/auth routing with explicit object-level denial. `db/001_coaching_core.sql` is a schema ONLY, not a deployed database.
- `prototype/` is a no-network, in-memory demonstration with invented clients. Its isolated mobile Chromium test covers assignment, simulated offline workout sync, check-in review, data export, and 320–430px layouts. GitHub Actions emits a reviewed preview ZIP and screenshots, but there is no public coaching endpoint.
- Hosting limitation: Wix's current static uploader flattened nested preview archives AND explicit relative file bundle paths into the site root. Both attempts were immediately rolled back to the verified 40-file guest PWA, with root index/script/worker readback. **Do not attempt another nested upload with this tool.** Use the standalone HTML preview artifact or a separately approved hosting workflow; never risk replacing the free workout app.

## Owner review required before production
1. Confirm approved data handling and consent for workout and check-in information, retention/erase policy, security ownership, and incident response.
2. Verify server-side Wix token-to-site binding for the existing main business site's OAuth client; authorize only explicitly provisioned coach/client records in durable storage.
3. Deploy a transactional, private database and protected API. Run real denial tests for foreign site, client, coach, revoked accounts, bad token, stale roles, replay conflicts, audit/backup restoration, and 401/403/404.
4. Connect actual client screens and member login **after** backend gates are passed, using test-only identities and not modifying existing Wix/Stripe checkout.
5. Only then migrate opted-in real clients; never collect medical records in the open synthetic demo.
6. Run physical iPhone Safari/VoiceOver tests and an independently observed coach→client→offline workout→sync→coach receipt.

## What this prototype actually does
- Versioned published program records and coach-to-client assignments.
- Strict roles and organization boundaries, synthetic user fixtures only.
- Assign and revoke programs; client views only their own current assignments.
- Offline-style workout event acceptance with immutable event IDs, replay deduplication and 409 conflict.
- Private client progress, check-ins, coach review and own-data export.
- Strict POST field allowlists, body limits, optional exact Origin allowlist, no-store responses.
- HTTP adapter never binds a port on import; tests deliberately inject synthetic bearer identities. A production authenticator must be separately verified before serving any client.

## Chief of Staff review points
- Validate tenancy: Should a coach be restricted to one organization? Are administrative co-coaches permitted?
- Confirm which Wix Members site owns identity and whether single sign-on is supported across current domains.
- Verify whether storing any injury, symptom or clinical note needs additional privacy agreements and care pathways.
- Ensure coach cannot edit history, create client accounts from a public form, or mark a check-in reviewed without provenance.
- Review hard constraints for retention, deletion/exports, assignment revocation, and audit log before the public launch.
- Recommend least-cost safe persistent infrastructure and monitoring with no paid services until owner approval.
- Check the source against OWASP API1, API2, API3, API4, API5 and API8 risks.

## Acceptance contract
A real milestone completion requires one verified end-to-end test:
**authorized coach publishes a program → assigned test client sees it → test client completes a workout offline → authorized API syncs once → coach sees exact logged values → unrelated client and coach are denied → check-in is reviewed → client can export and request deletion.**
For this repository branch, only synthetic in-memory execution is asserted. Real login, production persistence and genuine client workflows remain blocked until verified and approved. No pretense of completion.


## Verified continuation — November 19, 2026

- Owner authorized the Training Companion improvements, excluding demonstration videos featuring Nick. Guest-app guidance, progress, backup visibility and premium styling proceed separately from this backend branch.
- Re-ran the exact existing backend source at `3a0017ef951341b533b54853a1ae71142c0f8edb`: **59 Node app/security tests and 17 Python SQLite schema tests passed**. These include simulated Wix identity/site checks, cross-client and cross-coach denials, stable offline event replay, coach review and durable SQLite reopen. This is synthetic regression evidence, not live provider acceptance.
- The Supabase account is connected and its organization is on the Free plan, but **the project inventory is empty**. No provider project, paid resource, auth account, client migration or production API was created. Connection alone does not supply a protected database.
- Existing SQL migrations use SQLite-specific syntax and invariants. They must not be submitted unchanged as PostgreSQL/Supabase migrations. A provider-specific adapter, transactional persistence and equivalent authorization/role tests are still required.
- Next executable acceptance remains: provision an approved zero-cost staging backend, apply verified provider-specific migrations with all public access denied, complete actual Wix member-token site binding, provision synthetic coach/client roles, and run the documented hosted isolation/offline/review/export/deletion contract before mounting sign-in in the guest app.
- **Production accounts remain OFF.** No claim of secure client login, cloud sync or real iPhone acceptance is made from these local tests.
