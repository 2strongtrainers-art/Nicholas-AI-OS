#!/usr/bin/env bash
# Explicit operator invocation only. Deploys the queue, never starts a daemon/model.
set -euo pipefail
set +x
umask 077
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NICHOLAS_AI_OS_ROOT="$repo_root"
config_dir="$(mktemp -d)"
trap 'rm -rf "$config_dir"' EXIT

# Require the existing owner-only worker key before touching the service.
# Missing credentials are an owner setup step; do not invent/rotate them here.
python3 - "$repo_root/scripts" <<'PY'
import sys
sys.path.insert(0, sys.argv[1])
import hermes_switchboard_worker as worker
worker.worker_key()
PY
cd "$repo_root/services/ai-switchboard"
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
bash "$repo_root/scripts/prepare_hermes_deploy.sh" "$config_dir/wrangler.json"
npx wrangler deploy --config "$config_dir/wrangler.json" --dry-run

# Preserve SWITCHBOARD_API_KEY and OPENROUTER_API_KEY. Only synchronize the
# existing worker credential, using stdin rather than argv or shell tracing.
python3 - "$repo_root/scripts" <<'PY' | npx wrangler secret put HERMES_WORKER_KEY --config "$config_dir/wrangler.json"
import sys
sys.path.insert(0, sys.argv[1])
import hermes_switchboard_worker as worker
sys.stdout.write(worker.worker_key())
PY
npx wrangler deploy --config "$config_dir/wrangler.json"
echo 'HERMES_QUEUE_DEPLOYED; run hermes_doctor.py and verify a completed job separately.'
