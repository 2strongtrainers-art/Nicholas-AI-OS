# ARGUS PRIME image evidence handling

## Evidence receipt
Record evidence ID, who provided the image, source URL (if public),
acquisition time in UTC, image-or-screenshot distinction and scope of
permission. Keep original bytes in an owner-private, access-controlled store.

Do not assume a social-media screenshot retains original camera EXIF.
Hash the ORIGINAL file (SHA-256), preserve bytes, and use non-destructive
analysis; never overwrite originals. Capture and document derived copies
separately with their own hashes.

## Data extraction
Use services/osint-forensics/analyze.py only inside the network-disabled
container documented in its README. By default only selected non-sensitive
metadata is returned. Include sensitive fields only on explicit investigative
need and retain the report privately. Report absent tool, timeout, invalid
JSON or parser failure as such; do not infer innocence or authenticity.

## Public-source checks
When legitimately accessing public pages, retain source title, canonical URL,
publisher, actual occurrence time versus publication time, capture UTC,
content hash, and evidence ID. Preserve independent corroboration. Never
represent reverse-search similarity as proof that two photos have the same
origin, or temporal proximity as evidence of coordination.

## Reporting
1. Verified observation with exact source or tool proof.
2. Claim reported by a source, with provenance and contradictions.
3. Inference or hypothesis, with alternative explanations.
4. Unknowns, stale information and meaningful error modes.
5. Confidence assessed per claim, not a single magical forensic score.

ARGUS PRIME's private mission and evidence store remain the authoritative
report destination. The GitHub repo contains only reusable code and guidance.
No live ARGUS report save, automation, remote archive or scheduled monitoring
is implemented by this Phase-1 pull request.
