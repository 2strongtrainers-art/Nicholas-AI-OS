#!/bin/zsh
set -euo pipefail

HERMES_BIN="$HOME/.local/bin/hermes"
REPO="$HOME/Nicholas-AI-OS"
SCRIPTS_DIR="$HOME/.hermes/scripts"
HEALTH_SCRIPT="$SCRIPTS_DIR/nicholas-ai-os-health.py"
JOB_NAME="Nicholas AI OS Daily Health"

if [[ ! -x "$HERMES_BIN" ]]; then
  echo "ERROR: Hermes CLI not found at $HERMES_BIN"
  exit 1
fi
if [[ ! -d "$REPO/.git" ]]; then
  echo "ERROR: Nicholas-AI-OS repository not found at $REPO"
  exit 1
fi

mkdir -p "$SCRIPTS_DIR"

cat > "$HEALTH_SCRIPT" <<'PY'
from __future__ import annotations

import json
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

repo = Path.home() / "Nicholas-AI-OS"
queue = repo / "jobs" / "openmontage"
worker_status = repo / "status" / "openmontage-worker.json"


def git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.stdout.strip()

branch = git("branch", "--show-current") or "unknown"
sha = git("rev-parse", "--short", "HEAD") or "unknown"
last_commit = git("log", "-1", "--pretty=%s") or "unknown"
dirty_count = len([line for line in git("status", "--porcelain").splitlines() if line.strip()])

counts = Counter()
latest_failed = []
if queue.exists():
    for path in sorted(queue.glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            counts["unreadable"] += 1
            continue
        status = str(payload.get("status") or "unknown")
        counts[status] += 1
        if status == "failed":
            latest_failed.append(str(payload.get("id") or path.stem))

worker_state = "unknown"
worker_checked = "unknown"
last_success = "unknown"
if worker_status.exists():
    try:
        payload = json.loads(worker_status.read_text(encoding="utf-8"))
        worker_state = str(payload.get("state") or "unknown")
        worker_checked = str(payload.get("checked_at") or "unknown")
        last_success = str(payload.get("last_successful_job") or "unknown")
    except Exception:
        worker_state = "unreadable"

now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
summary = [
    "Nicholas-AI-OS Daily Health",
    f"Time: {now}",
    f"Repo: branch={branch} sha={sha} dirty_files={dirty_count}",
    f"Latest commit: {last_commit}",
    f"Worker: state={worker_state} checked_at={worker_checked}",
    f"Last successful worker job: {last_success}",
    "Queue: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())) if counts else "Queue: empty",
]
if latest_failed:
    summary.append("Recent failed jobs: " + ", ".join(latest_failed[-5:]))
print("\n".join(summary))
PY

chmod 700 "$HEALTH_SCRIPT"

# Install only the local user service that also hosts Hermes cron. No messaging
# platform setup is invoked, no provider is configured, and no paid model is used.
"$HERMES_BIN" gateway install --force --start-now --start-on-login >/tmp/hermes-gateway-install.log 2>&1 || {
  cat /tmp/hermes-gateway-install.log
  exit 1
}

# Keep the job idempotent across reruns.
"$HERMES_BIN" cron remove "$JOB_NAME" >/dev/null 2>&1 || true
"$HERMES_BIN" cron create "30 7 * * *" \
  --no-agent \
  --script "nicholas-ai-os-health.py" \
  --deliver local \
  --name "$JOB_NAME"

# Trigger once now and tick the scheduler so setup is proven immediately.
"$HERMES_BIN" cron run "$JOB_NAME"
"$HERMES_BIN" cron tick

GATEWAY_STATUS="$($HERMES_BIN gateway status --deep 2>&1 || true)"
CRON_LIST="$($HERMES_BIN cron list 2>&1 || true)"
CRON_RUNS="$($HERMES_BIN cron runs "$JOB_NAME" --limit 3 2>&1 || true)"

echo "HERMES_SAFE_CONFIG_OK=1"
echo "HERMES_GATEWAY_LOCAL_SCHEDULER=1"
echo "HERMES_EXTERNAL_MESSAGING_CONFIGURED=0"
echo "HERMES_MODEL_PROVIDER_CONFIGURED=0"
echo "HERMES_CRON_NO_AGENT=1"
echo "HERMES_CRON_SCHEDULE=30 7 * * *"
echo "HERMES_CRON_DELIVERY=local"
echo "HERMES_HEALTH_SCRIPT=$HEALTH_SCRIPT"
echo "--- gateway status ---"
echo "$GATEWAY_STATUS"
echo "--- cron list ---"
echo "$CRON_LIST"
echo "--- recent runs ---"
echo "$CRON_RUNS"
