# TriValley video production runbook

**Owner:** Nick Kaplan  
**Operators:** AI Chief of Staff and Muse  
**Verified reference production:** *NVDA: Follow the Filings*, November 13, 2026  
**Status:** A demonstrated production method and portable operating specification. Repository integration, configuration, and unattended execution must be verified separately.

Start with [the Muse handoff](MUSE_VIDEO_HANDOFF.md); use [the fitness playbook](FITNESS_VIDEO_PLAYBOOK.md) for coaching content.

## 1. What this workflow produces

Produce a finished, phone-playable vertical MP4 using Nick's approved portrait, his existing **August Nick** voice, a short synchronized talking-avatar segment, truthful source visuals, readable captions, and restrained music. Deliver the actual MP4 with subtitles, a poster, and source notes.

The Chief of Staff maintains the brief, authorization scope, production status, and final delivery record. Muse researches and prepares the story, resolves the approved private assets, builds the media, renders the edit, and reports verification results. Neither should mark a job complete because a script, generation request, canvas, or preview exists. Completion requires the exported file and its checks.

Use the same production method for fitness education, coaching explanations, product walkthroughs, and business updates. Change the story and evidence to suit the subject; an investigative stock-market tone is not a requirement for every fitness video.

## 2. What the reference production actually proved

| Component | Observed result |
|---|---|
| Finished duration | 120.500 seconds |
| Edit | 26 short shots, generally about 3–6 seconds, with a brief brand ending |
| Picture | 720 × 1280, 9:16, 24 fps, H.264, `yuv420p` |
| Sound | AAC, 48 kHz, stereo |
| Narration | Existing August Nick voice; 117.969 seconds; no time compression |
| Talking avatar | A 12-second portrait-and-audio generation; 768 × 1024 at 24 fps; the opening approximately 4.96 seconds were used |
| Avatar synchronization | Measured audio offset 0 ms against the original excerpt; normalized waveform correlation approximately 0.999969; visual mouth/head check passed |
| Supporting footage | Two eight-second, 720 × 1280 illustrative clips, reused selectively as cutaways |
| Precise graphics | Six original data-driven chart frames, drawn at 1080 × 1920 and scaled for the final edit |
| Captions | Burned word-timed highlighting, plus a separate SRT |
| Measured final loudness | −17.6 LUFS integrated; 3.7 LU loudness range; −4.1 dB true peak |
| File checks | Full-file decode exit code 0; fast-start layout confirmed |
| Visual checks | A 22-frame contact sheet spanning the edit, including avatar, captions, numbers, sources, B-roll, and ending |
| Final size | Approximately 23.2 MB |

These are results of one completed job, not promised outputs or timing guarantees for another provider, model, or execution environment.

Reference evidence includes the final script, timed transcript, chart manifest, edit manifest, renderer, technical probe, and final validation record. Preserve these types of records for each future job.

## 3. Keep private assets separate from the repository

The repository should hold the runbook, reusable code, configuration examples, validation rules, and public source references. Resolve private assets at runtime.

Required private inputs are:

- **Approved portrait:** Nick's approved default portrait, located through the authorized private asset store. Preserve its identity and appearance.
- **Existing voice:** Search the live ElevenLabs voice catalog for **August Nick** and resolve the correct existing voice. Do not create a replacement voice merely because an old identifier is unavailable.
- **Brand mark:** The approved gold Celtic Trinity logo.
- **Source material:** Only the approved footage, screenshots, client information, and documents needed for this particular video.

Keep portrait originals, private library identifiers, voice identifiers, provider asset/node/run identifiers, signed media URLs, credentials, client records, and private screenshots out of public commits and public logs. Use private runtime configuration or a private asset manifest for their resolution. A short-lived signed URL is a transfer mechanism, not a durable asset reference.

Nick has authorized use of his approved portrait with ElevenLabs for future talking-avatar videos. Carry that existing authorization forward within its recorded scope; do not repeatedly request the same permission. Honor current provider policies and any limits on a particular transfer. A new provider, a different person's likeness, or a materially different use needs its own applicable authorization.

## 4. Preflight: capability and spending checks

Before generation, identify the actual tools, models, regions, input ports, and supported parameters available in the current run.

The reference production used:

| Purpose | Verified route in the reference run |
|---|---|
| Speech | ElevenLabs `eleven_v4`, with the existing August Nick voice resolved from the live catalog |
| Talking portrait | ElevenLabs Creative Studio avatar workflow using `minimax-h3-max-lipsync` |
| Instrumental score | `eleven_music_v2`; a 150-second instrumental was generated and trimmed in the edit |
| Illustrative B-roll | Provider-generated server and wafer clips; the exact model is not retained in this public handoff, so discover and record the effective model for future jobs |
| Graphics and editing | Local Python/Pillow plus FFmpeg; no browser renderer was required |

