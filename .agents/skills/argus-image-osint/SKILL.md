---
name: argus-image-osint
description: Evidence-first, privacy-preserving image OSINT for ARGUS PRIME investigations. Requires a verified isolated worker for local tools.
---

# ARGUS PRIME image OSINT — execution skill

This is a versioned research protocol, NOT proof that any tool has been installed
in ChatGPT, Cloudflare, Hermes, or the ARGUS PRIME connector.

## Start with scope and the original file
1. Identify the authorized mission, question, evidence owner, and source provenance.
2. Prefer the original image over a social-media screenshot; platforms may strip EXIF.
3. Keep the original in private owner-approved storage. Never add private evidence,
   GPS coordinates, face images, tokens, or investigative results to public GitHub.
4. Record receipt time, retrieval URL if public, SHA-256, size, and custody actions.

## Tool decision sequence
- For a user-supplied original: run the isolated local SHA-256/ExifTool/C2PA
  adapter only when that worker and its network-denied sandbox are verified.
- Require explicit --include-sensitive to obtain GPS, device serials, owner
  strings, or original capture timestamps. Such outputs stay in private storage.
- A reported EXIF timestamp or GPS coordinate is a clue, not a confirmed fact.
- A C2PA manifest records signed provenance assertions; it does not establish
  that the scene, timestamp, location, or claims in the image are true.
- For a suspected edit, Sherloq is a human-reviewed second-stage research
  candidate, not an automatic fake-image verdict.
- For public web reuse/source matching, use available legitimate reverse-image
  interfaces manually or via separately approved provider APIs. Preserve each
  independent source's original URL and retrieval time.
- ArchiveBox is disabled until a separate egress-controlled worker and
  approved storage are verified. Do not automatically crawl supplied URLs.
- Never automate face-search/identification, scraping behind access controls,
  unknown paid services, or public uploads of private evidence.

## ARGUS report preparation
Clearly distinguish: observed data, reported claims, analytic inference,
competing explanations, unknowns, and limitations. Cite source URLs and
evidence IDs. Include tool names/versions ONLY if actually executed.
A screenshot, missing EXIF, error-level analysis result, or absent C2PA
manifest is not proof of a location, author, manipulation, or attack.

## Connected ARGUS boundary
Use a real, authorized ARGUS mission ID from argus_list_missions; read its
current revision before saving an actually performed research report.
The GitHub skill does not itself call ARGUS, grant new connector permissions,
establish scheduling, or activate the hosted OSINT worker.

## Operator references
- services/osint-forensics/README.md
- services/osint-forensics/tool-manifest.json
- data/osint/image-tools-screening-20261114.json
- docs/osint/EVIDENCE_HANDLING.md
- docs/osint/SECURITY_AND_LICENSE_REVIEW.md
