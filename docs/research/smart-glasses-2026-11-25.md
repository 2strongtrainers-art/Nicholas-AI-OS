# Smart glasses: display, iPhone and source-code research

Research date: November 25, 2026, Pacific. Prices are US dollars before sales tax. Stock and promotions can change. This is a dated research record, not a deployment or hardware acceptance receipt.

## Decision

For low-cost text in the lenses, RayNeo iO is the strongest sale candidate found: the official store lists $389 for the glasses and $428 with the portable battery charging case. Direct store cart requests for the exact product variant and quantity one verified RAYNEO5 stacking with automatic savings: $349.55 standard or $366.60 with the portable charging case. The case therefore adds $17.05. It has live captions, notes, conversation summaries and an iPhone companion app. It has no camera or playback speakers. Public iO SDK access is announced for December; do not pay today assuming that future release is already available. Unofficial iPhone apps exist but their supported firmware and ongoing reliability are separate questions.

For building a conversation assistant today, Even Realities G2 has the strongest fit among the inspected projects. Its official Even Hub templates and the community Helix conversation project provide a concrete development starting point. Frames start at $599; the Black Friday promotion discounts accessories, rather than reducing the base glasses price. G2 has no camera or playback speakers. The optional R1 ring is not required for the initial software prototype.

For camera capture and text together, Meta Ray-Ban Display is $799. Rokid RV101 is a lower-cost alternative, but it is the original generation; the recently announced Glasses 2 global release is expected at CES 2027. Do not describe RV101 as the newest announced Rokid generation, or buy a Chinese import assuming it has the global services.

No inspected device or repository establishes a reliable, fully automatic truth detector. Captioning, model-generated answers and web-grounded claim checks are different capabilities. The prototype should display a short evidence cue, its source and uncertainty, with full links and transcripts on the phone.

## Current offers and actual costs

| Product | Observed US offer | What matters for this project |
|---|---:|---|
| RayNeo iO | $349.55 standard or $366.60 with portable charging case; RAYNEO5 plus automatic savings | Dual green text HUD, captions, notes, iPhone; no camera; official public SDK promised for December |
| Halliday G2 | $399, down from $599; automatic November 20–30 offer | Text HUD and Quick Research; six months Basic membership advertised; public SDK not available in inspected official discussion |
| Even G2 | From $599 | Official web-app SDK and useful conversation repos available; Black Friday R1 $179 and clip/pouch $49 are optional extras |
| Rokid Glasses with Display, RV101 | $599 at Wellbots; NEW10 accepted for $589 item subtotal | Camera plus text; original generation; storage case and magnetic cable included, portable charging case extra |
| Meta Ray-Ban Display | From $799 | Color display, camera, captions; excluded from Meta's current Black Friday promotion |
| Brilliant Labs Halo | $399 advertised | Open SDK alternative; low-power optical sensor is not equivalent to a high-resolution workout-video camera; verify delivery and return fees before purchase |

RayNeo browser automation returned contradictory cart results and repeatedly struggled with an unrelated suggested item. Those browser coupon conclusions were superseded by direct store cart requests, using a fresh cookie session for each exact iO variant, quantity one, and explicit item/title/price checks. The store returned RAYNEO5 as applicable in both cases. Standard: $389 minus $20 automatic savings minus $19.45 coupon = $349.55. Battery-case bundle: $428 minus $40 automatic savings minus $21.40 coupon = $366.60. The discount is calculated on the listed sale price, so it is not simply 5% of the already reduced subtotal. No two-pair volume discount is included. `rayneo-http-cart-check.json` is the authoritative observed cart receipt; previous browser reports are retained only to document the discrepancy. Buyer-specific tax, shipping eligibility and final checkout total remain unverified. RN40/RN100 are not needed.

Rokid's older ROK100 coupon was rejected in the November 25 guest checkout; NEW10 was accepted. The site advertises free shipping, but no destination-specific delivery total was verified. An apparent checkout total without an entered address is not treated as the buyer's tax-inclusive price. The product page said shipping in ten days. Wellbots' return terms are less suitable for an open-box trial than a direct-store trial: standard returns require sealed condition, return shipping may be charged, and an open/non-defective item may incur up to 10% restocking.

