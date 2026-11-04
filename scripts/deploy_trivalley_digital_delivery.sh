#!/usr/bin/env bash
set -euo pipefail

ROOT="${NICHOLAS_AI_OS_ROOT:-${HOME}/Nicholas-AI-OS}"
SERVICE="$ROOT/services/trivalley-digital-delivery"
CONFIG="$SERVICE/wrangler.jsonc"
OWNER_CONFIG="${HOME}/.config/trivalley-digital-delivery"
STRIPE_KEY_FILE="$OWNER_CONFIG/stripe-restricted.key"
BUYER_URL_FILE="$OWNER_CONFIG/buyer-file.url"
DEPLOYMENT_ENV="$OWNER_CONFIG/deployment.env"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -d "$SERVICE" ]] || fail "service directory not found"
[[ -s "$STRIPE_KEY_FILE" ]] || fail "missing owner-only Stripe restricted key file"
[[ -s "$BUYER_URL_FILE" ]] || fail "missing owner-only buyer file URL"
chmod 600 "$STRIPE_KEY_FILE" "$BUYER_URL_FILE"

cd "$SERVICE"
npm install --no-audit --no-fund
npm test

STRIPE_RESTRICTED_KEY="$(cat "$STRIPE_KEY_FILE")"
BUYER_FILE_URL="$(cat "$BUYER_URL_FILE")"
[[ "$STRIPE_RESTRICTED_KEY" == rk_live_* ]] || fail "expected a live restricted Stripe key"
[[ "$BUYER_FILE_URL" == https://* ]] || fail "buyer file URL must be HTTPS"

printf '%s' "$STRIPE_RESTRICTED_KEY" | npx wrangler secret put STRIPE_RESTRICTED_KEY --config "$CONFIG" >/dev/null
printf '%s' "$BUYER_FILE_URL" | npx wrangler secret put BUYER_FILE_URL --config "$CONFIG" >/dev/null
unset STRIPE_RESTRICTED_KEY BUYER_FILE_URL

DEPLOY_LOG="$(mktemp)"
trap 'rm -f "$DEPLOY_LOG"' EXIT
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
