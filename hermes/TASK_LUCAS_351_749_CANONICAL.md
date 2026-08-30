# LucasWebQ Parts 351–749 — canonical completion task

## Source of truth

Work only against the canonical Tool Intelligence files already validated on this branch:

- `data/tool-intelligence/lucas-coverage-351-749.json`
- `data/tool-intelligence/source-recovery/*.json`
- `data/tool-intelligence/canonical-tools.json`
- `data/tool-intelligence/probable-review.json`
- `data/tool-intelligence/pending-evidence.json`

Do not recreate a competing Lucas registry under `hermes/tool_registry/`.

## Current baseline

Read the current files at runtime; do not trust stale counts embedded in this task. Preserve every stronger Confirmed/Probable/exact-source record already present. Never downgrade stronger evidence because a later search is weaker or unavailable.

## Objective

Finish the audit of LucasWebQ `Powerful Websites You Should Know` Parts 351–749. Completion requires all 399 Parts accounted for exactly once, `source_not_recovered` reduced to zero only through exact Lucas-owned/canonical source evidence, every resolvable website identity researched as far as trustworthy public evidence allows, unresolved identities left blank, compatibility exports synchronized, router safety intact, and final validation passing twice.

## Research rules

1. Recover exact Lucas-owned source evidence first: original TikTok URL/video ID, official Lucas Instagram mirror, official Lucas YouTube mirror, or another Lucas-owned/canonical mirror that explicitly binds the Part number to the post.
2. Search public mirrors/indexes in bulk where possible. Prefer creator-feed/index/archive pages that expose many exact Part→post bindings at once over one-off searches.
3. Do not infer a Lucas Part from a similar third-party creator post, generic description, Web Surfers directory membership, sequential video-ID guessing, or website feature similarity.
4. Website identity is separate from source recovery. Leave identity blank when the source is recovered but the domain is not proven.
5. Confirmed requires exact source binding plus strong website identity evidence. Probable remains review-only and must have a documented reason exact post-to-domain binding is incomplete.
6. Never invent video IDs, captions, domains, product names, API/MCP/CLI availability, or access claims.
7. Public-web research only. Do not bypass logins, CAPTCHAs, private profiles, paywalls, or other access controls. Do not spend money.
8. Preserve router safety: Pending/source-only evidence must not become executable simply because a tool appears in a private catalog.

## Incremental checkpoint discipline — REQUIRED

The previous monolithic research run exceeded the workflow window without producing a durable commit. Do not repeat that failure mode.

- Work from the current `source_not_recovered_parts` list in deterministic ascending batches, normally 20–30 Parts at a time.
- After every batch that yields any trustworthy new source/identity evidence, update all affected canonical files atomically, regenerate/synchronize compatibility JSONL/CSV/registry outputs when present, and run the required validations below.
- If validation passes, commit and push that validated batch immediately to `hermes/tool-intelligence-parallel` before continuing. Use a descriptive message such as `Hermes: recover Lucas sources 351-375`.
- Never wait until the end of the entire 399-Part research job to make the first commit.
- Before beginning a new batch, `git pull --rebase origin hermes/tool-intelligence-parallel` so externally added validated evidence is preserved.
- If a public source becomes blocked or unproductive, record the research note under `hermes/research/` and switch to another lawful public source rather than stalling indefinitely.
- Prefer exact source recovery even when website identity remains unresolved; that still counts as genuine progress.
- Stop initiating new research with roughly 20 minutes remaining in the workflow budget. Use the remaining time to synchronize files, validate, commit/push any valid progress, and leave a concise checkpoint under `hermes/research/` stating the next unresolved batch.

## Write discipline

- Add recovered source records to the appropriate `data/tool-intelligence/source-recovery/` JSON file or a new clearly named range file.
- Update `lucas-coverage-351-749.json` atomically so every Part remains in exactly one coverage bucket and counts remain exact.
- Update canonical/probable/pending identity files only when evidence warrants the confidence transition.
- Keep compatibility exports (JSONL/CSV/registry), when present, derived from the canonical files rather than independently edited.
- Preserve citations/source URLs and enough evidence text for every exact binding to be independently audited later.

## Required validation after every checkpoint

```bash
python3 scripts/validate_tool_intelligence.py
python3 -m unittest tests/test_lucas_coverage.py tests/test_lucas_probable_updates.py
python3 -m unittest tests/test_tool_intelligence.py
```

Do not commit a research batch that fails validation.

## Final completion double-check

When `source_not_recovered` reaches zero, independently recount Parts 351–749 and verify there are no duplicates or omissions; verify source-recovery records exactly match the coverage buckets; verify JSONL/CSV/registry compatibility outputs are synchronized; confirm unresolved website identities remain blank rather than guessed; run the full required validation twice on the final tree; and write `hermes/research/LUCAS_351_749_COMPLETE.md` with final exact totals and validation results.