**Model availability is not established by a remembered name.** Query the live node-type catalog, the effective model schema, and its prompting guide. Relevant capabilities include `creative_get_flow_node_types`, `creative_get_model_schema`, `creative_get_model_guide`, and `creative_list_voices`. Read the tool instructions currently exposed; wrappers, enums, parameter names, region restrictions, and duration limits can change.

OmniHuman was unavailable in the reference run's region. An available MiniMax lip-sync route completed the job. Treat an unavailable model as an unavailable route; select an advertised supported alternative only within the authorized spending and provider constraints.

**Honor the repository's `ALLOW_PAID_AI=false` kill switch.** Do not change it, bypass it, or silently incur generation charges to finish a job. When paid generation is disabled, prepare the brief, script, evidence, graphics, and edit plan; reuse authorized existing media and render locally where possible. Record any missing generation step clearly. Interactive authorization in an earlier production does not establish that an unattended repository job is permitted to spend now.

Confirm local dependencies before starting a long edit: Python, Pillow, FFmpeg with `libx264` and `libass`, FFprobe, and usable fonts. The reference used Python/Pillow, FFmpeg and Noto Sans Display; verify the installed versions and supported filters in the current runtime. Font availability and glyph coverage must be checked in the execution environment.

No working headless Chromium renderer, CapCut bridge, native CapCut export, or unattended publication pipeline was demonstrated by this production. The verified delivery path is the local renderer and standard MP4/subtitle outputs.

## 5. Prepare evidence and script before purchasing media

Create a concise production brief with the intended viewer, one main takeaway, target length, audience action, tone, and evidence cutoff date. Separate verified facts, interpretations, and open questions.

Create a claim ledger before rendering graphics. Each substantive claim should identify its source, units, date or period, and any material scope limitation. For comparisons, name the denominator and use matching periods where appropriate. When periods differ, print them beside the values. Preserve the source data separately from display rounding.

For this reference, scope corrections materially improved the story: a percentage from one trust was not the percentage of all reported holdings; a transaction date was not its filing date; the time a social post appeared was not the time of the trade. Future subjects need the same attention to what a number actually measures.

Write a script with a concrete opening, evidence-led explanation, a useful qualification, and a clear ending. Energetic delivery, suspense, and dry humor can keep attention, but they must not manufacture wrongdoing, guaranteed results, or certainty. Nick remains the presenter; use his voice and identity rather than pretending to be another host.

Review the text before full speech generation. Reuse an already approved voice and delivery direction when authorization covers it. Do not regenerate finished audio without a concrete issue to fix.

## 6. Generate speech first; derive the edit from the audio

The approved narration is the timing master.

### Transcription route and finished-audio validation

Prefer the connected official ElevenLabs Creative tool `creative_transcribe_audio` when it is available. A legacy tool pointing to the retired Replit bridge is not a fallback. The observed retired-host connection failed with an app-not-live HTTP 404; retrying that endpoint cannot validate the audio. More generally, a transport failure does not establish whether an upstream provider accepted a job. Inspect available run evidence before retrying a potentially metered request.

Transcribe the finished narration as audio evidence. Upload or resolve the actual completed audio through the tool's supported private asset mechanism and request word timestamps using the currently advertised speech-recognition model. Do not send a local filesystem path to a remote service as if it were an upload. If transcribing a TTS generation node returns pronunciation notation, the submitted script, or malformed number boundaries, upload the completed audio as a separate asset and run independent recognition without supplying the expected script. Reuse that completed transcription rather than repeatedly buying it.

Keep the recognized spoken words and their raw times. Separately map natural spoken number/currency expansions back to the exact approved script for caption production. Preserve both views and record the mapping method; do not claim normalized script tokens are the provider's verbatim output. Check ordered nonnegative times, end-before-start errors, missing words, and timing beyond the decoded audio duration. Record actual decoded duration separately from container padding. A nonempty transcript without word timing is a failed timing deliverable.

