# TriValley.fit Instagram commerce pilot

This is a tested **offline preparation and decision-support package**, not a
running Instagram business or live publishing/store adapter. No demand, revenue,
profit, account connection or unattended operation is claimed.

## Actual starting point — October 22, 2026

- GitHub read access and branch creation verified for Nicholas-AI-OS.
- GitHub metadata identifies this repository as **public**, despite the old root
  README calling it private. Never commit customer records, payment exports,
  access tokens, private product files or sensitive business results here.
- Wix's connected-app listing returned `UNAUTHORIZED` / reauthentication required.
  A website being public does not supply authenticated store access.
- No authenticated Instagram account, publishing permission, payment setup,
  checkout flow or digital-delivery flow was verified in this session.
- Existing video tools can be reused later. The recorded Mac worker heartbeat
  was September 29, 2026; that is stale, not proof of current worker health.
- Open PR #129 already contains a separate content-service pilot. This package
  does not modify or merge that work.

## Offer hypothesis

First candidate: **The Four-Week Training Consistency Planner**, proposed at
**$19**. This is a pricing hypothesis, not market research or demonstrated demand.
The six-page PDF draft was prepared separately and intentionally is not committed
to this public repository. It is a scheduling/reflection tool, not a personalized
exercise prescription. Paid-product delivery must use private storage.

`content.json` contains seven original educational captions and graphic copy.
`assets/` contains matching 1080 x 1350 PNGs plus editable SVG sources. These are
public promotional drafts and do not advertise an unverified purchase link.
`build_assets.py` regenerates the SVGs. PNG exports were produced with CairoSVG
2.8.2 and visually reviewed. SVG is source material; use PNG for publishing.

## Run without credentials or paid tools

Python 3.12, standard library only for controls and tests:

```sh
python3 -m unittest discover -s commerce/instagram/tests -v
python3 commerce/instagram/control.py report
python3 commerce/instagram/control.py queue --output /tmp/instagram-draft-queue.json
```

The queue binds each draft's copy, SVG and exported PNG to one SHA-256 review
digest. A digest detects edits; **it is not an approval token**. No command in
this package publishes, sends messages, calls models, charges customers, changes
ad budgets, pauses an ad or writes to a store. `live_execution_enabled=true` is
rejected, including when environment variables permit outbound activity.

GitHub CI runs tests and saves a non-sensitive readiness report/queue artifact on
matching PRs, main pushes and manual runs. It has read-only repository permission,
no secrets, no recurring schedule and no dependency on the Mac worker. A green CI
check means software validation passed; the report can still say `BLOCKED`.

## Readiness and sales evidence

Launch review requires an approved product, a real HTTPS TriValley.fit product
URL, and current operator attestations for Instagram connection, product review,
checkout test and delivery test. Attestations contain `passed`, timezone-aware
`checked_at`, and a nonempty `reference` to the actual verification record.
These are operator-supplied evidence, not live connection probes. Never fabricate
them just to clear a blocker.

Technical readiness and commercial evidence are distinct. A new product may be
ready for a small organic pilot before it has sales. Missing sales evidence keeps
`growth_status=HOLD`; it must not create a circular requirement to sell before
launching. Execution remains disabled regardless of report status.

Keep `metrics.local.json` and `evidence.local.json` outside the public checkout.
Copy the empty templates below and fill from actual records. Never put raw
exports, customer details or sensitive business totals into public CI artifacts.

```sh
python3 commerce/instagram/control.py report \
  --metrics /private/path/metrics.local.json \
  --evidence /private/path/evidence.local.json \
  --output /private/path/commerce-report.local.json
```

Required metrics: USD, `costs_complete=true`, timezone-aware `period_start`,
`period_end`, `as_of`, `settled_sales`, `gross_revenue_cents`, plus every cost field
in `metrics.template.json`. Amounts are nonnegative integer cents. Missing costs
never default to zero. Enter zero only after verifying no cost for that category.
Allocate shared software and labor to the reported period consistently. Data
older than 48 hours, future dates, incomplete costs and inconsistent sales totals
are rejected. Reports describe a period of at most 31 days, not lifetime returns.

Economics = gross revenue minus refunds, processing fees, advertising, allocated
software, fulfillment, labor and other costs. Taxes, chargeback reserves and other
business-specific costs belong in `other_costs_cents` when applicable; the report
cannot discover omitted liabilities. Cash profit and accounting/tax treatment
may differ. Data quality is still an operator responsibility.

- Loss: recommend stopping new spend and reviewing the loss.
- Fewer than 10 settled sales: insufficient evidence for continuation/scaling review.
- Net margin below 30%: hold and review pricing/costs.
- Otherwise: operator review for continuation, never automatic scaling.

The 10-sale and 30% thresholds are conservative pilot settings, not statistical
proof or a promise of future profitability. Store setup, paid AI, advertising and
autopublishing budgets start at zero.

## Finish the real integration

1. Reconnect Wix; inspect the actual site, installed Stores catalog version,
   payment readiness, existing products and connected social channels.
2. Confirm the Instagram professional account identity and the capabilities of
   its supported publishing connection. Connecting Wix does not establish that
   Instagram is connected. Preserve Muse/provider approval requirements.
3. Review the private product PDF, offer and price; create a draft product with
   private digital delivery. Use an external website product link for this pilot;
   no Instagram Shop eligibility is assumed.
4. Exercise checkout and file delivery in a supported test mode without charging
   a real customer; verify receipts, correct file access and failure behavior.
5. Review the seven PNG/caption drafts, then publish/schedule the approved items
   through the actual connected publisher. Verify returned post IDs and scheduled
   status. Use idempotency records for retries; do not infer success from a timeout.
6. Add private aggregate sales/cost ingestion and validate it against source
   orders. Only then configure ongoing monitoring and exception notifications.
7. Start organic. Review daily initially, then reduce check-ins once actual
   operations are reliable. Paid acquisition requires a defined budget and real
   contribution-margin evidence.

No recurring operational monitor is active yet. This package cannot guarantee
profit, audience growth, reliable provider availability or automatically repair
expired credentials. Required authentication must be completed by the account owner.

## Documentation checked

- Muse business capabilities and publishing approvals: https://muse.ai/business
- Muse connector permission classification: https://platform.muse.ai/docs
- Wix digital-product delivery: https://support.wix.com/en/article/wix-stores-delivering-digital-products
- Instagram subscriptions eligibility: https://www.facebook.com/help/instagram/478012211024479

Use current vendor documentation and the site's actual catalog version when
implementing adapters. A repo directory or installed SDK does not grant API access.
