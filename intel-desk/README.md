# TriValley Global Intelligence Desk

A separate, read-only intelligence dashboard for **personal research** in Nicholas-AI-OS. It uses source-indexed public metadata only. No paid API keys, brokerage credentials, image uploads, generative models or unrestricted scraping are required.

## Data sources
- **GDELT DOC 2.0:** public media reports from four themed searches (Security, Geopolitics, Energy, Economy). An indexed headline is **not** a verified incident. Articles are linked to their original publishers; no article bodies are copied.
- **USGS M4.5+ (past seven days):** earthquake catalog points, attributed to USGS. Parameters may be revised.
- **NASA EONET v3:** open natural-event GeoJSON points. Some points are event reference markers, not impact footprints. Polygons are excluded, never guessed into a point.
- **World Monitor:** external reference dashboard. Source at https://github.com/koala73/worldmonitor (AGPL-3.0). No hosted-service API or code is copied into this original app.
- **Liveuamap, ACLED:** external conflict research links. No unauthorized extraction, API use or redistribution.
- **Bellingcat Online Investigation Toolkit:** research-method reference; existing Bellingcat Auto Archiver remains separately pinned in Nicholas-AI-OS. Nothing executes or crawls automatically.

## Analyst logic
Connections are flagged only when a named place appears in headlines from at least two publisher domains and at least two topic streams during the 48h GDELT search. This is a **candidate to investigate**, not proof of a shared operation, economic causal mechanism, verified event location, coordinated attack or independent evidentiary corroboration.

Only NASA/USGS agency-supplied coordinates receive map pins. No financial trades, alert-triggered decisions, client outreach, AI charges or paid service calls are performed.

## Hosting and ingest
- GitHub Actions: .github/workflows/global-intel-desk.yml.
- Standard library Python script: scripts/intel_desk_ingest.py.
- Offline acceptance: python -m unittest discover -s tests -p 'test_intel_desk.py' and node --check intel-desk/app.js.
- At scheduled or manual run, fetch public metadata, refuse to manufacture a fresh empty snapshot when all endpoints fail, and publish the static artifact through GitHub Pages.
- Production URL **only after Pages is enabled and a deployment action succeeds**: https://2strongtrainers-art.github.io/Nicholas-AI-OS/
- Default cadence is every three hours; GitHub schedules may be delayed. Source health and generated UTC timestamp are visible.
- GitHub Pages for this public repo uses the no-cost path, subject to GitHub limits.

## n8n and Chief handoff
workflows/n8n/global-intel-readonly-handoff.json is an **inactive manual import**. It retrieves only the deployed JSON snapshot, checks freshness/schema/source coverage, and returns one metadata-only review packet. It does not modify a current n8n Cloud workflow or claim Chief acknowledgment. Import into the approved n8n project only after inspecting active workflows, permissions, quota and dedupe under issue #170. Do not create a competing production polling schedule. Send approved evidence to the Chief only through the existing private reviewed handoff.

## Acceptance criteria
1. Python offline tests and JavaScript syntax check pass.
2. Scheduled ingestion logs source health and never embeds tokens or private data.
3. The published artifact has current UTC generated_at, real source records, and visible coverage status.
4. Page is reachable without login, and interactive filters and map work.
5. At least two source classes independently confirm live ingestion, otherwise classify coverage degraded.
6. A n8n hosted execution ID and Chief acknowledgment are collected before claiming fully meshed automation.
7. Rollback: disable the new schedule or revert this feature; existing ARGUS, Hermes, Market Desk, coaching and site remain untouched.

Data docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/ ; https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php ; https://eonet.gsfc.nasa.gov/docs/v3 . Map tiles © OpenStreetMap contributors. Map client Leaflet 1.9.4 (BSD-2-Clause) delivered by CDN; if unavailable, the event wire remains usable.