The optional Cloudflare `speech_to_text` route uses the REST Scribe model identifiers documented in its [migration instructions](../services/elevenlabs-cloudflare-bridge/README.md#transcription-migration), which differ from Creative Flow model identifiers. It must be deployed, authenticated, explicitly enabled under the cost policy, present in `tools/list`, and tested with an authorized audio upload before being reported operational.

### Narration sequence

1. Resolve August Nick through the current voice catalog.
2. Generate the approved script once through the authorized speech route. Keep the exact submitted text and the completed audio.
3. Inspect pronunciation of names, numbers, dates, abbreviations, and technical terms. Use expressive delivery instructions only where the selected model supports them.
4. Obtain word-level timestamps from the completed recording. Save the full timed transcript locally; do not build captions from an estimated reading speed.
5. Measure the actual audio duration. Add a short brand ending and build the shot schedule around real spoken sections.

The reference audio contained delivery tags such as `[excited]` in the submitted text and alignment output. Strip those tags from captions while retaining the actual word timings. Do not display or read them as subtitle text.

The reference had approximately 118 seconds of narration and a 120.5-second finished timeline. It was not forced into a shorter target by accelerating speech. If a future narration is too long, revise the script or allow an appropriate longer edit.

Use absolute frame boundaries for every shot:

```python
start_frame = round(start_seconds * fps)
end_frame = round(end_seconds * fps)
shot_frames = end_frame - start_frame
```

This avoids accumulating rounding error across many independently rounded clip durations. Verify that the sum of shot frames equals the intended total.

## 7. Build the talking avatar from the approved portrait and exact audio

Create a connected media flow when outputs will feed other nodes. Keep related nodes on that same flow.

Use the approved portrait as an image reference and an **exact excerpt of the completed narration** as the audio reference. Add or resolve the source assets, place them as asset nodes, create a **video-generation** node using the advertised talking-head/lip-sync model, and wire the image and audio to its actual required ports. A user-managed `avatar` identity node is a different object: do not create or modify it through generic node tools. Tool capabilities for this include `creative_create_flow`, `creative_add_flow_asset_node`, and `creative_connect_flow_nodes`. Use supported reference attachment only when a private input must be transferred and that transfer is authorized.

Reference media belong on model input ports. Do not put image/audio references inside unrelated model-parameter fields or guess port names. Read the current schema and use returned node identifiers within the private runtime record. If a generation tool's static enum lacks a model, use a different advertised supported node path only when its current instructions permit it; do not invent tool arguments.

The reference generated a 12-second avatar from the first 12 seconds of the final audio, then used its first approximately 4.96 seconds in the opening. This provided a human introduction while leaving the remainder of the video for evidence and explanation.

Check the completed avatar before editing it in:

- Compare its appearance to the approved portrait and inspect the eyes, mouth, head movement, hands, and background.
- Inspect phoneme/mouth timing at several moments. Compare the generated clip's audio to the original excerpt when available; detect any delay or retiming instead of assuming synchronization.
- Use only the portion that corresponds to the same words and time interval in the final narration.
- Mute the avatar clip's audio in the final composition. Keep the original approved narration as the one continuous voice track.
- Label the synthetic presenter quietly as **AI avatar**.

The reference clip's near-identical audio and zero measured offset support that specific edit. Recheck future clips. A reusable portrait and voice do not make a previously spoken avatar video suitable for different words: generate a new lip-sync clip from the new approved audio.

Follow the provider's current completion mechanism for a started generation. Reuse its returned run; do not submit the same generation again because a response is still pending. Multiple submissions can create duplicate paid work.

## 8. Create source visuals and B-roll for the explanation

Use exact drawing tools for quantities, comparisons, charts, checklists, and diagrams. The reference graphics were rendered programmatically with Pillow, using the verified JSON values, and delivered as 1080 × 1920 PNGs. Their manifest retained input hashes, source links, caveats, dimensions, and caption bounds.

For the market reference, the six graphics covered proceeds, denominator choice, sold/remaining shares, trading-plan disclosures, chronology, and verified versus unresolved points. That list is an example, not a template every fitness story must follow. Select the smallest set of visuals that makes the current explanation understandable.

Preserve authentic source screenshots as evidence and use selective crops or punch-ins. Clearly distinguish original evidence from newly drawn explanation. Keep the scope visible when a large headline number would otherwise be misunderstood.

Use B-roll for atmosphere, context, transitions, and short humor beats. The reference used two eight-second illustrative clips at several points. Label generated footage **AI illustration**; do not present it as footage of an actual facility, client, event, or result.

Keep assets local after authorized retrieval. Record their source, permitted use, effective generation model when known, and whether they are real footage, illustration, or exact graphics. Do not regenerate useful media simply to fill every second with something new.

## 9. Preserve the TriValley visual system

| Element | Reference setting |
|---|---|
| Background | Deep navy `#08131F` |
| Panels | `#102334` |
| Gold | `#E4BD75` |
| Teal | `#51D6C1` |
| Main text | `#F5F7FA` |
| Secondary text | `#A9BCCB` |
| Logo | Approved gold Celtic Trinity mark |
| Typography | Noto Sans Display regular/bold, or a verified readable equivalent |
| Market masthead | `TRIVALLEY MARKET DESK` |
| Fitness masthead | Use approved TriValley.fit branding appropriate to the brief |

Use one clear point per screen, large numerals, short labels, and consistent spacing. Keep the gold/teal identity premium and restrained. Give proof more screen space than decoration.

Reference layout at **1080 × 1920**:

- Main graphic content roughly y365–1370.
- Caption reservation x72–1008, y1430–1670.
- Source footer beginning around y1750.

The **720 × 1280** edit scaled those graphics proportionally. Its final caption backdrop occupied x30–690 and y953–1125, with sources below about y1167. These are production coordinates, not an assurance that every platform's interface is clear of the text. Check the actual intended posting surface when preparing publication.

## 10. Assemble short shots with restrained motion

Use a shot manifest: start/end times, frame count, source, source offset, visual treatment, caption-safe region, and editorial purpose.

The reference alternated a synchronized avatar opening, source screenshots, precise charts, illustrative B-roll, an original chart, a local still portrait for the close, and a brand ending. It used hard cuts, small Ken Burns movements, short card reveals, and bold callouts. There were 26 shots; a few were shorter than three seconds for a transition or the ending.

Avoid lip-sync mismatches when reusing media. The reference close used the approved still portrait, rather than applying opening lip movements to closing narration.

For static visuals, the renderer used a subtle approximately 1.8% zoom over a shot. Keep chart labels, captions, and source footers inside the visible area throughout the movement.

**Use optimized FFmpeg transitions.** The initial per-pixel `blend=all_expr` reveal was an actual performance bottleneck. It was replaced with:

```text
xfade=transition=fade:duration=0.55:offset=0
```

The transition ran between a card-masked initial image and the completed graphic. Normalize input dimensions, frame rate, and time base before compositing. Keep exact values fixed; the animation reveals the graphic rather than changing its underlying facts.

Render reusable short segments, then concatenate and perform the final caption/audio pass. Two segment workers with restrained FFmpeg thread counts worked in the reference. Preserve completed clips after a failure; only rerender clips whose assets, settings, or content changed. For a portable implementation, cache validity should include an input/configuration fingerprint and expected frames, not frame count alone.

## 11. Build captions from actual word times

Produce both an SRT and the burned caption track. Keep the caption wording identical to the final spoken content, excluding delivery tags and non-speech metadata.

The reference grouped up to approximately six words or 43 characters per phrase, also splitting on punctuation and timing. Longer phrases were balanced over two lines. The current word changed to gold while the phrase kept its position. At 720 pixels wide, approximately 41-pixel bold text remained readable above a dark translucent backdrop.

Use one fixed caption layout per phrase so words do not jump as highlighting changes. Check long numbers, proper names, punctuation, and line wrapping. Escape subtitle control characters safely. The picture can cut underneath a phrase while its timestamps remain tied to the original audio.

The reference used FFmpeg/libass for the burned track. Browser-based caption rendering was not needed.

## 12. Mix speech, music, and accents

The narration must remain understandable on a phone speaker. Normalize and limit it; do not just add gain to already high peaks.

Reference mixing settings were:

- Narration: FFmpeg `loudnorm` target −16 LUFS, true-peak target −1.5 dB, LRA target 7; resampled to 48 kHz.
- Instrumental: normalized around −27 LUFS before additional level adjustment, faded in, and faded out with the ending.
- Ducking: the narration controlled a sidechain compressor on the score, with a short attack and approximately 350 ms release.
- Accent: one quiet, locally synthesized bell at the scrutiny transition. This was an editorial accent, not an alarm or a suggestion of guilt.
- Final sum: limiter applied before AAC encoding.

Measure the encoded file rather than assuming the filter targets became the final result. The completed reference measured −17.6 LUFS with a −4.1 dB true peak and was accepted for clear speech and adequate headroom. Do not rerender an otherwise good mix merely to force an exact target when the measured result is appropriate.

Keep a short music-supported brand ending after the narration. Never use the avatar's duplicate audio alongside the original voice track.

## 13. Export and verify the actual deliverable

The verified export settings are a practical mobile default:

```text
Container: MP4
Video: H.264 / libx264, yuv420p, 720x1280, 24 fps
Reference encoding: fast preset, CRF 19, GOP 48
Audio: AAC, 192 kb/s, 48 kHz, stereo
Layout: +faststart
```

Higher resolution can be used when source quality and rendering capacity justify it. Do not claim that upscaling adds detail that was never present.

Perform these concrete checks:

1. **Probe the finished file.** Confirm codec, dimensions, pixel format, frame rate, duration, audio sample rate/channels, and a plausible nonzero file size.
2. **Decode the complete file.** Require a clean exit, not merely a playable first frame.
3. **Check fast start.** Confirm the MP4's metadata permits prompt streaming playback.
4. **Measure final loudness and true peak.** Check speech clarity and music balance by listening as well.
5. **Inspect representative rendered frames.** Include the avatar, longest captions, dense data, screenshots, B-roll labels, transitions, source footer, and ending. The reference reviewed 22 sampled frames.
6. **Review factual and editorial scope.** Numbers, labels, dates, denominators, source attribution, and uncertainty must survive the visual edit.

Useful local commands, with job-relative filenames:

```bash
ffprobe -v error -show_streams -show_format -of json output/final.mp4
ffmpeg -v error -i output/final.mp4 -f null -
ffmpeg -i output/final.mp4 -filter_complex ebur128=peak=true -f null -
```

Stop optional testing once the material checks pass. Correct a concrete defect, rerender its affected segment, and recheck the final output when needed.

## 14. Deliver, record status, and preserve a reusable job

Deliver the MP4 first, then the optional SRT, source/notes document, and poster. Provide a concise account of what is included, what was verified, and any real limitation. Upload or publish only through the authorized destination; an export is not evidence that a social post was published.

Maintain a private job package containing the script, transcript, original narration, approved private references, media provenance, graphics/data, edit manifest, segment cache, source notes, renderer version, poster, contact sheet, and final validation record. Keep public repository content separate from that private package.

Use honest status labels such as **prepared**, **awaiting authorized generation**, **generating**, **rendering**, **verifying**, and **delivered**. Store a recoverable checkpoint before a long generation or render. Give progress updates that report completed work and the actual remaining step.

## 15. Fitness adaptation requirements

Use the approved talking avatar for introductions, explanations, coaching principles, summaries, and transitions. For exercise technique or form demonstrations, use real, authorized footage of the movement with angles that make the relevant mechanics visible. Have a qualified reviewer check the demonstration and its narration together.

Generated gym atmosphere may serve as labeled illustration. It should not establish that a person performed a particular movement correctly, that a client achieved a result, or that a technique is safe for an individual. Do not invent credentials, testimonials, before-and-after outcomes, medical conclusions, or guaranteed transformations.

Keep educational explanations within the brief, cite substantive claims, state the intended audience, and avoid converting a general production workflow into an individualized fitness prescription. Client likenesses and personal details require their applicable permission and approved sharing scope.

## 16. Actual lessons from the reference run

| What happened | Operating lesson |
|---|---|
| A preferred avatar route was unavailable in the region | Discover live availability and use an authorized supported model; do not build the runbook around a single assumed model |
| The portrait transfer needed explicit scope confirmation | Preserve the resulting authorization privately and reuse it for the same scope; honor provider enforcement |
| Expensive media was already complete before the final render | Reuse approved assets; separate generation failures from rendering failures |
| Per-pixel `all_expr` blending stalled chart shots | Use optimized `xfade`, retain completed clips, and resume selectively |
| A multiline ad-hoc code edit caused a syntax error | Apply structured patches, compile/check before launching, and avoid accidentally starting an unmodified long render after a failed edit |
| A font lacked a needed arrow glyph | Replace with clear words or use a verified glyph-capable font; inspect the rendered result |
| One footer blurred a transaction date with a filing date | Label the two dates explicitly and rerender only the affected shot |
| The raw renderer contained job-specific paths and narrative assets | Parameterize paths, private asset resolution, branding, dates, durations, sources, and shot definitions before calling it a reusable headless product |
| The original avatar audio matched the narration excerpt precisely | Preserve that exact timing and mute duplicate audio; verify future generations independently |
| The rendered mix differed from its loudness filter target | Trust the final measurement and listening result rather than an assumed target |

The reusable advantage is the coordinated process: verified script, speech-led timing, approved identity references, selective talking-avatar footage, precise visuals, recoverable rendering, and a checked final MP4. Repository documentation alone does not deploy an always-on producer; the Chief of Staff should report unattended generation and delivery as operational only after an authorized end-to-end run succeeds in that environment.
