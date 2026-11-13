# Run Hermes off the Mac

The Custom GPT Action sends a `research_readonly` job to
`nicholas-ai-switchboard`. Workers KV stores the job. One authorized runner
claims it, runs the Hermes CLI, and records its result. The root Wrangler
configuration deploys `nicholas-ai-os`, the separate ElevenLabs bridge.

## Restore the production queue

1. Open Cloudflare **Workers & Pages → nicholas-ai-switchboard → Bindings**.
   Consult the bindings of the last working Hermes deployment if the production
   namespace is ambiguous. Match its namespace ID in the account's Workers KV
   inventory. The repository's August 31 evidence ties the queue to
   [GitHub run 33446228151](https://github.com/2strongtrainers-art/Nicholas-AI-OS/actions/runs/33446228151).
2. Add the existing Workers KV namespace with the name `HERMES_JOBS` and
   deploy the binding. Preserve the existing GPT bearer and model settings.
   [Cloudflare setup](https://developers.cloudflare.com/kv/concepts/kv-namespaces/#bind-your-kv-namespace-via-the-dashboard)
3. The same binding can be restored from main using
   [Deploy AI Switchboard on GitHub](https://github.com/2strongtrainers-art/Nicholas-AI-OS/actions/workflows/deploy-ai-switchboard-hosted.yml)
   with `hermes_namespace_id` set to the verified existing ID. The
   `switchboard-production` environment requires `CLOUDFLARE_ACCOUNT_ID` and
   the Worker-scoped `CLOUDFLARE_API_TOKEN` secret. This route stages the
   current release, verifies its bindings, and checks the live service.
   `scripts/deploy_hermes_portable.sh` uses the same deployment code from
   an authenticated checkout of current main. Use one deployment route at a time.
4. Verify the public `/health` response identifies `nicholas-ai-switchboard`
   and reports `hermes_jobs: true`. Review the Worker secret name
   `HERMES_WORKER_KEY`. The matching value goes in the runner's private
   credential file. If the old value is unavailable, provision a new value
   through the Worker and host secret settings when retiring the Mac runner.
   Keep the separate NK Action bearer untouched.

## Start one persistent Linux runner

Use an existing authorized, always-on Linux host with systemd. A GitHub-hosted
Actions job or a temporary Codex workspace cannot keep the daemon running.
Install the approved Hermes CLI and configure its model and search provider in
its private profile. The supplied service uses `openrouter/free`. An available
model and web search should both be verified from the service account before
letting it claim jobs. [Hermes search configuration](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-search)

The unit files assume the following layout. Adjust the paths in a systemd
drop-in if the host already has an equivalent setup.

| Path or account | Purpose |
| --- | --- |
| `nicholas-hermes` | Dedicated unprivileged service account and group with home `/var/lib/nicholas-hermes` |
| `/opt/nicholas-ai-os` | Current verified checkout, readable by the service account |
| `/opt/hermes-agent/.venv/bin/hermes` | Installed Hermes CLI |
| `/var/lib/nicholas-hermes/.hermes` | Private Hermes profile with the approved model and search configuration |
| `/var/lib/nicholas-hermes/.local/share/opencode/auth.json` | Existing supported OpenRouter credential store owned by the service account, or inject `OPENROUTER_API_KEY` through the host's service secret settings |
| `/etc/nicholas-hermes/deployment.env` | `AI_SWITCHBOARD_URL=https://nicholas-ai-switchboard.2strongtrainers.workers.dev` |
| `/etc/nicholas-hermes/hermes-worker.key` | Worker-only key, owned by the service account with mode `0600` |

Place the files from `deploy/systemd` in `/etc/systemd/system` and run
`systemctl daemon-reload`. Run `scripts/hermes_doctor.py` with the unit's
working directory and environment as the service account. The doctor prints
booleans and exception types. Its authenticated GET verifies the worker key
against Cloudflare without claiming a job. Verify the old Mac LaunchAgent is
stopped or its old credential is retired before allowing a Linux runner to
claim jobs.

Review the existing queued work through `listHermesJobs` or the private
namespace before starting the worker. The runner claims the oldest eligible
job. Once the host and queue are ready, use:

```sh
sudo systemctl enable --now nicholas-hermes-worker.timer
systemctl list-timers nicholas-hermes-worker.timer
```

The timer waits two minutes after each pass to stay within the daily KV list
quota for an idle single runner. For initial verification, start the service
once after creating the NK job. Both the timer and the manual start use the
same service. To stop polling, disable the timer and let any in-flight job
finish.

## Verify from NK

In [NK](https://chatgpt.com/g/g-6a8f2b9dee108191ac6f6706ed0596e0-nk), send:

> /hermes Summarize what a Cloudflare Workers KV namespace binding does in two sentences and link to the official docs.

Record the created job ID and retrieve that same ID until it is `completed`
or `failed`. Check the claim log for `host=linux`, the provider/model, and
the result and its official documentation link. If job creation timed out,
inspect recent jobs before retrying. A public health response only verifies
the binding. The completed result in NK verifies the full route.
