# TriValley FIT — Milestone 2 security gates

**Not production-ready. No real member data, no live server, and no automatic access to main Wix accounts.**

This branch builds a synthetic, deterministic data-contract and authorization proof. No cloud database, login flow, production API deployment, invitations, messages, billing actions, or client records were created.

## Verified foundation required to move into production
1. **Identity** — Select one Wix Headless member identity that actually applies to the training host, with official OAuth login, correct callback/redirect allowlist, server-side member-token verification, expiry, refresh and logout. The paid main site and free training site are distinct Wix sites. Do not assume users can reuse sessions automatically.
2. **Storage** — Use durable, backed-up, encrypted-at-rest storage with strong transactional uniqueness for client session IDs, assignment revisions, and check-in IDs. This repository's InMemoryCoachingStore is a test fixture only.
3. **Authorization** — Every route derives user, role and organization from validated server-side identity, then checks actual membership and relationships for each object. No user-controlled clientId or role values may grant privileges. Test cross-client and cross-coach denial at the real deployed API.
4. **Offline** — Store client events locally with stable idempotency keys. Replay must not duplicate workouts; conflicting event payloads return 409; stale or revoked assignments do not accept new logs. Before syncing, reconcile identity and ownership.
5. **Privacy** — Document consent, retention, export/deletion workflow, provider data-processing terms, encryption, audit logging, incident response, and data handling for exercise feedback. A web form must not claim individualized rehabilitation clearance or upload client medical histories without a separate approved process.
6. **Operations** — Add server API tests, 401/403/404 object-isolation probes, backup recovery, failure alerts, rate limiting and independent hosted acceptance receipt. Make the rollout reversible.
7. **Commercial** — Read verified Wix pricing plans and owner-approved memberships; do not use a client-supplied paid flag or make checkout changes in the training app.

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
