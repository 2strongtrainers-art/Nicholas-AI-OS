# ARGUS PRIME — OSINT screenshots: verified tool/repo acquisition review

As-of: 2026-11-14. Based on five user screenshots advertising entries 1–26,
with FaceCheck.id repeated (#20 and #26): **25 unique names**. Local examination
of all five uploaded JPEGs found only resolution/orientation EXIF, no GPS or
original camera/timestamp. Screenshot logo/name != original developer repo.

## Official, verified GitHub repositories corresponding to actual screenshot names
- #1 **ExifTool** — https://github.com/exiftool/exiftool — metadata reader;
  dual Artistic/GPL licensing per original project; local read-only candidate in PR #152.
- #13 **MAT2** — https://github.com/jvoisin/mat2 — LGPL-3.0, current main is NOT archived;
  suitable to strip metadata on public *copies*, never the original evidence.
- #14 **Exiv2** — https://github.com/Exiv2/exiv2 — GPL-2.0+ metadata parser;
  independent parser pilot, isolated processing.
- #7 **Forensically** — https://29a.ch/photo-forensics/ — browser-side visual analysis
  of clone/noise/ELA/C2PA. Official source-code redistribution license NOT verified,
  so treat as hosted browser product, not code to clone.
- #2 FotoForensics: online image tool; sensitive-image upload not approved.

Do not infer an official repo for the generic screenshot entries #4 CameraTrace,
#6 Image Forensics Analyzer, #8 Kwai EXIF Scanner or #10 Imago Forensics merely
from similarly named GitHub projects. Other external service listings remain
candidates only, pending source and vendor verification. #17–19, #21–22 and #25
are reverse-image/search sites, not installable GitHub implementations. #16,
#20 and #26 are face-search products and excluded from autonomous lookup;
#15 Hunchly, #23 Social Catfish and #24 Berify are proprietary/commercial.

## Additional officially verified open-source repos worth studying
| Repository | License checked in repo | Value to ARGUS | Execution status |
| --- | --- | --- | --- |
| https://github.com/contentauth/c2patool | MIT OR Apache 2.0 | Signed media provenance | Adapter in unmerged PR #152 |
| https://github.com/GuidoBartoli/sherloq | GPL-3.0 | JPEG, noise and cloned-region analysis | separate pilot, never automatic verdict |
| https://github.com/bellingcat/auto-archiver | MIT | Archive public evidence, timestamps, hashes, media | reference only; network controls needed |
| https://github.com/AFP-Medialab/verification-plugin | MIT | InVID/WeVerify video keyframes, reverse-image-source checks | browser/manual until approved |
| https://github.com/MediaArea/MediaInfo | BSD 2-Clause | Original video/audio container metadata | local optional pilot |
| https://github.com/ArchiveBox/ArchiveBox | MIT | Public archive and source preservation | isolated network worker only |
| https://github.com/OpenCTI-Platform/opencti | Apache 2.0 Community Edition | Cyber indicators and relationship analysis | heavy optional standalone service |
| https://github.com/MISP/MISP | AGPL-3.0 | Compare independently published cyber IOCs | heavy optional standalone service |
| https://github.com/bellingcat/toolkit | catalog; redistribution terms to verify | Maps, transport, geolocation, media, research leads | research directory only |

## Direct benefit to national security × market investigations
FAA: verify official router reports against source/incident dates; check original
public evidence and flight-operation counts; compare airline/LHX prices with a
proper event window. No image parser reveals secret router logs.
Hormuz: preserve origin footage, identify source post chronology and independently
check maritime incident reporting and vessel/owner identity **without face-searching
people**. State military claims do not prove ship losses.
Nvidia: SEC releases, official export-control notices and market data are
stronger than image forensics for substantiating policy or financial impact.
Avoid invented inter-incident attribution, false market correlations or causal claims.

## Deployment boundary
The current GitHub code repo is public. Keep originals, personal EXIF, screenshots,
case material, credentials and reports outside GitHub. Source discovery and
versioned skill guidance are safe; executing third-party binaries, automatically
archiving arbitrary URLs, or spending on search APIs needs separate security
and terms review, authorization and a private worker. PR #152 is still OPEN.
