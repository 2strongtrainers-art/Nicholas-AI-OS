#!/usr/bin/env bash
# Resolve from this script, so recovery hosts can invoke it from any directory.
set -euo pipefail
set +x
umask 077
output="${1:?Output config path required}"
if [[ "$output" != /* ]]; then output="$PWD/$output"; fi
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root/services/ai-switchboard"
namespace_tmp="$(mktemp -d)"
trap 'rm -rf "$namespace_tmp"' EXIT
npx wrangler kv namespace list > "$namespace_tmp/namespaces.json"
if python3 "$repo_root/scripts/resolve_hermes_kv.py" wrangler.jsonc "$namespace_tmp/namespaces.json" "$output"; then
  exit 0
else
  result=$?
  if [[ "$result" != 3 ]]; then exit "$result"; fi
fi
npx wrangler kv namespace create HERMES_JOBS > "$namespace_tmp/create.log" 2>&1
npx wrangler kv namespace list > "$namespace_tmp/namespaces.json"
python3 "$repo_root/scripts/resolve_hermes_kv.py" wrangler.jsonc "$namespace_tmp/namespaces.json" "$output"
