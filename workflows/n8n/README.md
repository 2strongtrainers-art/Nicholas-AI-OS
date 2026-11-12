# Restore the Wix coaching intake queue

The inactive n8n export and Wix Velo relay template come from the tested TriValley.fit flow. Import into a staging project or recovery host. The running Wix and n8n setup owns production.

1. Create a private n8n data table using `coaching-draft-review-schema.csv`. Use text fields and start with no rows. Bind the table to **Save decision for review**. The upsert matches `inquiry_id`.
2. Import `trivalley-coaching-intake.json`. Bind an n8n Header Auth credential with the header name `x-trivalley-intake-key`. Use the matching 64-character hexadecimal value in Wix Secrets Manager under `TRIVALLEY_N8N_COACHING_INTAKE`. Use a distinct staging path and credential while testing on an existing host.
3. Resolve the actual Wix form ID, checkbox field ID, UTC cutover, and n8n HTTPS production webhook from the intended environment. Substitute those four placeholders privately in `wix-backend-events.js`. Reconcile the two submission handlers with the site's existing Velo backend before publishing them.
4. Test confirmed submissions with explicit consent and with the box unchecked. Verify the second case queues a hold with no draft. Replay the first inquiry ID and verify one row. Test the wrong credential and extra payload fields. A Wix submission UUID, the fixed service, and consent are the only relayed fields.
5. Use the new host only after verifying its queue and authenticated production endpoint. For rollback, repoint the private Wix relay to the last tested URL and matching credential. Keep lead data and execution history in the authorized systems.

The queue prepares a draft for human review. Check consent in Wix before any reply. To test validation and relay behavior without running n8n or touching a live endpoint, run `node --experimental-vm-modules --test tests/test_trivalley_intake.mjs` from the repository root.
