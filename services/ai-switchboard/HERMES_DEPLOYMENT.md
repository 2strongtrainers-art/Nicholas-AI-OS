# Hermes queue deployment and verification

Run `npm run deploy` from this directory or use the existing deployment scripts/workflows. These entry points resolve the account's existing HERMES_JOBS namespace and inject the binding into a temporary configuration. They create the namespace only when none exists, reject ambiguous matches, and preserve other KV bindings. The base configuration contains no invented namespace ID. Direct `wrangler deploy` bypasses this preparation and must not be used for production.

Only research_readonly jobs are accepted. The runner explicitly enables the search toolset. Maintenance remains disabled until an isolated execution environment enforces filesystem, command, network, and credential boundaries. Prompt instructions do not provide those boundaries. Update both the service and the installed runner; old queued maintenance jobs are failed instead of executed.

The existing Hermes HTTP deployment workflow uses the owner's macOS runner and performs a harmless queue/claim/complete check. Cloudflare service deployment can also run on another authorized machine; the local Hermes execution process must exist on a host with its configured provider and worker credential.

`/health` reports whether storage and the worker credential are bound. That does not prove that the runner is alive. Verify a harmless research_readonly job from creation through claim, completion, and recorded result/logs before declaring Hermes operational. KV is eventually consistent; this queue is intended for one runner only, and is not a distributed exactly-once execution mechanism.

The bridge OAuth tests use strongly consistent Durable Objects, separately from the Hermes KV queue. Fixing this custom integration does not reconnect Wix, repair ChatGPT's Slack tool registry, or synchronize authentication across unrelated plugins.
