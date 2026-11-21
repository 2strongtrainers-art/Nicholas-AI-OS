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
- Third-party exercise photos/GIFs from the upstream exercise dataset are removed. In their place are original, generic positioning visuals. These are *not* exercise-specific technique illustrations.
- Exercise names/instructions/data from the upstream data project have their own licenses and attribution; the upstream NOTICE must be consulted for each added use.
- The original OpenGym license and copyright notices remain valid. The modification script and the full pinned upstream source together provide reproducible corresponding source.
- All saved client workouts stay on that browser device. Clearing browser data can erase them; export a JSON backup regularly.

## Wix deployment target

Reuse existing separate site `d32a63dd-3244-4033-b1ac-7b1bfeab6651` with the connected Wix Headless file uploader once the GitHub build artifact is successfully generated and accepted. Its existing publicly served URL is https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com. Do not change the established website https://www.trivalley.fit/ or its coaching/Stripe flows.

## Acceptance gates

- [ ] Workflow successfully clones and builds the pinned actual OpenGym source.
- [ ] Original OpenGym frontend tests pass.
- [ ] GitHub artifact ZIP downloaded/handed to Wix.
- [ ] Wix release replacement confirmed by upload receipt and read-back.
- [ ] Live TriValley OpenGym UI actually loads/records workouts.
- [ ] Physical iOS installation and offline workout logging verified.

**Do not call this fully deployed until the Wix deployment receipt and live checks are observed.**
