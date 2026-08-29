# Web Surfers Tool Routing

## Purpose

This layer turns the authenticated Web Surfers membership directories into private task-routing intelligence without treating the directory as proof of Lucas Part numbering and without exposing the membership database as a public catalog API.

## Cross-chat reconciliation

This integration is based on current `main`, which already contains the merged Hermes Tool Intelligence + Node 24 work. It deliberately does **not** import the obsolete parallel branch's duplicate Lucas registry or stale 4/3/6 CI assumptions.

The canonical Lucas confidence stores remain:

- `data/tool-intelligence/canonical-tools.json` — Confirmed and routable provenance.
- `data/tool-intelligence/probable-review.json` — Probable, review only.
- `data/tool-intelligence/pending-evidence.json` — Pending evidence only; no speculative website identity.

The paid Web Surfers catalog is separate:

- `hermes/tool_registry/websurfers-index.json`
- `hermes/tool_registry/websurfers/websurfers-registry-v2.b64.01` … `.08`

Current paid-directory inventory: 1,414 resource records across 1,173 normalized domains.

## Routing model

`python scripts/nicholas_tool_router.py <request>` performs:

1. task/intention parsing;
2. named-entity and exact-name matching;
3. category/subcategory and capability matching;
4. pricing/login/browser constraints;
5. connector-candidate ranking;
6. independent Lucas provenance enrichment from the canonical `data/tool-intelligence` stores;
7. execution gating.

The response returns a primary tool plus limited fallbacks. It never upgrades a Probable/Pending Lucas association because the paid directory looks similar.

## Selection is not execution

A resource can be selected automatically without being executable automatically.

Execution requires a runtime adapter that is actually live in the current environment. A connector name in the registry is only a candidate until the runtime explicitly injects it as available.

Example:

```bash
python scripts/nicholas_tool_router.py create a social media design in Canva --runtime-adapters Canva
```

Without `--runtime-adapters Canva`, Canva may still rank first, but `can_execute_now` remains false.

Unknown API/MCP/CLI availability is never guessed.

## Privacy boundary

The Web Surfers payload is private routing data. Production integrations should expose only task-scoped ranked results, not a list/dump/search-all endpoint that reproduces the paid membership database.

A Switchboard integration must therefore:

- require the existing bearer authentication;
- accept a task, not arbitrary bulk catalog queries;
- return only a small primary/fallback set;
- omit raw compact payload data;
- preserve source provenance internally;
- keep purchases, publishing, messaging, destructive writes, and other consequential operations behind normal runtime/user policy.

## Validation

`.github/workflows/websurfers-tool-intelligence-ci.yml` validates:

- the existing merged Tool Intelligence tests;
- the 1,414-record paid catalog and 1,173-domain counts;
- URL, pricing, connector, and confidence invariants;
- MIT OpenCourseWare named-entity routing;
- Canva execution gating;
- no speculative Pending Lucas identities.

No CI assertion hard-codes the historical 4 Confirmed / 3 Probable / 6 Pending totals, so the canonical Lucas dataset can safely grow as Parts 351–749 are independently verified.
