# TriValley content production system

**Owner:** Nick Kaplan. **Operators:** Chief of Staff and Muse.  
**Implemented here:** creator preflight, local continuous-narration lesson renderer, caption/format validation, and reusable brief contracts.  
**External state:** retrieve the current private production receipt. A repository merge does not establish a live provider template, website integration, publication, or audience result.

This extends the [Muse handoff](MUSE_VIDEO_HANDOFF.md), [avatar runbook](AVATAR_VIDEO_WORKFLOW.md), and [fitness playbook](FITNESS_VIDEO_PLAYBOOK.md). The existing short-Reel renderer remains available for its original clip-first contract.

## Reusable briefs

| Template | Evidence | Story | Intended outputs |
|---|---|---|---|
| [Coach Cue](creator-templates/coach-cue.json) | Reviewed coaching point and actual demonstration or exact graphic | Question, cue, example, action | Short MP4, captions, cover, written summary |
| [Myth Check](creator-templates/myth-check.json) | Claim, current source, scope, counterevidence | Claim, evidence, qualification, takeaway | Explainer, alternative hooks, source notes |
| [Inside the Program](creator-templates/inside-program.json) | Current owned product, version/page references, live offer facts | Problem, product view, next step | Walkthrough, teaser, audio companion |

Each brief has a topic, audience, one takeaway, one CTA, reviewed sources, a credit cap and no more than three variations per step. `reviewed: false` means the example is not production-ready; check the actual current source before changing it.

## Identity and performance

Resolve Nick's approved portrait, the exact gold Trinity mark and existing **August Nick** voice from authorized private services. Keep portrait originals, private asset/voice/run IDs, signed media URLs and credentials out of this public repository. Reuse the owner's recorded authorization within its scope.

Save these editorial directions alongside reviewed reference takes:

- **Coach Nick:** warm, direct, encouraging, space between instructions.
- **Market Nick:** energetic opening, clear pauses around numbers, evidence-led conclusions.
- **Explainer Nick:** measured, conversational, easy to follow.
- **Story Nick:** personal and relaxed, with restrained humor.

These are directions, not guaranteed slider settings. Discover each model's current schema before applying controls. A recording can guide Voice Changer or Studio Actor Mode. Runway Act-Two needs an actual driving video plus a reference image; audio-only lip-sync does not establish performance-transfer quality. Use reviewed human footage for exercise technique.

## Capability and budget preflight

Export the live provider node-type catalog privately with an ISO `fetched_at` timestamp and timezone. It must be no more than 24 hours old. Read the selected model's current schema, required inputs, guide and estimate immediately before generation.

```bash
python scripts/trivalley_creator_preflight.py /private/job/brief.json /private/job/capabilities.json
```

The planner checks source review, available models, unique step IDs, variation counts and the estimated credit cap. It makes **zero provider calls**. With `ALLOW_PAID_AI=false`, it returns the local plan and `generation_permitted: false`; it never changes that policy. A runtime allowed to spend must still respect the estimate/cap and record the actual result. Do not use another route to evade a disabled repository policy.

## Production sequence

1. Review the owned source and claims. Product walkthroughs retain actual version and printed page numbers.
2. Save the script and up to three opening hooks. Keep the main lesson and CTA consistent when comparing hooks.
3. Generate the narration and preserve its natural timing. Revise an overlong script or extend the edit; avoid artificial speech acceleration.
4. Obtain actual word timestamps from the final audio, or manually review phrase cues. Word-count estimates are not caption alignment.
5. Generate each avatar shot from its exact corresponding audio. Mute the clip's audio under the continuous narration. Old mouth movements cannot be reused for new words.
6. Prepare actual source-page crops, reviewed footage, exact graphics and approved supporting images. Composite the real logo and typography in the edit.
7. Assemble with the local renderer or a currently verified provider route. Keep voice, music, SFX and picture separate until final mix.
8. Check the picture, captions, phoneme timing, loudness, export and full decoding. Deliver a playable file, cover, subtitles and receipt.
9. Claim publication only after obtaining the destination's receipt. A file, canvas or merge alone is not a social post.

