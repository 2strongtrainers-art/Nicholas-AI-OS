#!/usr/bin/env bash
set -euo pipefail

ROOT="${NICHOLAS_AI_OS_ROOT:-${HOME}/Nicholas-AI-OS}"
SERVICE="$ROOT/services/trivalley-digital-delivery"
CONFIG="$SERVICE/wrangler.jsonc"
OWNER_CONFIG="${HOME}/.config/trivalley-digital-delivery"
STRIPE_KEY_FILE="$OWNER_CONFIG/stripe-restricted.key"
BUYER_SOURCE_FILE="$OWNER_CONFIG/buyer-package-source.url"
DEPLOYMENT_ENV="$OWNER_CONFIG/deployment.env"
BUCKET="trivalley-digital-delivery"
OBJECT_KEY="dumbbell-starter-v2-1.zip"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -d "$SERVICE" ]] || fail "service directory not found"
[[ -s "$STRIPE_KEY_FILE" ]] || fail "missing owner-only Stripe restricted key file"
[[ -s "$BUYER_SOURCE_FILE" ]] || fail "missing owner-only buyer package source URL file"
chmod 600 "$STRIPE_KEY_FILE" "$BUYER_SOURCE_FILE"

cd "$SERVICE"
npm install --no-audit --no-fund
npm test

STRIPE_RESTRICTED_KEY="$(cat "$STRIPE_KEY_FILE")"
BUYER_SOURCE_URL="$(cat "$BUYER_SOURCE_FILE")"
[[ "$STRIPE_RESTRICTED_KEY" == rk_live_* ]] || fail "expected a live restricted Stripe key"
[[ "$BUYER_SOURCE_URL" == https://* ]] || fail "buyer package source must be HTTPS"

printf '%s' "$STRIPE_RESTRICTED_KEY" | npx wrangler secret put STRIPE_RESTRICTED_KEY --config "$CONFIG" >/dev/null
unset STRIPE_RESTRICTED_KEY

TMP_ZIP="$(mktemp -t trivalley-buyer.XXXXXX.zip)"
DEPLOY_LOG="$(mktemp)"
trap 'rm -f "$TMP_ZIP" "$DEPLOY_LOG"' EXIT
curl -fLsS --retry 3 --max-time 60 "$BUYER_SOURCE_URL" -o "$TMP_ZIP"
unset BUYER_SOURCE_URL
[[ -s "$TMP_ZIP" ]] || fail "buyer package download was empty"

if ! npx wrangler r2 bucket create "$BUCKET" >/dev/null 2>&1; then
  BUCKET_LIST="$(npx wrangler r2 bucket list --json)"
  printf '%s' "$BUCKET_LIST" | python3 - "$BUCKET" <<'PY'
import json, sys
name = sys.argv[1]
data = json.load(sys.stdin)
if not any((item.get("name") == name) for item in data):
    raise SystemExit("R2 bucket creation failed and bucket does not exist")
PY
fi

npx wrangler r2 object put "$BUCKET/$OBJECT_KEY" --file "$TMP_ZIP" >/dev/null
npx wrangler deploy --config "$CONFIG" | tee "$DEPLOY_LOG"
WORKER_URL="$(grep -Eo 'https://[^[:space:]]+\.workers\.dev' "$DEPLOY_LOG" | tail -1 || true)"
[[ -n "$WORKER_URL" ]] || fail "wrangler did not report a workers.dev URL"

mkdir -p "$OWNER_CONFIG"
chmod 700 "$OWNER_CONFIG"
printf 'TRIVALLEY_DELIVERY_URL=%q\n' "$WORKER_URL" > "$DEPLOYMENT_ENV"
chmod 600 "$DEPLOYMENT_ENV"

curl -fsS "$WORKER_URL/health" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok") is True; assert d.get("configured") is True'
printf 'TRIVALLEY_DIGITAL_DELIVERY=PASS\n'
printf 'TRIVALLEY_DELIVERY_URL=%s\n' "$WORKER_URL"
