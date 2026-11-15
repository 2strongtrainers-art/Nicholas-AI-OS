# ARGUS PRIME OSINT integration — security and license review

**Baseline: November 14, 2026. Source: owner-provided screenshot list of 26
entries (25 distinct names, facecheck.id repeated at #20 and #26).**

## Repository boundary

Nicholas-AI-OS is presently a PUBLIC GitHub repository. Former
capabilities.yaml entry marked repository_visibility private incorrectly.
Public repository content is approved automation/code, never private evidence,
GPS coordinates, personal investigation reports, uploaded photographs,
credentials, case notes or private API response bodies.

Keep ARGUS case evidence, reports, original files and enhanced EXIF in a
private owner-authorized evidence store. GitHub Actions should use exclusively
synthetic fixtures. Do not save sensitive evidence in PR comments, action
artifacts, job logs, commit history or public release assets.

## Candidates and decisions

| Project | Source | Security and licensing disposition |
| --- | --- | --- |
| ExifTool | https://github.com/exiftool/exiftool | Phase-1 metadata reader. Dual Perl Artistic/GPL-style terms; verify the distributed version and notices. Never execute on files outside isolated sandbox. |
| c2patool | https://github.com/contentauth/c2patool | Phase-1 signed-provenance reader. MIT or Apache 2.0. Pinned v0.29.0 Linux release SHA-256 in Dockerfile; C2PA does not prove depicted facts. |
| ArchiveBox | https://github.com/ArchiveBox/ArchiveBox | MIT; external web archive. DISABLED pending network egress/redirect/SSRF control, isolated storage and owner review. Do not enable its public submissions for sensitive cases. |
| Sherloq | https://github.com/GuidoBartoli/sherloq | GPL-3.0, human-pilot only. No automatic manipulation certainty or code bundling until dependency and licensing review. |
| Exiv2 | https://github.com/Exiv2/exiv2 | Metadata cross-check candidate, not installed. Review distribution and licensing before integration. |
| Screenshot-listed commercial and web services | See data/osint/image-tools-screening-20261114.json | Do not assume a product has a public repo, safe API, unmetered usage or acceptable upload privacy. |

c2patool official GitHub release on 2026-11-12:
v0.29.0-x86_64-unknown-linux-gnu.tar.gz
SHA-256 af5494722fc8c3f239980f36ceb3acf496d1481850d356a4bb34777b33b08043.
ArchiveBox v0.9.77 release is identified for follow-up, not installed.

## Threat model and controls

- Untrusted image files may attack metadata parsers. Run container as unprivileged
  user with --network none, --read-only, no Linux capabilities, no-new-privileges,
  bounded pids/CPU/memory/tmpfs, immutable input mount and restricted output mount.
- The release archive is hash-verified at build time. Review build dependencies
  and pin base-image digest and Debian package versions before production.
- Treat image metadata and all web content as untrusted data, never prompts
  to execute, instructions to fetch secret-bearing URLs, or proof of a person.
- The report includes only requested fields; GPS and sensitive timestamps
  require explicit opt-in. The user is responsible for authorized evidence.
- No arbitrary URL fetching by the offline worker. ArchiveBox requires a
  separate audited network worker with connection-level public-IP enforcement
  after every DNS resolution and redirect, network egress firewall rules,
  crawl budgets, allowlists, and approved private artifact retention.
- No automatic face identification, target tracking, private-account scraping,
  external exploitation, or sensitive uploads.
- No paid vendor API call unless the repository cost guard and explicit review
  authorize it; keep ALLOW_PAID_AI and other kill switches intact.
- Every output records SHA-256, observed tool results, limitations and actual
  status. Errors must never be silently converted into clean/verified findings.

## Acceptance gate before real ARGUS missions

1. Synthetic unit tests pass and Docker build verifies both executables.
2. A private host runs the container with documented restrictions.
3. An owner-authorized, non-sensitive test image is processed end-to-end;
   its hash matches original bytes and the report cannot be overwritten.
4. Private report storage and retention are verified. No private content or
   full C2PA manifest leaks into GitHub logs, Cloudflare Workers or public CI.
5. A scoped, authenticated job handoff to ARGUS is implemented and tested,
   without passing evidence through the public repo.
6. A reviewer approves production use; do not merge and call live without it.
