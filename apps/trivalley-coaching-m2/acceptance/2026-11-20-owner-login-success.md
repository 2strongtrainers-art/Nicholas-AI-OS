# TriValley Coaching M2 — owner login acceptance

**Date:** November 20, 2026 (Pacific)
**Status:** LIVE OWNER LOGIN VERIFIED — NOT FULL PRODUCTION RELEASE

## Evidence received
- Owner shared an iPhone Safari screenshot around **4:09 PM PT** of the published isolated Wix pilot `/coach-login.html`. It displayed: **"Wix member and protected coaching API verified. No client records have been migrated."**, **"Coach account verified"**, canonical coach display name **"TriValley Coaching Owner"**, **"0 Assigned active clients"**, and **"Private Data access"**.
- Independent Supabase Edge logs on the same date:
  - **2026-11-21 00:09:28.780 UTC** (Nov 20 4:09:28 PM PT): `GET /functions/v1/trivalley-coaching-api/v1/me` -> **200**
  - **2026-11-21 00:09:29.489 UTC** (Nov 20 4:09:29 PM PT): `GET /functions/v1/trivalley-coaching-api/v1/coach/clients` -> **200**
- Database inventory independently queried: **1 canonical provisioned coach**, **1 enabled owner alias**, **0 client member rows**, coaching snapshot **revision 0** (no completed coaching writes yet).
- The Wix browser login callback, member token verification, site/client audience validation and private database role lookup were traversed for at least one approved owner member to display the signed-in coach workspace. This is **stronger than** the earlier unauthenticated health and 401-only tests.

## What is NOT established
- The screenshot and request logs do **not** identify which specific email (1strongtrainer vs 2strongtrainers) was used; each identity must be tested separately before claiming both.
- No real client sign-in, coach-to-client assignment, client offline queue sync, secure log replay, check-in review, export/deletion, account revocation, database backup restoration, consent/data retention, rate limiting, support incident response, or physical iPhone exercise logging has been demonstrated end-to-end.
- No production user/client data has been migrated or permission granted by a screenshot alone. Do not merge the draft PR on this receipt alone.
- The separate free guest Training Companion and production Wix/Stripe checkout were not modified during this login test.

## Next release gate
1. Approve recovery / backup retention for client training records before adding real client data to Supabase Free.
2. Provision **opted-in pilot test clients** in main Wix Members Area with explicit coaching roles and server-side ID relationships; never infer entitlement from Wix login or email.
3. Deploy client-facing assignment and sync pages separately from guest workout mode; verify exactly-once real offline replay and denial of unrelated coach/client access.
4. Verify check-in review, export, deletion-request handling and restoration, with provider logs and iPhone Safari/VoiceOver acceptance.
5. Promote only after all security gates and owner-approved migration plan are recorded.
