# TriValley Secure Digital Delivery

A separate Cloudflare Worker that protects the Four Week Dumbbell Strength Starter v2.1 download without changing Hermes or the AI Switchboard.

## Security boundary

The browser never receives a Stripe secret or the underlying source file URL.

A download is streamed from a **private Cloudflare R2 bucket** only when Stripe reports that the supplied Checkout Session:

- is paid;
- belongs to Payment Link `plink_1UYDGYKm01p7HORcJGt3qR1z`;
- totals exactly USD 39.00;
- was created in live mode.

Every mismatch fails closed with HTTP 403. Download responses are not cached.

## Required owner-only configuration

The deployment script intentionally refuses to run until these files exist on the already-authorized self-hosted Mac:

- `~/.config/trivalley-digital-delivery/stripe-restricted.key`
- `~/.config/trivalley-digital-delivery/buyer-package-source.url`

The Stripe key must be a live **restricted key** with only the read permission required to retrieve Checkout Sessions. Never use a full live secret key for this worker.

The package source URL is used **once at deploy time** to seed the private R2 object. It is not stored in Worker configuration, source code, or browser output.

The Stripe restricted key is pushed to Cloudflare using `wrangler secret put`; its value is never committed or printed.

## Deployment

`scripts/deploy_trivalley_digital_delivery.sh`:

1. runs deterministic tests;
2. provisions the Stripe restricted key as a Worker secret;
3. creates the private R2 bucket when needed;
4. downloads the approved buyer ZIP to a temporary owner-only file and uploads it to R2;
5. deploys the separate worker;
6. verifies `/health`.

After production verification, point the TriValley.fit post-purchase button at:

`<worker-url>/download?session_id=<CHECKOUT_SESSION_ID>`

Then remove the old public Wix Media Manager ZIP so only the private R2 copy remains.

Keep the Stripe Payment Link success redirect on TriValley.fit so the branded onboarding page remains the customer-facing surface.
