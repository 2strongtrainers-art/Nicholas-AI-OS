# Youth Academy v2 — Technical release and safety review status

Date: 2026-11-17 Pacific Time | Status: OWNER-REVIEW CANDIDATE ONLY
Deployment: NO LIVE WIX CHANGES / NO PAID ENROLLMENT / NO CHILD DATA

## Private deliverables
The owner's Library folder /TriValley/Youth Academy/ holds the static owner preview, 72 age-adapted coach lesson scripts (6 timed segments each), 36 original movement activities, a 79-page coach PDF, a 16-page editable safeguarding/operations packet, QA reports and screenshots. Do not copy private coach lessons or child/guardian records into this public repo.

## Verification
- 12 weeks x sessions A/B x 3 age tracks = 72 unique scripts with complete activities and variation/safety cues.
- Track durations sum to 45 minutes Explorers, 55 minutes Builders, and 60 minutes Connectors.
- Chromium synthetic DOM QA at 1440x900, 390x844, 320x740: 12 weeks, 36 activity cards, 13 pending gates, working week-12 selection and movement search, no JS page errors, no horizontal overflow, no outbound network requests.
- No forms, accounts, analytics, checkout, payments, child records, API secrets, or live Wix modification.
- Limitation: sandbox blocked local-file and localhost browser navigation. Synthetic inline DOM QA is NOT an actual hosted URL or real iPhone/Safari acceptance receipt.

## Safeguarding
All 13 launch gates remain PENDING. External California law/mandatory-reporting, insurance, venue, CPR/AED and child supervision, concussion/sudden cardiac arrest, privacy/COPPA, guardian forms, accessible lessons, adult-only rehearsals and owner approval are required as applicable. No claim of third-party approval or legal/medical advice.

## Release process
The owner explicitly requests visual review before publishing. Do not publish from this PR. Do not expose the 72 coach scripts on a public-facing page; prepare separate parent-safe copy and secure coach access when privacy architecture is reviewed. Preserve all adult-coaching Wix and payment paths. Keep draft PR #190 and P0 issue #189 open until evidence-based signoff. Chief review should challenge product quality and proof without impersonating any real expert.