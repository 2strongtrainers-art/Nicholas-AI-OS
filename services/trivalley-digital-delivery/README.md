# TriValley Secure Digital Delivery

A separate Cloudflare Worker that protects the Four Week Dumbbell Strength Starter v2.1 download without changing Hermes or the AI Switchboard.

## Security boundary

The browser never receives a Stripe secret or the underlying Wix Media Manager URL from source code.

A download is streamed only when Stripe reports that the supplied Checkout Session:

- is paid;
- belongs to Payment Link `plink_1UYDGYKm01p7HORcJGt3qR1z`;
- totals exactly USD 39.00;
- was created in live mode.

Every mismatch fails closed with HTTP 403. The response is not cached.

## Required owner-only configuration

The deployment script intentionally refuses to run until these files exist on the already-authorized self-hosted Mac:

- `~/.config/trivalley-digital-delivery/stripe-restricted.key`
- `~/.config/trivalley-digital-delivery/buyer-file.url`

The Stripe key must be a live **restricted key** with only the read permission required to retrieve Checkout Sessions. Never use a full live secret key for this worker.

The buyer file URL is kept out of source so buyers cannot recover it from GitHub or page source.

Both files are pushed to Cloudflare with `wrangler secret put`; their values are never committed or printed.

## Deployment

`scripts/deploy_trivalley_digital_delivery.sh` runs deterministic tests first, provisions both Cloudflare secrets, deploys the separate worker, and verifies `/health`.

After the worker is verified, point the TriValley.fit post-purchase button at:

`<worker-url>/download?session_id={CHECKOUT_SESSION_ID}`

Keep the Stripe Payment Link success redirect on TriValley.fit so the branded onboarding page remains the customer-facing surface.
