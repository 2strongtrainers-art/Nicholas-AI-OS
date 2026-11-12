# TriValley.fit Wix release and reporting

The two published HTML files match the Classic site's coaching embed (revision 3) and the Dumbbell offer (revision 12) verified November 12, 2026. Both use the existing essential body-start placement. Wix owns page content, bookings, products and checkout.

Use the matching Wix custom-embed revision when applying a change. Retain the prior content for a rollback. Confirm the published page in a fresh visitor session. Keep paid files, analytics exports, customer records and credentials in the authorized systems.

## Verify the public journey

From `tests/trivalley-site`, run `npm ci`, `npx playwright install --with-deps --only-shell chromium webkit`, then `npm test`. The suite covers the homepage fit and scoped WCAG rules, the assessment calendar, the coaching enrollment link, the guide collection and the three sample images. The cart test stops at the checkout control. Use `TRIVALLEY_READ_ONLY=1` for repeated live checks that leave carts empty. WebKit uses an iPhone 14 profile. A physical iPhone Safari check remains separate.

## Measure the funnel

Use the last seven complete Pacific days. Wix Analytics reports page views, homepage-to-destination transitions and guide-level checkout sessions. Use confirmed Wix Bookings records for the assessment, positive paid Wix orders for the three digital products, and completed paid Stripe Checkout sessions filtered to the verified live $497/month payment link for new online coaching signups. Stripe renewals and test orders are outside that signup count. A checkout session measures shopping intent. Report verified payment and attributable contribution using the existing revenue scorecard.

The optional `website` input to `chief_of_staff.revenue` takes `period_start`, `period_end`, `qa_traffic_possible` and `observations`. Observation keys and expected sources are defined in `chief_of_staff/website_funnel.py`. Each measured value supplies `source`, integer `count` and a `reference` to the dated source. Omit unknown or incomplete measures. Use an explicit count of zero when the source proves zero. Keep QA windows labeled and avoid interpreting session-level ratios as customer conversion when QA traffic can be included.

`funnel-events.html` is prepared for an analytics-category custom embed after a TriValley measurement destination is verified. It emits allowlisted click intents to the browser data layer. It contains no destination configuration and makes no network calls. Activate collection with the site's analytics consent controls and verify the actual events in the named destination before reporting them. In November 2026 the connected PostHog workspace showed a default project with no TriValley domain binding, so Wix is the verified source for the native traffic and checkout baseline.

## Ongoing improvement

Check production after releases and on the scheduled run. In the owner review, prioritize confirmed broken journeys, then a single evidence-supported change with a dated baseline. Compare equivalent windows, preserve the evidence and rollback, and use the next review to decide whether the change helped. Capture analytics coverage and release failures in the private operations review.
