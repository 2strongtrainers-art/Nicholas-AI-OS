# Nine free tools and repos — acquired links and verification (2026-11-25)

Sources: two Instagram carousels — @get2ai, "15 free websites that replace paid
subscriptions" (Nov 25, 2026), and @aiagently, "10 GitHub Repos for High Ticket
Clients" (Nov 3, 2026). Nick picked five tools from the first and four repos
from the second to acquire for later use. This file records what each one is,
its license, and how to get it. Nothing here was installed or run — these are
references and links only. No code was copied into this repo.

**How these are held:** open-source tools are referenced by repo link and clone
command below. Following the `third_party/ai-tools-2026-10-15` pattern, they can be
pinned as Git submodules under `third_party/free-tools-2026-11-25/sources/` with a
`sources.lock.json`; Magic Hour has no public repo and is link-only. SaaS products
cannot be owned or vendored into a repo — they get a link and notes only.

## At a glance

| Tool / Repo | What it is | License | How to get it |
|---|---|---|---|
| [Cap](https://cap.so) | Open-source screen recorder with share links | AGPL-3.0 (camera/scap crates MIT) | Download at cap.so/download or `git clone https://github.com/CapSoftware/Cap.git` |
| [Magic Hour](https://magichour.ai) | AI video/image/audio tools (hosted) | Proprietary (SaaS) | Account at magichour.ai — link only |
| [LibreOffice](https://www.libreoffice.org) | Office suite (Writer, Calc, Impress) | MPL-2.0 (parts LGPL-3.0) | https://www.libreoffice.org/download |
| [LocalSend](https://localsend.org) | Offline file sharing across devices | Apache-2.0 | https://localsend.org/download or `git clone https://github.com/localsend/localsend.git` |
| [Open Library](https://openlibrary.org) | Free ebook lending library | AGPL-3.0 (code) | Use at openlibrary.org; code at https://github.com/internetarchive/openlibrary |
| [Twenty CRM](https://github.com/twentyhq/twenty) | Open-source CRM — lead pipeline | AGPL-3.0 (core; Enterprise files excluded, SDKs MIT) | https://github.com/twentyhq/twenty |
| [Listmonk](https://github.com/knadh/listmonk) | Self-hosted newsletter / mailing-list manager | AGPL-3.0 | https://github.com/knadh/listmonk |
| [Check If Email Exists](https://github.com/reacherhq/check-if-email-exists) | Email deliverability verification (no email sent) | MIT | https://github.com/reacherhq/check-if-email-exists |
| [Firecrawl](https://github.com/firecrawl/firecrawl) | Web scraping / crawling → clean markdown for agents | AGPL-3.0 | https://github.com/firecrawl/firecrawl |

## Cap — screen recorder for AI tutorials

- **What it is:** open-source alternative to Loom. Record screen, camera and mic,
  edit locally, share a link or export video. macOS, Windows, Linux; self-hostable.
- **Why acquired:** screen recordings are the backbone of Nick's AI tutorial videos.
- **License:** AGPL-3.0 for the main codebase (LICENSE file, verified 2026-11-25);
  the `cap-camera*` and `scap-*` crates are MIT. Implication: using the unmodified
  desktop app carries no obligation; if Nick ever modifies Cap and runs it as a
  service, the modified source must be shared under AGPL-3.0.
- **Official source:** https://cap.so — repo https://github.com/CapSoftware/Cap
  (pinned commit `5416fa4b17662eda5ac803812663fd91fcfaeede`, 2026-11-25).
- **How to get it:** download at https://cap.so/download, or
  `git clone https://github.com/CapSoftware/Cap.git`.
- **Free-tier limits:** the desktop app is free and open source with no stated
  limit. The hosted Cap Cloud has paid plans; its free-tier limits were not
  verified — check https://cap.so/pricing before relying on hosted sharing.
- **Use later:** record AI tool walkthroughs on the Mac; share links for tutorial
  drafts; self-host if link sharing ever needs to stay private.

## Magic Hour — AI video / B-roll

- **What it is:** hosted AI creation platform (text-to-video, image-to-video, face
  swap, lip sync, talking photos, avatars, image editing) running hosted models
  such as Kling, Veo and MiniMax on a prepaid credit balance.
- **Why acquired:** AI video and B-roll for short clips.
- **License:** proprietary SaaS — no public repo, no code to own. Link and
  account only.
- **Official source:** https://magichour.ai
- **How to get it:** create a free account at magichour.ai. Some tools can be
  tried without signup.
- **Free-tier limits (per multiple Nov 2026 reviews citing Magic Hour's official
  pricing page; re-check at magichour.ai):** 400 signup credits, plus 100 credits
  a day up to 7 claims (max ~1,100 credits — about 45 seconds of video, or ~15
  three-second 480p clips). Free video is 480p with a watermark, and free outputs
  are for **personal, non-commercial use only** — free-tier clips cannot be
  published on the AI page without a paid plan. Paid: Creator $19/mo ($12/mo
  annual), Pro $39/mo ($25), Business $99/mo ($66); one-time credit packs from $10.
- **Use later:** test clips and B-roll on the free tier; pay only if a clip is
  worth publishing.

## LibreOffice — Office replacement to recommend

- **What it is:** free, open-source office suite — Writer, Calc, Impress, Draw,
  Base, Math. Compatible with Microsoft Office formats.
- **Why acquired:** a genuinely free Office replacement to recommend to the
  AI-page audience.
- **License:** MPL-2.0 (official LibreOffice documentation: "distributed under
  the OSI-approved Mozilla Public License"; new code MPL-2.0 / LGPL-3.0).
  Implication: file-level copyleft; using the suite carries no obligation.
- **Official source:** https://www.libreoffice.org — download
  https://www.libreoffice.org/download; source
  https://www.libreoffice.org/download/source/ (canonical git:
  git.libreoffice.org/core; GitHub mirror https://github.com/LibreOffice/core).
- **How to get it:** download from libreoffice.org, or on Windows
  `winget install --id=TheDocumentFoundation.LibreOffice -e`.
- **Free-tier limits:** none — free for home, school and business use; the
  download page only invites an optional donation.
- **Use later:** recommend in AI-page "free tools" posts; use for any
  document/spreadsheet work that doesn't need Google Docs.

## LocalSend — offline file-sharing utility

- **What it is:** free, open-source app to share files and messages with nearby
  devices over the local network — no internet, no account, no cloud.
- **Why acquired:** quick offline file sharing between phone, Mac and other
  devices.
- **License:** Apache-2.0 (LICENSE file, verified 2026-11-25). Implication:
  permissive — use, modify and share freely; keep the license notice.
- **Official source:** https://localsend.org — repo
  https://github.com/localsend/localsend (pinned commit
  `44f48f18a5503c43873570ff489d27ff1983e198`, 2026-11-25).
- **How to get it:** download at https://localsend.org/download (Windows,
  macOS, Linux, Android, iOS), or
  `git clone https://github.com/localsend/localsend.git`.
- **Free-tier limits:** none — no paid tier, no account, no usage cap.
- **Use later:** move video clips and images between phone and Mac without
  uploading anywhere.

## Open Library — free ebook lending

- **What it is:** the Internet Archive's free ebook lending library — millions
  of books to borrow online.
- **Why acquired:** a genuinely free reading resource to recommend; research
  reading for the AI page.
- **License:** AGPL-3.0 for the website's code (LICENSE file, verified
  2026-11-25). Implication: the code is open, but the service is what Nick
  uses — running a modified copy as a service would require sharing the source.
- **Official source:** https://openlibrary.org — code
  https://github.com/internetarchive/openlibrary (pinned commit
  `a340e3f36973424f5e5af0a3913fb2ea70b84960`, 2026-11-25).
- **How to get it:** use at https://openlibrary.org (free account to borrow);
  code reference only — `git clone https://github.com/internetarchive/openlibrary.git`.
- **Free-tier limits:** none on cost; borrowing follows the site's lending rules.
- **Use later:** borrow research books for AI-page topics; recommend as a free
  reading resource.

## Safe carousel repos — lead-gen stack (from @aiagently, Nov 3, 2026)

Four open-source repos from the "10 GitHub Repos for High Ticket Clients"
carousel that fit a B2C coaching business. All are referenced (repo link +
clone/run command), NOT copied into this repo. Verified Nov 25, 2026 from
each repo's LICENSE file and README.

### Twenty CRM — twentyhq/twenty

- **What it is:** open-source CRM. Objects, views, workflows, and agents;
  pipeline stages from New Lead to Won. Built for technical teams to shape
  into a custom CRM.
- **Why Nick acquired it:** to run his coaching pipeline — Bark lead →
  assessment → client — in one place instead of scattered sheets and memory.
- **License:** AGPL-3.0 for most of the project, with two qualifications in
  the LICENSE file: files marked `/* @license Enterprise */` are under a
  commercial license and are NOT open; the CLI, SDKs, twenty-ui, and
  twenty-apps packages are MIT. A "Twenty Application Exception" (AGPL §7)
  means apps built through Twenty's Application Interfaces are not governed
  by AGPL. If Nick modifies Twenty itself and runs it on a server, AGPL §13
  requires sharing the modified source.
- **Official source:** https://github.com/twentyhq/twenty
- **How to get it:** self-host with Docker Compose
  (https://docs.twenty.com/developers/self-host/capabilities/docker-compose),
  or use the hosted Cloud at twenty.com (paid service, price unverified).
- **What it needs:** Docker + PostgreSQL + Redis + a host. Heaviest of the
  four to run.
- **Limits / caveats:** self-hosted build is the AGPL core only (no
  Enterprise features). Heavyweight for ~26 leads — a spreadsheet works
  today; this is the system to grow into, not a day-one need.
- **Use later:** the client pipeline for TriValley.fit — every Bark lead
  tracked from first contact to paying coaching client.

### Listmonk — knadh/listmonk

- **What it is:** standalone, self-hosted newsletter and mailing-list
  manager in a single binary. Import lists, segment audiences, run email
  campaigns. Uses PostgreSQL.
- **Why Nick acquired it:** to email his own list (newsletter, audience,
  past clients) once he has one — for TriValley.fit and the AI-tips page.
- **License:** AGPL-3.0. If modified and run on a server, the modified
  source must be shared (AGPL §13).
- **Official source:** https://github.com/knadh/listmonk
- **How to get it:** `curl -LO
  https://github.com/knadh/listmonk/raw/master/docker-compose.yml &&
  docker compose up -d`, then http://localhost:9000. Or download the
  single binary from the releases page.
- **What it needs:** PostgreSQL + an SMTP server/account to send mail.
  App itself is free; no paid key.
- **Limits / caveats:** for his OWN opt-in list only. Never for cold
  email — that is spam, and it would burn his sender reputation.
- **Use later:** the newsletter engine for the AI-tips page and
  TriValley.fit once the audience exists (currently zero readers — do not
  set up until there is a list to mail).

### Check If Email Exists — reacherhq/check-if-email-exists

- **What it is:** checks whether an email address exists without sending
  any email — syntax, MX/DNS records, disposable-address check, SMTP
  reachability, deliverability, disabled mailbox, full inbox, catch-all.
  Comes with an HTTP backend, a CLI, and a Rust library.
- **Why Nick acquired it:** to verify a prospect's email address before
  replying, so replies don't bounce into the void.
- **License:** MIT (LICENSE.md, Copyright (c) 2026 Reacher). The most
  permissive of the four — use, modify, and distribute freely, including
  in closed work, with the notice kept.
- **Official source:** https://github.com/reacherhq/check-if-email-exists
- **How to get it:** CLI binary from the releases page (checks directly
  from your computer, nothing else needed), or `docker run -p 8080:8080
  reacherhq/backend:latest` for the HTTP backend (needs outbound port 25
  open), or the Rust crate `check-if-email-exists = "0.9"`.
- **What it needs:** nothing for one-off CLI checks. At volume, SMTP
  proxy servers are needed (README points to proxy25.com, paid). A hosted
  SaaS also exists (reacher.email / No2Bounce, paid, price unverified).
- **Limits / caveats:** a "deliverable" result is a confidence signal,
  not a guarantee — e.g. Gmail disables SMTP verification for some
  addresses. No paid key needed for the open-source tool itself.
- **Use later:** verify any email address before sending — Bark leads,
  business contacts, newsletter signups.

### Firecrawl — firecrawl/firecrawl

- **What it is:** turns websites into clean, LLM-ready markdown — scrape,
  crawl, map, search. Built for AI agents. Three ways to run it: Local
  (one binary on your machine), Cloud (hosted), or full self-host.
- **Why Nick acquired it:** research and personalization — pull a page's
  content into clean markdown for market research and content prep.
- **License:** AGPL-3.0. If modified and run on a server, the modified
  source must be shared (AGPL §13).
- **Official source:** https://github.com/firecrawl/firecrawl (org moved
  from mendableai/firecrawl — the carousel may link the old org).
- **How to get it:** Local: `cargo install firecrawl-local` (needs Rust +
  C compiler), then `firecrawl-local scrape <url> --markdown` or
  `firecrawl-local init` to add it as an MCP server. Cloud: firecrawl.dev
  — Keyless gives 1,000 free credits/month, no signup. Full self-host:
  the repo's docker-compose.yaml.
- **What it needs:** Local needs Rust and a browser on the machine for
  JS-heavy pages. Self-host needs a Docker host; AI-backed features need
  an OpenAI-compatible endpoint or Ollama. Default self-hosted API is
  unauthenticated with no persistent volumes — not production-ready as
  shipped.
- **Limits / caveats:** limited use for Nick — his Bark prospects rarely
  have websites. Scraping must respect each site's terms/robots rules;
  the tool is legal, misuse is not. Local Cloud-fallback calls go to
  Firecrawl Cloud at a limited rate unless `FIRECRAWL_CLOUD=off`.
- **Use later:** research for the AI-tips page and fitness content —
  pull competitor pages, docs, and articles into clean markdown for
  analysis.

## Claims that require qualification

- "Free" is not the same across these nine. Cap, LibreOffice, LocalSend and Open
  Library are free with no payment wall. Magic Hour is a free tier with a hard
  credit cap, a watermark, and personal-use-only outputs. Twenty, Listmonk and
  Firecrawl are free to self-host but need a host, a database, and setup time —
  free as in code, not free as in zero effort. Check If Email Exists is free for
  one-off CLI checks; volume use needs paid SMTP proxies.
- Magic Hour's free tier cannot produce publishable clips for the AI page — any
  clip meant to be posted needs a paid plan or a credit pack.
- Acquiring a link or a repo reference does not install or run anything. None of
  these nine was installed, built, or tested on any machine for this file.
- Free-tier figures for Magic Hour come from Nov 2026 reviews citing the
  official pricing page, not from a direct read of magichour.ai/pricing — re-check
  there before spending or publishing.

## Excluded from the @aiagently carousel — why

- **LeadHunt** — B2B agency lead gen; wrong audience (Nick sells coaching to
  individuals), needs paid data/LLM keys.
- **LeadForge** — B2B company research + decision-maker finder for agency
  outreach; wrong audience, needs paid enrichment keys.
- **OpenProspector** — chains paid data providers (Apollo etc.) to enrich B2B
  leads; costs money, wrong audience.
- **Google Maps Leads Scraper** — scraping Google Maps breaks Google's ToS; the
  "leads" are businesses, not people who want a trainer.
- **Harvey (AI SDR)** — automates mass cold outreach; costs money, risks Gmail
  deliverability, conflicts with his warm/personal outreach rule.
- **OpenOutreach** — auto-personalized outreach at scale; same mass-outreach
  problem in smaller form — he already has Phil drafting in his voice.
