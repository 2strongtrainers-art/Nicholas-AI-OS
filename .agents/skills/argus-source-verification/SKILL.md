---
name: argus-source-verification
description: Source, photo, video, evidence and incident-market OSINT verification for ARGUS PRIME. Use the vetted screenshot tools and extra repositories as research leads, never as unverified executable connectors.
---

# ARGUS PRIME source and image verification

Start with [screenshot source registry](../../../data/osint/screenshot-tool-screening-20261114.json)
and [research notes](../../../docs/osint/screenshot-osint-repository-review.md).
The screenshots are **tool-name leads**, not original event photography or permission to
upload private data. These documents are knowledge references, not installed adapters.

## Select the right method
1. For original owner-authorized image/video: hash original, preserve immutable private
   copy; only run ExifTool/C2PA from an APPROVED sandbox after its runtime is truly deployed.
   Metadata is a clue, not location or event authentication.
2. For social-media screenshot: original camera EXIF typically absent. Find earliest
   independently verifiable public post via permitted reverse-image search; verify
   publication time, original author/source, video frames and context.
3. For moving media: Bellingcat Auto Archiver can capture public sources; AFP-Medialab
   InVID/WeVerify can extract keyframes, and MediaInfo can inspect local video format.
   Separate browser/manual tools from an execution adapter.
4. For manipulation clues: browser-local Forensically and isolated Sherloq can reveal
   inconsistencies but do not produce a reliable automatic true/false verdict.
5. For archive tools: network crawlers require SSRF/redirect/DNS/egress controls,
   provider terms, private retention, and approval. Never expose evidence in public
   GitHub Actions or commit history.
6. Do not automate facial identity lookup, people tracking, unauthorized scraping,
   provider-spend, raw external uploads, or active security testing.

## Event-to-market OSINT
Use FAA/DOT, NWS/NOAA, CISA, UKMTO, company filings/SEC, ship or flight authorities and
independent press to build a source and event ledger. Separate event time from report time,
and regular-session from after-hours market pricing. Connect events to tickers by **actual**
business exposure and test competing market drivers; no causal arrow from coincidence.
Clearly mark confirmed, reported, contradictory, historical, unverified and unavailable.

## Acquisition and truthful reporting
A GitHub repository can be inspected without being installed; a hosted website is
not a supported API unless independently verified. For any new tool, review original
maintainer, real license, dependencies, vulnerabilities, checksum/pins, sandbox and terms.
Report whether you researched, executed, tested or deployed each capability. PR #152
already proposes ExifTool/C2PA adapters but is NOT live until merged + privately deployed.
