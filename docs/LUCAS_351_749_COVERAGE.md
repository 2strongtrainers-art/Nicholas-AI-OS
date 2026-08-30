# LucasWebQ Parts 351–749 Coverage

Checked: 2026-08-30

## What "complete coverage" means

The Nicholas AI OS now accounts for every integer Part from **351 through 749 inclusive (399 Parts)**. This is a coverage guarantee, not a claim that 399 website identities have been recovered.

The evidence model deliberately separates four states:

1. **Confirmed** — exact Lucas source plus strong website identity binding.
2. **Probable** — exact Lucas source plus a strongly matching website, but the exact post-to-domain binding remains incomplete. Human review only; route disabled.
3. **Source recovered / identity unresolved** — the exact Lucas Part and TikTok video ID are recovered, but no website is assigned.
4. **Source not recovered** — the Part is explicitly represented as an unresolved record. Web Surfers similarity must never be used to invent either the Lucas video or website identity.

## Current status

| Status | Parts |
| --- | ---: |
| Confirmed website mappings | 4 |
| Probable website mappings | 8 |
| Source recovered, website unresolved | 51 |
| Source not yet recovered | 336 |
| **Accounted total** | **399** |

Exact Lucas source/video recovery currently covers **63 of 399 Parts**.

### Confirmed

- 683 — MIT OpenCourseWare
- 704 — Yousician
- 736 — Dola AI
- 743 — StartMyCar

### Probable / review only

- 642 — Servier Medical ART
- 655 — DanceLogo
- 741 — GrabCraft
- 744 — Coursera Plus
- 745 — Post Bridge
- 746 — Chordify
- 748 — Planner 5D
- 749 — Runable

## Source recovery

Exact Part/video bindings are stored separately from website identity confidence under:

- `data/tool-intelligence/source-recovery/lucas-isolated.json`
- `data/tool-intelligence/source-recovery/lucas-536-557.json`
- `data/tool-intelligence/source-recovery/lucas-638-655.json`
- `data/tool-intelligence/source-recovery/lucas-731-749.json`

The **336 source-not-recovered Parts are also committed individually** under:

- `data/tool-intelligence/source-recovery/lucas-unrecovered-351-749.json`

That file contains one record per unresolved Part with source, video ID, caption hint, and website identity intentionally empty and routing disabled. It is a durable research backlog, not recovered-source evidence.

This split is intentional. It allows archival recovery to progress without weakening the standard for assigning a website to a Part.

The current recovered archive windows came from public creator/profile indexing, primarily cached Urlebird views of `@lucaswebq`, plus official/indexed TikTok sources already present in the canonical records. Where an archive only preserved a caption prefix, the source ledger stores that prefix as `caption_hint`; it does **not** label it an exact caption.

## Promotion rules

A source-recovered Part may move to **Probable** only when an independently verified canonical website has a distinctive functional match. It may move to **Confirmed** only when stronger evidence binds that exact Lucas post/Part to that specific website or domain.

A Web Surfers directory match alone is never enough to establish Lucas provenance.

When an unresolved Part is recovered, its explicit backlog record must be removed from `lucas-unrecovered-351-749.json`, added to a recovered-source ledger with its exact source evidence, and the master coverage buckets updated in the same change.

## Routing rules

- Confirmed mapping: may influence automatic routing, subject to separately verified execution capability.
- Probable mapping: review-only; no automatic Lucas-based routing.
- Source-recovered unresolved: no website identity and no Lucas-based routing.
- Source-not-recovered: no identity inference and no Lucas-based routing.

## Remaining research boundary

The 336 source-not-recovered Parts are not missing because of a registry-generation bug. Their exact creator-source bindings were not available in the public/indexed evidence recovered during the prior pass. They are now committed as **336 explicit records**, so future archive discoveries can be upgraded one Part at a time without renumbering, guessing, or silently creating false Lucas mappings.
