# Interactive workout posters

This original TriValley feature adds poster-style previews and controls over the existing OpenGym workout engine. No DAREBEE artwork, exercise posters, programs or assets are included.

## Use

- On Today, choose **Open interactive workout poster** in the session guide. Or open Train and choose **Preview [routine name]**.
- Review the full routine and prescribed sets before starting. **Start this workout** retains the existing optional bodyweight check-in; the session timestamp is created when that check-in completes.
- An active workout offers **Poster view** and **Focus view**. Both use the same active workout and saved sets.
- Tap **Log set** after performing a set. Timed holds offer **Time set** and use the existing countdown. Exercise instructions expand without leaving the poster. Load/repetition editing opens the existing focus controls.
- **Start [n]s rest** uses the existing rest bar, with adjustment and Skip. The elapsed session clock includes rest and time away from the page.
- Session notes stay with the active workout and are copied into its finished record. Finishing uses the existing partial-session confirmation and duplicate guard.
- The finish summary and history detail show actual start/finish timestamps and elapsed time. Missing historical timestamps are labeled as unrecorded.

## Boundaries

This is local browser storage with the existing quota-failure warnings and JSON backup flow. No cloud sync, client accounts, paid-program access control or live coach review is introduced. Reload preserves the session/notes/completed sets, but an in-flight rest or hold countdown is not represented as resumed work after a reload. A hold is credited only when the existing work-timer callback completes or the user explicitly logs it.

The poster uses the routine's actual exercise names, equipment and written instructions. There are no new exercise demonstration videos or generated technique images. Existing coach imagery and Trinity branding are preserved; private likeness references are never added to the repository.

## Reproduce and verify

Run the existing pinned build sequence through `upgrade_v5.py`, then `upgrade_v6.py`, before Vite compilation and `check_dist.py`. The existing workflow runs deterministic poster tests, upstream tests, existing browser regressions and the new `poster_smoke.mjs` acceptance. The latter checks preview/start, out-of-focus set logging and correct rest context, timed holds, note persistence, 320-1280px reflow, automated poster accessibility and one finished history record.

Automated Chromium checks do not certify physical iPhone Safari, VoiceOver, background audio, Files delivery or coach/client sync. These remain separate acceptance checks.
