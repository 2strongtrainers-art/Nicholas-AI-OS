#!/usr/bin/env bash
# Run the same versioned production deployment from an authorized host.
set -euo pipefail
set +x
umask 077
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test "$(git -C "$repo_root" symbolic-ref -q HEAD)" = refs/heads/main
test -z "$(git -C "$repo_root" status --porcelain)"
git -C "$repo_root" fetch --no-tags origin main
GITHUB_SHA="$(git -C "$repo_root" rev-parse HEAD)"
test "$GITHUB_SHA" = "$(git -C "$repo_root" rev-parse origin/main)"
export GITHUB_SHA GITHUB_REF=refs/heads/main WRANGLER_SEND_METRICS=false
: "${CLOUDFLARE_ACCOUNT_ID:?Cloudflare account ID is required}"
: "${CLOUDFLARE_API_TOKEN:?Authorized Worker API token is required}"
: "${HERMES_JOBS_NAMESPACE_ID:?Verified production Hermes KV namespace ID is required}"

cd "$repo_root/services/ai-switchboard"
env -u CLOUDFLARE_API_TOKEN npm ci --ignore-scripts --no-audit --no-fund
env -u CLOUDFLARE_API_TOKEN npm run typecheck
env -u CLOUDFLARE_API_TOKEN npm test
exec python3 "$repo_root/scripts/deploy_switchboard_hosted.py"
