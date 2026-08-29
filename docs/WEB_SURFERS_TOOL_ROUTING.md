# Web Surfers Tool Routing

## Purpose

This layer turns authenticated Web Surfers membership directories into private task-routing intelligence without treating directory membership as proof of Lucas Part numbering and without exposing the paid database through a catalog-dump API.

## Canonical sources

Lucas confidence stores remain separate:

- `data/tool-intelligence/canonical-tools.json` — Confirmed and routable provenance.
- `data/tool-intelligence/probable-review.json` — Probable, review only.
- `data/tool-intelligence/pending-evidence.json` — Pending evidence only; no speculative website identity.

Paid Web Surfers discovery data is private:

- `hermes/tool_registry/websurfers-index.json`
- historical compressed AI / Design / Education payload
- `hermes/tool_registry/websurfers/gaming-tools-01.json` through `gaming-tools-08.json`

## Current inventory

Authenticated source audit on 2026-08-29:

- AI Tools: 270 valid named resources
- Design & Creative: 364 valid named resources
- Education & Learning: 778 valid named resources
- Gaming: 388 valid named resources
- **Total: 1,800 routable resources across 1,501 normalized domains**
- 33 major categories and 163 named subcategories
- pricing: 1,204 free / 530 freemium / 63 paid / 3 unspecified

Two historical Design rows contain a URL but no website name and are intentionally filtered from the routable catalog.

## Routing model

`python scripts/nicholas_tool_router.py <request>` performs task/entity matching, category/capability ranking, cost/login constraints, Lucas provenance enrichment and execution gating.

A resource may be selected automatically without being executable automatically.

### Connector semantics

A related platform connector is not automatically an execution adapter for every URL hosted on that platform. For example, a GitHub repository for Mineflayer can be inspected by GitHub, but GitHub cannot thereby execute Mineflayer's bot capability. The router therefore marks GitHub-hosted projects as research/browser candidates unless the listed service itself has a verified execution adapter.

The current source data contains 64 records on connector-related domains, but only 21 records are conservatively marked as direct-connector candidates for the actual listed service. Runtime execution still requires that adapter to be live.

HeyGen is included in direct-connector mapping because a HeyGen connector is available in the current ChatGPT tool environment.

## Privacy boundary

Production integrations must:

- require existing bearer authentication;
- accept a task, not arbitrary bulk catalog queries;
- return only a small primary/fallback set;
- never expose the raw paid payload;
- preserve provenance internally;
- keep purchases, publishing, messaging, destructive writes and other consequential operations behind normal runtime/user policy.

## Validation

`.github/workflows/websurfers-tool-intelligence-ci.yml` validates the canonical Tool Intelligence suite, the 1,800-resource/1,501-domain catalog, source counts, URL/pricing invariants, Gaming provenance, MIT named-entity routing, Canva/HeyGen execution gating, GitHub-hosted-project non-execution, and no speculative Pending Lucas identities.

No CI assertion hard-codes a fixed final Lucas coverage total, so Parts 351–749 can continue to grow as evidence is independently recovered.