Halliday's box lists a premium storage case and magnetic charging cable; it does not establish that the included case contains a charging battery. Its free Starter tier and paid Flow credit plans mean hardware price alone does not determine sustained transcription cost. Current promotional text says six months Basic; older conflicting promotional badges should not be used to promise twelve months.

RayNeo advertises six months AI Pro VIP for purchases November 19–30, activation by December 18, and free base prescription lenses November 27–30. The membership is in the RayNeo app, not a standalone ChatGPT subscription. Its product page advertises a 30-day non-prescription trial with free returns and no restocking fee, 30-day price protection and a one-year limited warranty. Read the current policy for your configuration. Its standard storage case and portable battery charging case are different bundles. The official RayNeo AI App Store listing requires iOS 16 or later, so an up-to-date iPhone 14 meets that OS requirement; exact firmware and feature behavior still need physical checks.

Cheap RayNeo GT/Air, XREAL and Rokid Max/AR Spatial listings are principally external displays for movies, gaming or a computer. They do not establish an untethered conversation assistant. An iPhone 14 has Lightning, so USB-C video compatibility cannot be assumed. A cheap camera/audio Meta pair does not gain an in-lens display through software.

## Owner and forum evidence

Owner reports are anecdotes with unknown sampling and incentives, not failure-rate measurements. Sponsored videos, company AMAs and repeated posts by the same beta tester were not counted as independent consensus.

- **RayNeo iO:** owners praise comfort, readable indoor text, voice memos and useful summaries. Other owners report weak summaries, translation that works better on video than in real environments, poor vendor communication and uncertainty over developer access. One owner could export individual transcripts but wanted bulk export; another commenter said all data can be exported in Settings. The currently observed iPhone release 1.0.30 explicitly adds Life Log sharing and export, while earlier notes describe text copying and web search in Live Cues/Fact cards. This is newer evidence than some owner complaints; do not present the older complaints as proof that export is still absent. Bulk, timestamp-preserving export and the quality/citations of live answers must nevertheless be demonstrated before they become the basis of an analytics system. A community iPhone TestFlight app renders text through the built-in caption page; its author warns that later firmware can break it.
- **Halliday G2:** reports praise the display and controlled-condition transcription, while others describe touch-control friction, reactive assistance and service-availability errors in Meeting Flow. Its own staff said an SDK was planned and external third-party AI access was not currently supported. A lower hardware price does not solve that integration gap.
- **Rokid:** hands-on coverage praises comfort, a bright HUD and its camera/audio combination. The iOS review describes app/background and permission friction. Owners discuss display reflections and an updated HUD that still requires the screen to be active. These reports concern particular firmware/model versions; they cannot be applied automatically to Glasses 2.
- **Even:** current reviews acknowledge the useful conversation display but also control and software limitations. It is recommended here for the actual SDK/source path, not because every advertised feature has been independently validated.

## Existing repository audit

Inspected `Nicholas-AI-OS` main at `246c4f089a26bbbbbb5a4581e414bf2b9354f62b`, including its 762-path tree, relevant documentation, module registry and overlapping open pull requests. Also inspected the small `argus-prime-forensics` repository. `terrain-environmental-gis` was accessible but was not part of this glasses code audit.

Reusable pieces already present:

| Existing asset | Useful role | Boundary |
|---|---|---|
| `services/ai-switchboard/` | Authenticated routing and provider policy | Source presence does not prove a currently authenticated, deployed glasses endpoint |
| `services/elevenlabs-cloudflare-bridge/src/transcription.ts` | Uploaded-audio transcription and word timestamps | Batch upload, 10 MiB and timeout constraints; not a streaming conversation ASR implementation |
| `.agents/skills/argus-source-verification/` | Evidence labels, provenance and conflicting-source handling | Metadata and model confidence do not independently prove a statement true |
| `scripts/optional_research_runtime.py` | Isolated optional public-web extraction | A crawler is a source collector, not a claim verifier or a glasses driver |
| `scripts/intel_desk_ingest.py` | Source URLs, times and evidence records | Existing feed workflow needs adaptation for conversation claims |
| `services/osint-forensics/` | File hashes and media provenance checks | Does not turn image metadata into proof of scene/content truth |

