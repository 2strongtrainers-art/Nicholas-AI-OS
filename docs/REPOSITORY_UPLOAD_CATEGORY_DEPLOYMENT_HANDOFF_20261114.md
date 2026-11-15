# Owner-uploaded repository photos — category acquisition, Chief and n8n handoff

**Source audit:** Nine directly inspected screenshots: IMG_8179–8182 (OpenBB, FinceptTerminal, Vibe-Trading, QuantConnect LEAN); IMG_8098–8102 (26 Image-OSINT entries / 25 unique, repeated FaceCheck.id). Exact extracted records are in `data/repo-portfolio/uploaded-screenshot-category-coverage-20261114.json`, plus the preexisting OSINT screenshot registry.

**Objective:** At least **one or two vetted upstream sources per usable functional category**. Here this means references or immutable pinned Git submodules. It **does not** authorize simultaneous execution of external projects or assert 100% deployed integration.

## Confirmed category coverage

| Category | 1–2 preferred verified sources | Acquired at | Runtime status |
|---|---|---|---|
| Financial market data and research | OpenBB, FinceptTerminal | Existing pinned market/AI source submodules | Historical adapter/terminal study; actual hosted data ingestion must be verified |
| Trading AI and strategy/backtesting | HKUDS/Vibe-Trading, QuantConnect/Lean | Existing pinned submodules, with additional AutoHedge research pointer | Research/paper-only, no live orders; independent LEAN study unverified |
| Image metadata | ExifTool, Exiv2 | New pinned OSINT submodules; ExifTool already part of isolated container image | ExifTool was smoke-tested; Exiv2 reference only |
| Signed provenance and image tampering | c2patool, Sherloq | New pinned submodules | c2patool adapter bundled offline; signed-example acceptance and Sherloq pilot pending |
| Metadata removal / safe public derivatives | MAT2, ExifCleaner | New pinned submodules | **Not live.** Never alter primary evidence; produce separately hashed derivatives |
| Public-source preservation | Bellingcat Auto Archiver, ArchiveBox | New pinned submodules | **Not live.** Network crawler requires SSRF/redirect/dns egress/storage/terms review |
| Video/keyframe/source cross-check | AFP Medialab InVID/WeVerify, MediaInfo | New pinned submodules | Manual browser-keyframe or container pilot only; no sensitive upload |
| Reverse image web search | Google Lens, TinEye, Bing, Yandex, Baidu, Karma Decay | Exact screenshot names linked as **external websites**, not installable GitHub repos | Manual or approved provider API only. Exemption to 1–2 repos rule |
| Face-identification services | PimEyes, FaceCheck.id (#20 and duplicate #26) | **Deliberately not acquired** | No autonomous identity search or person tracing |

**Important screenshot discrepancies:** the source image labels OpenBB 'AGPL-3.0', but repository version/license needs checking before licensing assertions; MAT2 means 'Metadata Anonymisation Toolkit 2', not the screenshot's 'Multimedia Analysis Tool'. A screenshot cannot establish official project identity, star counts, functionality or maintenance. Only official repo source, license, SHA and observed tests count as evidence.

The ten new OSINT sources are **Git submodule pins** at the frozen November 14–15 upstream commits listed in `.gitmodules` and the JSON inventory. Gitlinks do not download code on ordinary checkout, do not run third-party binaries, do not install account services or spend money, and need separate read-only initialization if reviewed. Do not change deploy entrypoints, enable internet crawling, or recursively pull all submodules.

## Deployment truth table — not all green

- **ARGUS Cloudflare:** Standalone `2strongtrainers-art/argus-prime-forensics` production Cloudflare Build `cc76dbdb` for commit `7b58290` succeeded after owner-confirmed Workers Paid upgrade. This is **build success**, NOT proof of live /health, dedicated ARGUS_FORENSICS_API_KEY, 401 unauthorized or authenticated synthetic SHA-256, or ARGUS mission connector.
- **Market Desk:** Python confluence/missing-bar policy tests and GitHub-hosted report workflow are implemented. Hosted Alpaca ingestion needs independent secret entitlement/configuration; ChatGPT's Alpaca connection is not a GitHub Actions secret. Vibe, Fincept and LEAN source pins are not running production broker systems. No live order authorization.
- **Source images:** ExifTool, C2PA and the 10 pinned source refs do not validate online video or tanker photos without original authorized source material. Prefer primary records over speculation.
- **n8n:** `workflows/n8n/trivalley-coaching-intake.json`, `trivalley-reel-render-status.json` and `trivalley-reel-review.json` are inactive EXPORTS in GitHub. The owner-private n8n Cloud workspace `kappy782.app.n8n.cloud` had separate published Wix intake and reel status workflows verified on Nov 12. Its trial/plan and current state require fresh checking. An n8n export is NOT an imported or active workflow. n8n connector is not installed in this chat and the owner has declined TinyFish; do not bypass authentication.
- **Chief:** Persistent instruction in the Chief briefing must point to this document and the canonical category inventory, with outcome reporting by source/commit, tests and proof of actual endpoint execution.

## Chief-of-Staff / n8n no-loop handoff

1. **Chief inventory:** Review screenshot registry, existing 11 market/AI pointers, new 10 OSINT pointers, and open PRs. Track each category with `source verified / acquired / offline tested / cloud built / live authenticated / integrated` separately. Do not claim full deployment on a single green PR.
2. **Chief prioritization:** (a) finish ARGUS private authenticated acceptance; (b) independently verify Hermes Mac-off real job and Switchboard public health/auth; (c) fix hosted market feed missing credentials, *without entering broker order permissions*; (d) test relevant n8n hosted workflow execution IDs and trial/paid status; (e) review website, content and business workflows for duplication/cost.
3. **n8n scope:** Only read-only repository deployment status and no-contact handoff until workflow is imported in **authenticated** n8n workspace and execution receipt is visible. Do not enable another scheduled webhook into real Wix intake or auto-send client messages. Preserve existing n8n production review queues.
4. **Validation:** every category has 1–2 source pins or a justified exception; every *live* service needs real endpoint/authorization proof. Report root causes with failure codes. Keep full commit ID, build ID, latest owner consent and current date.
5. **Stop condition:** full deployment means **only explicitly selected supported services** passed acceptance. External commercial sites, face-search providers, and enormous unrelated GitHub repos are not deployment obligations. An owner-approved security/billing change remains a separate decision.

## Next actions / owners

- **Model / GitHub:** finish synthetic category manifest checks, code-review and merge source pointers. No provider runtime or account secret changes.
- **Chief of Staff:** complete categorized readiness audit, track real runtime receipts, issue priority plan and give owner a concise bottom-line brief.
- **n8n operator:** verify the existing authenticated hosted workflows and import the optional read-only coverage monitor only if approved and rate limits allow; share execution receipt. No direct n8n control here.
- **Cloudflare owner:** set separate encrypted forensic Bearer secret in actual Worker. Never paste it in chat or public GitHub. Validate 401 and synthetic image before private evidence.
- **Market account owner:** configure authorized Alpaca read-only Keys in the correct GitHub environment if desired; verify quote source, freshness and no-order policy.
