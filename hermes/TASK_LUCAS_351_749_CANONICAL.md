# LucasWebQ Parts 351–749 — canonical completion task

## Source of truth

Work only against the canonical Tool Intelligence files already validated on `main` and mirrored on this branch:

- `data/tool-intelligence/lucas-coverage-351-749.json`
- `data/tool-intelligence/source-recovery/*.json`
- `data/tool-intelligence/canonical-tools.json`
- `data/tool-intelligence/probable-review.json`
- `data/tool-intelligence/pending-evidence.json`

Do not recreate a competing Lucas registry under `hermes/tool_registry/`.

## Current baseline

The reconciled baseline accounts for all 399 Parts (351–749) exactly once. At reconciliation time, 63 Parts have exact Lucas source recovery and 336 remain `source_not_recovered`. Confirmed/Probable website identities must retain their stronger evidence and must never be downgraded by weaker research.

## Research rules

1. Recover exact Lucas-owned source evidence first: original TikTok URL/video ID, official Lucas Instagram mirror, or another Lucas-owned/canonical mirror that explicitly binds the Part number to the post.
2. Do not infer a Lucas Part from a similar third-party creator post, generic description, Web Surfers directory membership, or website feature similarity.
3. Website identity is separate from source recovery. Leave identity blank when the source is recovered but the domain is not proven.
4. Confirmed requires exact source binding plus strong website identity evidence. Probable remains review-only and must have a documented reason exact post-to-domain binding is incomplete.
5. Never invent video IDs, captions, domains, product names, API/MCP/CLI availability, or access claims.
6. Public-web research only. Do not bypass logins, CAPTCHAs, private profiles, paywalls, or other access controls. Do not spend money.
7. Preserve router safety: Pending/source-only evidence must not become executable simply because a tool appears in a private catalog.

## Write discipline

- Add recovered source records to the appropriate `data/tool-intelligence/source-recovery/` JSON file or a new clearly named range file.
- Update `lucas-coverage-351-749.json` atomically so every Part remains in exactly one coverage bucket and counts remain exact.
- Update canonical/probable/pending identity files only when evidence warrants the confidence transition.
- Keep compatibility exports (JSONL/CSV/registry), when present, derived from the canonical files rather than independently edited.

## Required validation

Before committing research output:

```bash
python3 scripts/validate_tool_intelligence.py
python3 -m unittest tests/test_lucas_coverage.py tests/test_lucas_probable_updates.py
python3 -m unittest tests/test_tool_intelligence.py
```

Completion means 399/399 Parts are still accounted for; `source_not_recovered` is zero; every recovered source is exact and auditable; every resolvable website identity has been researched as far as trustworthy public evidence allows; unresolved identities remain blank; router safety remains intact; and all validations pass twice on the final tree.