No inspected owned source provided a complete glasses microphone-to-iPhone-to-sourced-answer-to-display application. Existing services should be reused behind a device adapter, without creating a second canonical tool router or exposing private transcripts in this public repository.

## Acquired source snapshots

`sources.lock.json` records exact commits, archive hashes, sizes, upstream licenses and acquisition status. Original archives retain their upstream licenses. Acquisition is downloading source, not forking upstream, installing applications, activating bundled skills, enabling billing or confirming device compatibility.

| Repository | License | Practical use and limits |
|---|---|---|
| [even-realities/evenhub-templates](https://github.com/even-realities/evenhub-templates) | MIT | Official minimal, text-heavy, image and microphone templates. Best first build. ASR provider is an explicit unimplemented stub. |
| [even-realities/everything-evenhub](https://github.com/even-realities/everything-evenhub) | MIT | SDK development references and tools. Bundled agent skills were acquired as source and were not installed or activated. |
| [even-realities/enterprise_sdk](https://github.com/even-realities/enterprise_sdk) | Apache-2.0 | Reference for a later enterprise route. Alpha access, application, license and enterprise firmware gates remain; not the consumer quick start. |
| [Mentra-Community/Mentra-Bluetooth-SDK-Starter-Kit](https://github.com/Mentra-Community/Mentra-Bluetooth-SDK-Starter-Kit) | Apache-2.0 | Native iOS/Android BLE starter; useful alternative adapter. Platform support still needs hardware checks. |
| [FJiangArthur/Even-G2-Intelligence](https://github.com/FJiangArthur/Even-G2-Intelligence) | MIT | Helix: conversation orchestration, captions, opt-in web checks, sources and Markdown export for Even G2. Closest source match to the target. Requires user-selected service keys; calls can cost money. |
| [tntpsu/even-voice-shim](https://github.com/tntpsu/even-voice-shim) | MIT | Voice transport/reference glue; inspect dependencies and intended host before use. |
| [r4stl1n/even-realities-app-template](https://github.com/r4stl1n/even-realities-app-template) | MIT | Native iOS BLE and speech template; requires Xcode/signing/device acceptance. |
| [Klayertan/rokid-lyrics-ios](https://github.com/Klayertan/rokid-lyrics-ios) | MIT | iPhone text-display reference. Proprietary vendor framework must be obtained separately under its own terms; the open project does not relicense it. |
| [brilliantlabsAR/brilliant_sdk](https://github.com/brilliantlabsAR/brilliant_sdk) | BSD-3-Clause | Open Flutter SDK route for Brilliant hardware; verify the exact device and optical/audio capabilities. |
| [meta/meta-wearables-webapp](https://github.com/meta/meta-wearables-webapp) | BSD-3-Clause text inspected | Official web-app development route. GitHub labels the custom license NOASSERTION; full license terms, rather than that metadata label, govern reuse. |
| [hkust-spark/xg-glass-sdk](https://github.com/hkust-spark/xg-glass-sdk) | Apache-2.0 | Cross-device adapter reference; do not infer all devices expose the same camera, audio or display capabilities. |
| [Tobi1chi/OpenRayneo](https://github.com/Tobi1chi/OpenRayneo) | Apache-2.0 | Unofficial iO macOS/Android bridge, notifications, captions and recording reference. No iPhone client; macOS 15/Apple Silicon and Android 13 requirements matter. |

Read-only references deliberately not included in the reusable source set: unlicensed `Jackmin801/even-g2-fact-checker` and `Thepizzapie/OpenEvenSdk`; large duplicate MentraOS core; Meta's native SDK governed by developer terms; GPL/AGPL alternatives requiring a different distribution plan; PolyForm Noncommercial RayNeo projects whose scope/rights do not fit a general commercial coaching integration. Firmware flashing, patched vendor apps and downloaded IPA/APK packages were not performed or installed.

Helix's inspected code has actual web-search routing and citation parsing, rather than merely asking a language model whether a claim is true. Its README explicitly states that several non-OpenAI providers were tested with mocked responses, not live keys. No live provider, microphone, phone, glasses or end-to-end Helix session was validated in this research. A claimed citation can still be weak, irrelevant or incorrectly interpreted; human review and uncertainty remain necessary.

## Validation and next implementation

- Official Even minimal template: installed dependencies with lifecycle scripts disabled; `npm run build` passed TypeScript checking and Vite production bundling. This confirms a software scaffold builds in the Linux workspace. It does not confirm iOS Bluetooth, microphone, app backgrounding, firmware or physical display behavior.
- Source archives: SHA-256 and archive metadata recorded; original archives are retained unchanged. No acquired agent skills were activated.
- No real API keys, paid model requests, outbound messages, runtime deployment or hardware purchase were used.

First implementation should be an owner-controlled, manually started session: microphone or phone capture → streaming ASR → claim selection → retrieved evidence → a short display cue. Keep full source links and an exportable transcript on the phone. Preserve timestamps, model/version, claim text, citations and uncertainty. Never log provider keys or publish recordings/transcripts to this public repository. Existing paid-AI and outbound kill switches remain unchanged.

Physical acceptance should demonstrate: iPhone 14 pairing; text readability/fit; two-speaker transcription in a quiet room and a gym; foreground/background and locked-phone behavior; elapsed claim-to-card latency; cited sources opening on the phone; timestamp-preserving export, deletion and reconnection; sustained battery during actual capture rather than standby. Until these pass, describe this as acquired source and a buildable starting point, not a working personal glasses assistant.

## Primary evidence and owner threads

- [RayNeo AI iOS app](https://apps.apple.com/us/app/rayneo-ai/id6757910500), [RayNeo iO product and trial](https://www.rayneo.com/products/rayneo-io-ai-glasses), [Black Friday store](https://www.rayneo.com/pages/black-friday), [November 18 manufacturer announcement](https://www.prnewswire.com/news-releases/rayneo-finishes-2026-strong-unveils-black-friday-deals-across-smart-glasses-portfolio-announces-rayneo-io-navigation-updates-and-debuts-call-of-duty-modern-warfare-4-limited-edition-302943549.html).
- [RayNeo owner discussion: exports, summaries and development](https://www.reddit.com/r/RayNeo/comments/1xn9fkd/initial_feedback_on_the_rayneo_iobig_fan_so_far/), [translation in actual travel](https://www.reddit.com/r/RayNeo/comments/1xdfcrj/how_well_do_translation_and_notetaking_work_on/), [unofficial iPhone caption-page app and firmware caveat](https://www.reddit.com/r/RayNeo/comments/1xuhnwm/glasses_hub_a_dashboard_and_mini_apps_for_rayneo/).
- [Halliday current offer](https://www.hallidayglobal.com/products/halliday-g2), [plans](https://www.hallidayglobal.com/), [official staff AMA](https://www.reddit.com/r/SmartGlasses/comments/1w9xhey/halliday_g2_meet_the_team_join_the_conversation/).
- [Even offer terms](https://www.evenrealities.com/holiday-season-2026), [G2 store](https://www.evenrealities.com/en-US/products/g2-a), [Conversate](https://support.evenrealities.com/hc/en-us/articles/14273795154319-Conversate), [Even Hub](https://hub.evenrealities.com/docs/get-started/overview).
- [Wellbots exact RV101 listing](https://www.wellbots.com/products/rokid-glasses-display-smart-glasses), [older Slickdeals coupon discussion](https://slickdeals.net/f/20202312-rokid-glasses-display-smart-glasses-599-free-shipping), [iOS hands-on review](https://www.tomsguide.com/computing/smart-glasses/rokid-glasses-review), [new-generation availability reporting](https://www.wareable.com/wearable-tech/rokid-glasses-2-color-ring-announcement-international-availability).
- [Meta sale exclusions](https://www.meta.com/blog/save-big-with-black-friday-and-cyber-monday-deals-on-our-ai-glasses-and-meta-quest-3s/), [Meta Display](https://www.meta.com/ai-glasses/meta-ray-ban-display/), [Brilliant Halo](https://brilliant.xyz/products/halo).

The search covered manufacturers, retailers, coupon/deal forums, owner discussions, professional hands-on reviews and public source repositories. It cannot establish an exhaustive lowest price across every seller on the Internet. Suspicious or wrong-model marketplace prices were not treated as equivalent offers.
