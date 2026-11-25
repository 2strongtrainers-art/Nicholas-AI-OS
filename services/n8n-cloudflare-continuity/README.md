# n8n continuity: isolated Cloudflare Intel review adapter

**Candidate only. Production deployment not verified.** This component replaces only the three-node manual Global Intel review path. The existing GitHub Pages source and refresh job remain authoritative and unchanged. The other 13 backup workflow definitions are not migrated by this change.

The source normalizer is adapted from the existing versioned n8n template. Its source timestamp, 8-hour freshness window, distinct-source-family checks, receipt key and Chief snapshot contract are preserved. The n8n execution ID is always null because no n8n execution occurred. Chief delivery stays unacknowledged until separately observed.

## Verify
From this directory run npm test (Node 22; no dependencies needed for tests). Parity tests compare the original n8n script against equivalent inputs. No private records, live clients or paid provider calls.

## Deploy gate
1. Confirm the owner's existing Workers plan and budget; this service uses requests and CPU, not Containers, D1, R2 or paid AI.
2. Use an isolated Worker named trivalley-intel-review. No schedules or production route changes are included. Workers.dev has a minimal health route; the review route fails closed until the operator configures authentication.
3. In Workers & Pages use the GitHub integration with the reviewed branch, project root services/n8n-cloudflare-continuity, and deployment command npx --yes wrangler@4.141.0 deploy. Alternatively use an authenticated Wrangler CLI in this directory.
4. Set INTEL_REVIEW_TOKEN as a strong randomly generated Cloudflare secret, not a repository variable. Keep preview URLs disabled.
5. Verify GET /health, GET /review without authentication (401 when configured, 503 before), then one authenticated GET /review. Check exact source key, timestamp, status, and zero paid-provider actions. The upstream can legitimately be degraded or stale.
6. Use the existing authorized Chief handoff only after independently reviewing the receipt. No new schedule, outbound message, lead intake, trade, public post or Chief acknowledgment is created here.

## Rollback
Disable/remove only this newly created Worker route if deployed. Existing n8n, Wix, GitHub Pages and other Cloudflare services are not modified. No automatic cutover or credentials restored.

## Remaining scope
Preserve the complete owner-private n8n workflow backup and export private table data separately; credentials must be reattached securely. Audit existing coaching intake, Reel tracking and episode preparation before choosing replacements. Wix remains the source for coaching submissions. Do not send contact details or the full backup to this public repository.
