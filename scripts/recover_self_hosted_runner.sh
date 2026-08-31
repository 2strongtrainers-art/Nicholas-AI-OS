#!/bin/zsh
set -euo pipefail
set +x

EXPECTED_REPO="https://github.com/2strongtrainers-art/Nicholas-AI-OS"
REPO="$HOME/Nicholas-AI-OS"

log(){ printf '%s\n' "$*"; }
fail(){ log "ERROR: $*" >&2; exit 1; }

log "MAC_RUNNER_RECOVERY_START=1"
[[ "$(uname -s)" == "Darwin" ]] || fail "This recovery script is macOS-only."

# Locate an already-registered GitHub Actions runner. Never re-register here and
# never request or print a runner token. Prefer a runner whose local .runner
# metadata points at Nicholas-AI-OS.
typeset -a candidates
candidates=(
  "$HOME/actions-runner"
  "$HOME/ActionsRunner"
  "$HOME/github-runner"
  "$HOME/_actions-runner"
)

while IFS= read -r cfg; do
  dir="${cfg:h}"
  candidates+=("$dir")
done < <(find "$HOME" -maxdepth 4 -type f -name .runner 2>/dev/null | head -40)

RUNNER_DIR=""
for dir in $candidates; do
  [[ -d "$dir" && -f "$dir/.runner" && -x "$dir/run.sh" ]] || continue
  MATCH="$(python3 - "$dir/.runner" "$EXPECTED_REPO" <<'PY'
import json, sys
p, expected = sys.argv[1:]
try:
    data = json.load(open(p, encoding='utf-8'))
except Exception:
    print('0')
    raise SystemExit
text = ' '.join(str(v) for v in data.values())
print('1' if expected.lower() in text.lower() or 'Nicholas-AI-OS'.lower() in text.lower() else '0')
PY
)"
  if [[ "$MATCH" == "1" ]]; then
    RUNNER_DIR="$dir"
    break
  fi
  [[ -z "$RUNNER_DIR" ]] && RUNNER_DIR="$dir"
done

[[ -n "$RUNNER_DIR" ]] || fail "Could not locate an existing GitHub Actions runner registration under $HOME."
log "RUNNER_DIR=$RUNNER_DIR"

cd "$RUNNER_DIR"

# Restart the existing launchd-backed runner service. Do not modify .runner,
# credentials, registration, labels, or repository configuration.
if [[ -x ./svc.sh ]]; then
  ./svc.sh stop >/dev/null 2>&1 || true
  if ! ./svc.sh start >/dev/null 2>&1; then
    # If it was registered but never installed as a service, install it using
    # the existing registration only; this does not require a GitHub token.
    ./svc.sh install >/dev/null 2>&1 || true
    ./svc.sh start >/dev/null 2>&1 || fail "GitHub Actions runner service could not be started."
  fi
  sleep 2
  ./svc.sh status || true
else
  fail "Runner found at $RUNNER_DIR but svc.sh is missing or not executable."
fi

# Confirm the listener process is present without printing environment or secrets.
if pgrep -f 'Runner.Listener' >/dev/null 2>&1; then
  log "GITHUB_RUNNER_LISTENER=1"
else
  fail "Runner service command returned, but Runner.Listener is not running."
fi

# Repair the independent Nicholas worker too. This gives the endpoint deployment
# a second route to complete after the Actions runner comes online.
if [[ -d "$REPO/.git" && -f "$REPO/scripts/install_openmontage_worker.sh" ]]; then
  cd "$REPO"
  git config rebase.autoStash true
  git pull --ff-only || log "OPENMONTAGE_REPO_PULL_SKIPPED=1"
  /bin/zsh "$REPO/scripts/install_openmontage_worker.sh"
  log "OPENMONTAGE_WORKER_RECOVERED=1"
else
  log "OPENMONTAGE_WORKER_RECOVERED=SKIPPED_REPO_NOT_FOUND"
fi

log "MAC_RUNNER_RECOVERY_OK=1"
log "QUEUED_GITHUB_JOBS_CAN_RESUME=1"
