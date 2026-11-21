# TriValley.fit Content Studio — V6 media QA handoff

**Scope:** owner-private media review and preparation. **State:** BUILT_LOCAL / VERIFIED_LOCAL / NOT_PUBLISHED / ORIGINAL_YOUTUBE_CLIPS_NOT_ACQUIRED. **Date:** 2026-11-17.

The canonical private release bundle and Chief packet live in owner-only ChatGPT Library:
- `/TriValley/Work Handoffs/TriValley_Content_Studio_V6_Production_Review.zip`
- `/TriValley/Work Handoffs/TriValley_Content_Studio_V6_Chief_Handoff_2026-11-17.md`
- `/TriValley/Work Handoffs/TriValley_FIT_V6_Flagship_Real_Photo_Reel.mp4`

These are **not** public GitHub media attachments.

## Verified production inventory

| Artifact | Verified | Qualification |
|---|---|---|
| New Nick Style 3 portrait photo Reel | 1080x1920, 23.8 s, H.264/AAC, decodes without errors | Uses owner-supplied archival gym photographs, original instrumental bed and emblem recreation. **Not filmed workout video; no August Nick speech** |
| Existing illustrated Reels | 4 MP4s at about 20.39 seconds each, all decode without errors | AI gym illustrations, not coach footage |
| Carousel + Story graphics | 18 slide PNGs + 3 story PNGs | Previously prepared source assets reused |
| Content calendar | 30 days of draft captions, scripts, owner review gates | No posts scheduled or published |
| Source media plan | Three machine-generated YouTube video analyses: 8, 10, 8 scenes, and 12 prioritized candidate ranges | **AI scene summaries; no independently verified original frames or timecodes** |
| Local QA | 5/5 protected tests passed, 5/5 videos fully decodable, 63-file ZIP CRC pass | Not a GitHub CI or social platform acceptance receipt |

## Documentary source boundaries

- `At Gorilla jiu jitsu` analysis describes striking bags, not grappling. Review raw video before declaring activity.
- `JM Press` analysis contains strength work and another identifiable participant; promotional consent and accurate technique review required.
- `Self defense` contains simulated firearm-disarm demonstrations after first mat drill; **exclude from casual fitness instruction without substantive safety + rights review**.
- The owner's @kappy782 channel is associated with a **different Google account** than the current signed-in Studio identity. The private Drive originals destination exists but is empty; videos have not been acquired. HAWC gym footage is a separate source requiring rights review.
- Existing ElevenLabs `August Nick` clone is confirmed, but new fitness-brand narration failed at a 380-credit requirement against 17 available credits. The release does not falsely use unrelated narration or claim it contains August Nick.
- The Trinity knot in the new video is a recreation, not verified official logo artwork.

## Proposed next-stage acceptance

1. Owner previews actual V6 Reel, source image context, exact caption and destination; consent check before posting.
2. Keep draft PR #188 unmerged until appropriate review. No auto-publish, paid account changes, unapproved content releases, or new n8n scheduler.
3. After the **other** account becomes available, obtain actual originals through owner-authorized YouTube Studio, put in owner-private Drive, and recheck all candidate timecodes and rights.
4. Generate or import exact approved August Nick script only when credits are sufficient; time subtitles against real audio.
5. Record post URL, timestamp, platform acceptance, and analytics only from real account receipts.

**No public/client media stored in this repository.**