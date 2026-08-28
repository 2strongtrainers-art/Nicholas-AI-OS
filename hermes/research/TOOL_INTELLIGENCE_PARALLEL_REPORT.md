# TriValley Tool Intelligence — Hermes Parallel Report

Checked at: `2026-08-28T17:55:10Z`

## Result

This run added Lucas-specific evidence for Parts **683, 704, 731, 735, 736, 737, 741, 743, 744, 745, 746, 748, and 749**. It did not import third-party creator numbering and did not overwrite the previously reported stronger evidence for Parts 536–557 or 638–655.

The branch did **not** contain `data/tool-intelligence/` or another documented canonical staging convention. The work therefore remains isolated under `hermes/research/` and does not compete with Codex-built canonical infrastructure.

## Confidence summary

### Confirmed

- **Part 683 — MIT OpenCourseWare — https://ocw.mit.edu/**. Official TikTok oEmbed binds video `7653516171005775126` to the exact Part 683 caption; MIT OpenCourseWare independently verifies the described lecture notes, exams, videos, assignments, and problem sets.[1][2]
- **Part 704 — Yousician — https://yousician.com/**. Official TikTok oEmbed binds video `7661680143441661207` to Part 704; TikTok discovery indexing names Yousician for that Part, and Yousician independently verifies song-based learning across guitar, piano, and other instruments.[3][4]
- **Part 736 — Dola AI — https://dola.com/**. Official TikTok oEmbed binds video `7673554479370849558` to Part 736 and includes `#dola`; Dola independently presents itself as an everyday AI assistant.[5][6]
- **Part 743 — StartMyCar — https://www.startmycar.com/**. Official TikTok oEmbed binds video `7676147643696876822` to the owners-manual/repair/fuse-diagram caption; TikTok topic indexing associates the exact Lucas Part with StartMyCar, whose public site was independently verified.[7][8]

### Probable

- **Part 741 — GrabCraft — https://www.grabcraft.com/**. Original Lucas indexing confirms Part 741 and a step-by-step caption prefix; Lucas Instagram indexing describes Minecraft build instructions, and GrabCraft strongly matches. The exact full caption/domain frame was not recovered.
- **Part 744 — Coursera Plus — https://www.coursera.org/courseraplus**. Official oEmbed confirms the Part and caption; Lucas's official Linktree includes Coursera Plus, and the official product matches the description of courses from top institutions with certificates. Exact frame/domain binding remains missing.[9][10]
- **Part 749 — Runable — https://runable.com/**. Official oEmbed confirms the distinctive all-in-one caption; Runable independently matches websites, slides/pitch decks, videos, brand assets, and workflows. Exact frame/domain binding remains missing.[11][12]

### Pending

- **Part 731** — exact Lucas video/caption recovered, but “build almost anything” is not a unique product identifier.
- **Part 735** — exact Lucas video/caption recovered, but the broad “learn how to do almost anything” wording and `#3dmodel` tag are insufficient for identity.
- **Part 737** — original Lucas post ID and caption recovered, but “create workflows instantly” matches many products.
- **Part 745** — exact Lucas video/caption recovered, but multiple tools offer branded video templates plus cross-post scheduling.
- **Part 746** — exact Lucas video/caption recovered, but the wording overlaps several music-learning products and a prior Lucas Part.
- **Part 748** — exact Lucas video/caption recovered, but several home-design products match “build your dream home in 3D.”

These rows preserve the exact post identifiers and captions where available without assigning speculative website names.

## Canonical URLs verified

- https://ocw.mit.edu/
- https://yousician.com/
- https://dola.com/
- https://www.grabcraft.com/
- https://www.startmycar.com/
- https://www.coursera.org/courseraplus
- https://runable.com/

A verified canonical URL does not by itself upgrade a Lucas Part mapping to Confirmed; the mapping confidence also requires direct post-to-site evidence.

## Safe Hermes-router integration recommendations

1. Treat `lucas_source_url + video_id` as provenance keys and reject a row when the creator handle or ID is missing.
2. Auto-ingest **Confirmed** rows only. Route **Probable** rows to a human-review queue and retain **Pending** rows as evidence leads, not tool registrations.
3. Keep website capability claims separate from Part-match confidence. A site can be operationally verified while its Lucas mapping remains Probable.
4. Do not route API, MCP, or CLI workflows from `Unknown` fields. Require official documentation and a fresh verification before advertising those interfaces.
5. Preserve `checked_at`, `evidence_sources`, and the exact caption so future jobs can upgrade confidence without losing provenance.
6. Prefer public/free access paths by default. Keep account, subscription, and payment gates explicit in routing metadata.

## Files

- `hermes/research/lucaswebq-parts-351-749-evidence.jsonl`
- `hermes/research/lucaswebq-parts-351-749-evidence.csv`
- `hermes/research/TOOL_INTELLIGENCE_PARALLEL_REPORT.md`

## Validation performed

- Parsed every JSONL line as JSON.
- Parsed the CSV and compared row count, Part order, required fields, and confidence values against JSONL.
- Checked that all Parts are within 351–749 and unique.
- Checked that every non-empty canonical URL uses HTTPS.
- Checked that Confirmed/Probable rows have a website name and canonical URL.
- Checked that all required fields are present on every row.
- Verified the report citation ledger and source block.
- Inspected the final Git diff and repository status before commit.

## Sources

[1] https://www.tiktok.com/@lucaswebq/video/7653516171005775126 — Lucas Part 683
[2] https://ocw.mit.edu — MIT OpenCourseWare
[3] https://www.tiktok.com/@lucaswebq/video/7661680143441661207 — Lucas Part 704
[4] https://yousician.com — Yousician
[5] https://www.tiktok.com/@lucaswebq/video/7673554479370849558 — Lucas Part 736
[6] https://dola.com — Dola AI
[7] https://www.tiktok.com/@lucaswebq/video/7676147643696876822 — Lucas Part 743
[8] https://www.startmycar.com — StartMyCar
[9] https://www.tiktok.com/@lucaswebq/video/7676520158701030688 — Lucas Part 744
[10] https://www.coursera.org/courseraplus — Coursera Plus
[11] https://www.tiktok.com/@lucaswebq/video/7678376034017742102 — Lucas Part 749
[12] https://runable.com — Runable
