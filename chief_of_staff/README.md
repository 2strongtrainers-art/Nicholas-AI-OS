# TriValley Chief of Staff

TriValley.fit's operating workflow for owner briefings, plan-based decisions, and content production. The portable instructions live in [the repository skill](../.agents/skills/trivalley-chief-of-staff/SKILL.md). ChatGPT Work uses the existing connected apps for live execution. The files below support local testing and media review.

| Ask | Result |
| --- | --- |
| “Run my Chief briefing.” | Numbered priorities with direct links, upcoming calendar and source coverage. |
| “Draft #2 from today’s noon brief.” | A draft tied to the current source and the specified briefing. |
| “Use my Advisor to compare these two options.” | A recommendation grounded in the owner-edited operating plan. |
| “Use Council on this decision.” | Operator, customer and downside perspectives, plus a reversible test. |
| “Prepare a guest guide” or “Turn this recording into a content package.” | A sourced guide or a cut list, title and thumbnail concepts, and channel-specific drafts. |
| “Review these timestamped notes.” | A proposed edit handoff for the correct version of a cut. |
| “Run my revenue pilot.” | Verify one offer, identify eligible warm inquiries, prepare drafts, and report attributed cash separately from leads. |
| “Audit this workflow across these recent runs.” | Numbered changes with before/after copy and regression examples. |

## Live operation

Open Scheduled in ChatGPT to manage the Chief, weekly business and content review, and monthly Advisor tasks. The scheduled prompts are the connected-app execution path. The Chief compares the latest result available to its runner. The owner can replay a brief manually or give follow-up instructions using its item numbers. Private source links and the owner plan belong in ChatGPT and the original connected services. This repository carries workflow code and synthetic data.

The one-page plan can be an owner-editable document. Pass its source when running the portable repo skill. Agent hosts with permission to read it can supply the live plan in their own context. The Advisor uses current owner-approved goals and labels draft material as provisional.

## Local briefing engine

The local engine is for normalized snapshots supplied by a trusted reader. It runs with Python 3.10 or later on Linux and macOS, using their system time-zone data. Run the synthetic example from the repository root.

    python3 -m chief_of_staff.brief chief_of_staff/example.snapshot.json
    python3 -m unittest discover -s tests -p 'test_chief_of_staff.py' -v

The engine accepts a run ID, an explicit observation time, source coverage states, and source-verified records. Gmail thread IDs, Calendar event IDs, Slack message IDs, and GitHub PR or issue IDs provide identity. Use the latest source revision for `version`. Include only actionable records and confirmed upcoming Calendar events. For blocking Calendar events, place the start in `due_at` and the end in `end_at`. Leave the end unset for informational events. The report gives UTC timestamps and applies Pacific calendar-day boundaries.

Keep live snapshots and the state database in a private directory outside the checkout. The default database is at `~/.local/state/trivalley/chief-of-staff.sqlite`. Set `--state` for a dedicated local test. Identical retries replay their saved result. Changes and deadline escalations can resurface an item. Runs and shown-item history expire after 30 days of subsequent operation. The local engine needs no credentials or network access.

## Revenue pilot

Use the [revenue workflow](../.agents/skills/trivalley-chief-of-staff/references/revenue.md) with an existing offer and the owner's authorized lead sources. The Friday review can score an active pilot. For a local check, provide aggregate counts and a complete, verified direct-cost snapshot. The example is synthetic.

    python3 -m chief_of_staff.revenue chief_of_staff/revenue.example.json --as-of 2026-11-22T12:00:00-08:00

The scorecard uses the existing commerce economics routine. Count one person once per pipeline stage, and count paid orders in the payment records. Cash contribution includes direct cash costs and refunds. Verified avoided expenses and estimated pipeline value have separate fields. Keep snapshots outside the repository.

## Timestamped review

Download [review.html](review.html) and open it in a local browser. Choose the current video cut, pause at a frame, and select **Add at playhead**. Select a saved timestamp to seek to it. Download JSON to resume a session, or copy notes to hand to a human editor or the producer workflow. Import requires the same asset name, file size and duration. Use a standard H.264 MP4 for broad browser compatibility.

The review page works with media on the current device. It exports notes for an edit pass. The existing [OpenMontage routing](../docs/openmontage-bridge-modes.md) applies when the user supplies authorized footage and requests an actual render.

## Episode and creator references

- [Matt Wolfe interviews Peter Yang, November 11, 2026](https://www.youtube.com/watch?v=pvl3z_GyU2Y)
- [Peter Yang's public course outline](https://www.behindthecraft.com/personal-os)
- [Peter Yang's public walkthrough on Maven](https://maven.com/p/efe9a6/copy-my-ai-system-to-proactively-take-work-off-your-plate)
- [ChatGPT Work scheduled tasks](https://learn.chatgpt.com/docs/automations)
