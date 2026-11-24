# TriValley FIT — actual OpenGym fork build

This directory contains a **reproducible transformation of the actual screenshot repository**, not the independent PWA that was initially published.

- Source repository: https://github.com/alexpcosta/opengym
- Pinned source commit: `678bf5bf10446e8997a77d43e89c9b2721d8d0fc`
- Upstream project: https://github.com/DuarteSantos8/openGym
- License: GNU AGPL-3.0-or-later. **All code-derived rights, notices, source availability, and no-warranty terms must be preserved.**
- Repo build workflow: `.github/workflows/trivalley-opengym-free.yml`
- Build modifications: `patch_opengym.py`
- Deployment validation: `check_dist.py`

## Architecture

GitHub Actions checks out pinned Alex Costa OpenGym, retains its React UI / workouts / scheduling / training progression logic, applies a narrow TriValley branding patch, compiles `VITE_DEMO=1` without a backend, runs original frontend tests, adds offline caching, and outputs a static ZIP suitable for **Wix Headless**.

There is **no new paid hosting**, AI inference, account system, third-party workout image licensing, cloud database, or enrollment charge. This real OpenGym build runs as a guest-mode local-first app. AI Coach UI in this static build is a fixture demonstration and must not be misrepresented as live coaching.

## Rights and safety

- DAREBEE graphics and programs are not used. DAREBEE's license does not authorize redistribution in third-party apps.
- Third-party exercise photos/GIFs from the upstream exercise dataset are removed. Reviewed exact-ID Nick likeness illustrations are mapped only to their matching catalogue movements; remaining entries retain written guidance. Counts and current verified release receipts are in `artwork-progress.json`. Generated illustrations are not recorded demonstrations or qualified human movement approval.
- Exercise names/instructions/data from the upstream data project have their own licenses and attribution; the upstream NOTICE must be consulted for each added use.
- The original OpenGym license and copyright notices remain valid. The modification script and the full pinned upstream source together provide reproducible corresponding source.
- All saved client workouts stay on that browser device. Clearing browser data can erase them; export a JSON backup regularly.

## Wix deployment target

Reuse only the existing companion site `d32a63dd-3244-4033-b1ac-7b1bfeab6651`. Its served URL is https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com. Preserve the main business website https://www.trivalley.fit/, its $497 checkout and all client data.

Read the current Wix static publishing instructions before every publication. Use the verified path-preserving `wix.headless.files.patch` route with literal site-relative paths. Do **not** use the legacy uploader that flattens nested files.

1. Require all existing hosted acceptance jobs to pass for the exact source and artifact.
2. Derive a frontend-only ZIP from that artifact, preserving every included byte. Exclude all seven CURRENT coaching files: `coach-login.html`, `coach-client.html`, `coach-login-client.mjs`, `coach-client.mjs`, `coach-login-wix.mjs`, `coach-offline-queue.mjs`, `coach-offline-backup.mjs`. Never restore them from stale build archives.
3. Guard the current native revision and release identity. Capture the seven current file hashes, calculate the merged native inventory against the 20 MiB total limit, and recheck the revision immediately before patching.
4. If cleanup is needed, durably archive and verify rollback bytes against current native files first. Remove only proven obsolete bundle paths that are outside incoming, current and previous bundle families and are not referenced by retained files. Never blindly delete assets.
5. Verify all saved frontend bytes against the tested artifact and all seven coaching files against their current pre-publication hashes. Then require the existing final live browser acceptance to pass before marking new IDs live.

## Acceptance and audit evidence

Use current `artwork-progress.json`, `tv-release.json`, the exact batch receipt and hosted/live run IDs as the source of truth. A checked box or old README is not current deployment evidence. Keep failed and passing attempts, and preserve the owner's version-guarded private resume history. Append a completed batch to ledger history before claiming the next genuinely queued IDs.

Automated Chromium/WebKit, accessibility, logging, recovery and offline checks are required. Physical iPhone Safari, VoiceOver, Home Screen installation, iOS Files backup/restore and qualified human movement approval remain unverified until separately observed. Automated WebKit does not establish physical iPhone acceptance.
