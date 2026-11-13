# Hermes queue deployment and verification

For an alternate Mac/Linux recovery host, see
[`docs/HERMES_PORTABLE_RECOVERY.md`](../../docs/HERMES_PORTABLE_RECOVERY.md).
The portable path does not require the self-hosted Mac Actions runner.

Use **Deploy AI Switchboard on GitHub** from `main` or add the binding on the existing Cloudflare Worker. The GitHub workflow preserves and verifies the currently deployed bindings. Its optional `hermes_namespace_id` input restores `HERMES_JOBS` from the verified production namespace, and rejects replacing a different live association. The target is `nicholas-ai-switchboard`.

Only research_readonly jobs are accepted. The runner explicitly enables the search toolset. Maintenance remains disabled until an isolated execution environment enforces filesystem, command, network, and credential boundaries. Prompt instructions do not provide those boundaries. Update both the service and the installed runner; old queued maintenance jobs are failed instead of executed.

The older Mac deployment workflows are manual-only and share the production deployment concurrency group. The Hermes execution process requires a host with an approved model provider and a matching worker credential. Linux service units and the authenticated readiness check are documented in [Hermes portable recovery](../../docs/HERMES_PORTABLE_RECOVERY.md).

`/health` reports whether storage and the worker credential are bound. That does not prove that the runner is alive. Verify a harmless research_readonly job from creation through claim, completion, and recorded result/logs before declaring Hermes operational. KV is eventually consistent; this queue is intended for one runner only, and is not a distributed exactly-once execution mechanism.

The bridge OAuth tests use strongly consistent Durable Objects, separately from the Hermes KV queue. Fixing this custom integration does not reconnect Wix, repair ChatGPT's Slack tool registry, or synchronize authentication across unrelated plugins.
