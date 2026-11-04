#!/usr/bin/env bash
# npm run deploy uses this entry point so redeployment cannot drop HERMES_JOBS.
set -euo pipefail
set +x
umask 077
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root/services/ai-switchboard"
config_dir="$(mktemp -d)"
trap 'rm -rf "$config_dir"' EXIT
bash "$repo_root/scripts/prepare_hermes_deploy.sh" "$config_dir/wrangler.json"
npx wrangler deploy --config "$config_dir/wrangler.json" "$@"