## Local lesson renderer

`scripts/render_trivalley_lesson.py` takes a private `job.json` and local media. It produces 720 × 1280, 24 fps H.264/AAC with fast-start, a continuous narration, optional ducked music, muted source-video audio, timed word highlighting or reviewed phrase captions, SRT/ASS, SHA-256, technical QA and a manifest. It supports 8–180 seconds and 1–40 contiguous still/video shots.

```bash
python scripts/render_trivalley_lesson.py /private/job/job.json /private/job/output
```

Dependencies: Python/Pillow, FFmpeg/FFprobe with libx264/libass, Noto Sans Display. CI uses a synthetic still and tone, no private media or paid service.

```json
{
  "schema_version": 1,
  "episode_id": "inside-program-first-week-en-a",
  "language": "en",
  "duration": 55.0,
  "narration": "media/narration.wav",
  "music": "media/approved-bed.wav",
  "transcript": "media/timed-words.json",
  "shots": [
    {"kind": "video", "source": "media/avatar.mp4", "overlay": "frames/opening.png", "start": 0, "end": 6},
    {"kind": "image", "source": "frames/source-page.png", "start": 6, "end": 55}
  ]
}
```

This timing is illustrative; measure the actual audio and create a useful complete edit. The transcript `words` array contains `text`, `start`, `end` and optionally `type: word`. Asset paths are relative to the private job folder; traversal and symlinks are rejected. The renderer invokes no provider and publishes nothing. It records `visual_review: pending`; inspect the output before marking that passed. Actual iPhone playback requires a separate observed check.

## Localization and reuse

Keep the source-script revision, translated adaptation, review result and final audio linked. Review speech, captions, on-screen text and mouth synchronization separately. Dubbing does not update all four. Record AI and fluent-human translation review separately and truthfully.

A practical bundle includes the main video, two alternative hooks, audio companion, source-checked written summary and covers. Write audio companions for listening rather than mechanically reading visual tables. Store the applicable music license/plan reference privately. Place interval cues on exact timeline timestamps instead of relying on generated pauses as a timer.

## Provider and website extensions

The current private receipt must establish the real state of each extension:

- Brand Kit and approved presenter settings.
- Published Flows template with actual inputs/outputs and compatible version.
- Audio Native, or an accurately labeled alternative audio player, on the live site.
- Public-business FAQ voice/text assistant with current product facts.
- Live conversational face only after the separate avatar service and integration are configured and tested.

Do not label an alternative player Audio Native, or a prerecorded video a live avatar. Current API access, plans and regional capabilities must be checked at runtime.

## Status and measurement

Track `planned`, `awaiting_input`, `generated`, `rendered`, `technical_qa_passed`, `reviewed`, `deployed`, and `verified` separately. Advance only from the actual provider, file or destination receipt. A blocker names the missing input/capability and the concrete work ready to use.

For variations, retain the hook, cover, central-script revision and CTA. Keep audience metrics empty until actual measurement. Compare watch-through, useful engagement, booking/product clicks, qualified inquiries, production time and cost. No performance improvement is implied by generating a variant.

## Official discovery references

- [Flows](https://elevenlabs.io/docs/eleven-creative/products/flows)
- [Template API](https://elevenlabs.io/docs/eleven-api/guides/how-to/templates/run-a-template)
- [Studio and Actor Mode](https://elevenlabs.io/docs/eleven-creative/products/studio)
- [Image/video models](https://elevenlabs.io/docs/overview/capabilities/image-video)
- [Dubbing](https://elevenlabs.io/docs/eleven-creative/products/dubbing)
- [Audio Native for Wix](https://elevenlabs.io/docs/eleven-creative/audio-tools/audio-native/wix)
- [Agent widget](https://elevenlabs.io/docs/eleven-agents/customization/widget)
- [LiveAvatar](https://elevenlabs.io/docs/eleven-agents/guides/integrations/live-avatar)
- [Music Terms](https://elevenlabs.io/music-terms)

A current catalog and observed result outrank a stale example.
