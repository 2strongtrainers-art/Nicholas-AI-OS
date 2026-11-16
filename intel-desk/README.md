# TriValley Global Intelligence Desk

Read-only public intelligence research app in Nicholas-AI-OS, with zero added subscriptions or paid APIs. Actual live status must be supported by a successful GitHub Actions deployment receipt.

## Public data integrations
- GDELT DOC 2.0: four 48-hour topical indexed-news searches. This source returned HTTP 429 on Nov 16, 2026; the app shows errors rather than false freshness.
- GDELT 2.0 bulk: latest public 15-minute CAMEO-coded event file from https://data.gdeltproject.org/gdeltv2/lastupdate.txt . Coded incidents are unverified, not an observation of a confirmed attack, and are never mapped by inferred coordinates.
- Federal Reserve, State Department, CISA, EIA: official announcements from public RSS feeds. If unavailable, the source-health panel says so.
- USGS and NASA EONET: agency-curated earthquake and natural-event points with source URLs. Event point does not mean impact footprint.
- World Monitor, Liveuamap, ACLED and Bellingcat: external investigative reference links, not scraped or redistributed content. World Monitor is AGPL-3.0; no World Monitor hosted API is claimed.

## Analyst method
Cross-topic headline overlap is marked CANDIDATE_ONLY and only flagged if at least two publisher domains and two topics mention the same location in a 48-hour window. Correlation does not prove coordination or causation. The app never executes brokerage trades, uploads client evidence, makes paid API calls, or asserts classified access.

## Free hosting and one-time owner activation
Primary: GitHub Pages for this PUBLIC repository. GitHub Pages was disabled during the first run but on November 16, 2026 the owner supplied screenshots showing "GitHub Pages source saved" and **Build and deployment > Source > GitHub Actions**. That is configuration evidence, not yet a deployment-success receipt.

Owner-side setting has been saved. The application still requires a new successful GitHub Actions Pages publish and independent live HTTP verification; no new cost or token needs to be shared.

Scheduled workflow: .github/workflows/global-intel-desk.yml . Every three hours, tests and fresh data ingestion run and a source-evidence JSON artifact is saved for 7 days. If Pages is not enabled in GitHub Actions mode, publication is explicitly skipped without a failing scheduled job. Once the owner enables Pages, the same job publishes automatically on the next cycle; a manual workflow dispatch can accelerate verification. GitHub Actions schedules may be delayed.

EXPECTED public URL, not operational until independently verified: https://2strongtrainers-art.github.io/Nicholas-AI-OS/

Cloudflare alternative: .github/workflows/global-intel-cloudflare.yml is MANUAL ONLY. The existing scoped Cloudflare token was available but refused permission to create the new separate Worker. The app was not published there. Keep scoped tokens separate; do not broaden ARGUS permissions or paste credentials into chat.

## Validation
- Python: python -m unittest discover -s tests -p 'test_intel_desk.py'
- JavaScript: node --check intel-desk/app.js
- Hosting acceptance: observed success from Pages deployment, current normalized JSON, nonempty real events, feed status reported honestly, and browser verification.
- n8n: workflows/n8n/global-intel-readonly-handoff.json remains INACTIVE, a manual import only, and needs an authenticated hosted execution receipt; Chief has NOT acknowledged an n8n run. Canonical staff review issue: https://github.com/2strongtrainers-art/Nicholas-AI-OS/issues/170 .

Data documentation: https://www.gdeltproject.org/ ; https://www.federalreserve.gov/feeds/feeds.htm ; https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php ; https://eonet.gsfc.nasa.gov/docs/v3 . Map tiles © OpenStreetMap contributors; Leaflet is BSD-2-Clause.
