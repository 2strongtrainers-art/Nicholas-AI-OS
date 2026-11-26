# AI revenue launch kit

**Start with a $297 two-clip content pilot**, then test four clips/month at $597 if demand and delivery effort support it. Prices and economics are hypotheses.

- [Five-path plan and economics](PLAN.md)
- [Interactive pricing calculator](calculator.html) — download/open locally; not a deployed site.
- [Offer, outreach and delivery checklist](OFFER-AND-OUTREACH.md)
- [Original Hyperframes composition](demo/index.html) and [verification record](demo/VERIFICATION.md)
- [Sample MP4](demo/sample.mp4)
- [Machine-readable assumptions](opportunities.json)

The sample proves a rendering path, not customer demand. Nothing was sent, sold or published. The nine source references were merged in PR #128; this pack does not assert all nine applications run. Existing OpenMontage/Fast Reel remains the supplied-footage production route.

## Reproduce the sample

```sh
cd demo
npm ci --ignore-scripts
npx hyperframes browser ensure
npm run check
npm run render
```

Node >=22 and FFmpeg required. Silent 8-second 1080×1920 original typography concept; no customer likeness, invented outcomes, paid generation, music or narration. Local DejaVu font license is included. Dependencies are pinned/locked. Hyperframes subscription usage returned unknown (no subscription login); only local rendering is used. Optional transcription/TTS/music/Docker dependencies are absent.
