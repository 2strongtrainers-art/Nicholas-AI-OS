# TriValley FIT — Milestone 2 security gates

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
- **Connection required:** A managed database/backend provider must be connected and authorized before any remote persistence. Supabase remains an optional suggested plugin, not installed. TinyFish Cloudflare-named browser profile has no confirmed `cloudflare.com` signed-in site; do not use that profile to claim production admin access. Choose a securely supported provider with a verified test database and explicit retention/export/deletion policy. No paid resource or data migration without confirmation of terms and permissions.

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
