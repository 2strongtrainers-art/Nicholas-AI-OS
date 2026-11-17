# TriValley.fit Content Studio V5 — Owner-private production integration

Status: reviewed design and stageable CLI integration. Not published and not end-to-end verified.

The public Content Studio and its 30-day campaign live in intel-desk/content-studio (PR #185). This stage adds a deterministic private production-job adapter. It does not create another social publisher or scheduled agent.

Existing code to use:
- Video Wizard native adaptation: docs/video-wizard-adaptation.md; clips are scored ONLY after real timestamped footage exists. Never invent rankings, watch times or source clips.
- Pinned MoneyPrinterTurbo sidecar: docs/moneyprinter-fast-reel.md; use supplied authentic media, with existing OpenMontage fallback.
- Existing local / cloud renderers: scripts/render_trivalley_reel.py and scripts/render_trivalley_lesson.py.
- Existing owner-gated n8n Reel review queue, not a second public webhook.

Brand is Nick Style 3: the official Celtic Trinity knot logo, navy / antique gold / white and the motto We rise by lifting others. Keep user photographs, voice master IDs, signed URLs, credentials and private media outside this public repository.

Voice: August Nick exists in the connected ElevenLabs catalog. Do not mistake catalog verification for a usable narration track; attach a successful audio master privately before rendering and synchronizing captions. The November 17 single new speech generation attempt did not complete.

First-week film-gates: 11/17 squat front and side; 11/19 boxing guard/reset plus step-slide; 11/20 low-impact strength movement demonstrated by Nick; 11/22 authentic assessment-process footage. Carousel and protein-story days do not require human footage. Film vertical 9:16 with unobstructed full reps; obtain permissions for any client and gym visitor.

Run with the owner's LOCAL and already-reviewed Content Studio V2 JSON, not with private files committed to GitHub:
python scripts/trivalley_content_to_producer.py /private/studio-v2.json /private/review-queue --days 7

No API calls, generation, social posting, publishing auth, clients or account analytics are accessed by this command. Each output remains awaiting human review, with no clip score or fake social data.

Actual Instagram/Facebook/YouTube profiles were not verified via public evidence; do not invent handles. Evaluate Instagram saves / hook hold, Facebook meaningful inquiries / completed views, YouTube Shorts viewed percentage. Capture actual post URLs, 48h and 7-day metrics before claiming growth.

Live site for private / hybrid coaching: https://www.trivalley.fit/coaching (application before optional $297 assessment). Preserve $497/month online checkout separately. Publishing stays disabled until owner review, an authenticated destination and a verified provider receipt.