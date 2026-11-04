# Hermes recovery on an authorized Mac or Linux host

GitHub stores source and history. It does not run the Hermes CLI by itself.
Muse/dots can be a candidate host only if the actual account permits terminal
execution, the Hermes CLI is installed, credentials are supplied through its
secure account controls, and the process can run for the needed duration.
A cloud computer does not inherit the Mac's files, logins, or Keychain.
Background operation after a VM sleeps/restarts is not established by this patch.
The worker checks local prerequisites before claiming a job and does not blindly
retry POSTs whose responses were lost; this avoids claiming a second job on retry.

## Current problem and acceptance criterion

The live Switchboard reported `hermes_jobs: false` during the November 3, 2026
review. That means its KV binding was absent, regardless of a merged repair PR.
The Mac/OpenMontage heartbeat is a separate component and is not Hermes proof.

Completion requires a real `research_readonly` job ID, terminal `completed`
status, exact requested diagnostic result, and retrieved log. Health and local
tests alone do not meet this criterion. Never fabricate a status JSON to clear it.

## Read-only diagnosis first

Use a clean checkout of the reviewed repair commit, with Python 3 and Node 24.
Set `NICHOLAS_AI_OS_ROOT` to that checkout's absolute path before running:

```sh
python3 scripts/hermes_doctor.py --url https://nicholas-ai-switchboard.2strongtrainers.workers.dev
```

The doctor prints booleans and exception types, not credentials. It does not
create jobs or call a model. Exit 1 means blocked. `ready_for_smoke_test` still
does not mean execution has been verified. Old deployed code that omits the
worker-key health field remains unverified.

Required host configuration:

- `NICHOLAS_AI_OS_ROOT`: the actual checkout, containing its `AGENTS.md`.
- `NICHOLAS_HERMES_CONFIG_DIR`: optional owner-only directory; default is
  `~/.config/nicholas-ai-switchboard`.
- `deployment.env` in that directory: `AI_SWITCHBOARD_URL=` followed by the
  HTTPS Switchboard origin, with no quotes, credentials, or paths.
- `hermes-worker.key` in that directory: the existing worker credential,
  owner-only permissions (`600`), never stored in Git/chat.
- Hermes CLI executable on `PATH` or one of the existing Mac fallback paths.
- Existing provider authorization. Default remains `openrouter/free`; its
  actual availability/quota must be checked. Do not switch to a paid model or
  enable paid provider usage as a workaround.

Use the host's approved secret entry mechanism. Do not paste credentials into
the public repository or an agent conversation. If account authentication is
missing, request the specific account connection instead of searching for keys.

## Repair the cloud queue from an authenticated host

Review first, then explicitly invoke:

```sh
bash scripts/deploy_hermes_portable.sh
```

This runs locked dependency installation, type checks, queue tests and a dry-run
build before deployment. It resolves/preserves the existing account namespace,
creates one only if no match exists, and rejects ambiguous matches. It requires
the existing worker key before any deployment operation, synchronizes that
worker key with the service, and preserves the user bearer and OpenRouter secret.
It needs Wrangler/Cloudflare authorization for the intended account. It does
not install Hermes, start a daemon, rotate the user bearer, create a model job,
or change the separate ElevenLabs bridge.

## Verify actual execution

1. Rerun the doctor; resolve every failed/unknown prerequisite.
2. Select exactly one runner host. Stop the previous runner before switching;
   the KV queue is not a distributed exactly-once queue. PID locks are local.
3. Through the existing authenticated job API, inspect pending jobs before
   resuming the worker. Obtain approval for unrelated backlog work.
4. Create one `research_readonly` diagnostic with the task
   `Return exactly HERMES_RECOVERY_OK. Do not use tools.` and a 300-second limit.
   Record the returned ID. A timeout on creation is ambiguous: inspect recent
   jobs before retrying. The API does not offer an idempotency key.
5. Run `python3 scripts/hermes_switchboard_worker.py` with the explicit checkout
   environment. This processes the oldest queued job, not a chosen ID. Do not
   run it against an unreviewed backlog.
6. Poll that job's authenticated GET endpoint through a terminal state. Preserve
   the returned ID, profile, timestamps, result and log. Report failure as failure.

For a Mac, the existing LaunchAgent installer remains available. For Linux,
this patch supports an operator-invoked one-shot; persistent service setup and
the VM lifecycle must be verified separately. Do not run both hosts concurrently.

## Paste into Muse or your dot

> Repair Hermes in `2strongtrainers-art/Nicholas-AI-OS` using the reviewed
> portable-recovery PR linked by Nick. Fetch current main and the PR head;
> read AGENTS.md, .hermes.md, docs/PARALLEL_WORK_COORDINATION.md, and this recovery
> guide. Inspect the diff and checks before using it; do not merge automatically.
> First prove your actual GitHub, terminal, Hermes CLI and Cloudflare access.
> Use the read-only doctor and report failed prerequisites. If an account
> connection is missing, request that exact connection through secure UI; never
> ask for keys in chat. Once the patch is reviewed and deployment is authorized,
> use deploy_hermes_portable.sh to restore the queue binding while preserving
> existing user authentication. Select one runner and review the backlog before
> execution. Verify one harmless research_readonly diagnostic through creation,
> claim, completion and result/log retrieval. Do not spend money, enable a paid
> model, modify client data, send messages, or publish content. Return the tested
> commit, job ID, terminal status, exact result and remaining blockers. Stop short
> of claiming success if any stage is unverified.
