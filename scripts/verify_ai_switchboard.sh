#!/bin/zsh
set -euo pipefail
set +x
umask 077

EXPECTED_OX="z-ai/glm-5.3"
EXPECTED_QWEN="qwen/qwen3.8-2.4t-a95b"
KEYCHAIN_SERVICE="nicholas-ai-switchboard"
KEYCHAIN_ACCOUNT="gpt-action"
CONFIG="$HOME/.config/nicholas-ai-switchboard/deployment.env"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

[[ -f "$CONFIG" ]] || { echo "VERIFY_FAIL: deployment metadata missing"; exit 1; }
# shellcheck disable=SC1090
source "$CONFIG"
: "${AI_SWITCHBOARD_URL:?VERIFY_FAIL: AI_SWITCHBOARD_URL missing}"

KEY="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$KEYCHAIN_ACCOUNT" -w 2>/dev/null || true)"
[[ -n "$KEY" ]] || { echo "VERIFY_FAIL: switchboard key missing from Keychain"; exit 1; }

curl -fsS "$AI_SWITCHBOARD_URL/health" >"$TMP/health.json"
curl -fsS -H "Authorization: Bearer $KEY" "$AI_SWITCHBOARD_URL/models?refresh=1" >"$TMP/models.json"

python3 - "$TMP/health.json" "$TMP/models.json" "$EXPECTED_OX" "$EXPECTED_QWEN" <<'PY'
import json, sys
health=json.load(open(sys.argv[1]))
models=json.load(open(sys.argv[2]))
expected_ox=sys.argv[3]
expected_qwen=sys.argv[4]
assert health.get('ok') is True, health
assert models.get('ok') is True, models
assert models.get('ox') == expected_ox, f"Ox resolved to {models.get('ox')!r}"
assert models.get('qwen') == expected_qwen, f"Qwen resolved to {models.get('qwen')!r}"
assert models.get('auto') == 'openrouter/auto', f"Auto resolved to {models.get('auto')!r}"
print(f"MODELS_VERIFY=PASS ox={models['ox']} qwen={models['qwen']} auto={models['auto']}")
PY

verify_call() {
  alias="$1"
  expected_text="$2"
  expected_model="$3"
  req="$TMP/${alias}-request.json"
  resp="$TMP/${alias}-response.json"
  python3 - "$req" "$alias" "$expected_text" <<'PY'
import json, sys
json.dump({'model':sys.argv[2],'prompt':f'Return exactly {sys.argv[3]}','max_tokens':256}, open(sys.argv[1],'w'))
PY
  curl -fsS \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    --data-binary "@$req" \
    "$AI_SWITCHBOARD_URL/ask" >"$resp"
  python3 - "$resp" "$alias" "$expected_text" "$expected_model" <<'PY'
import json, sys
p=json.load(open(sys.argv[1]))
alias, expected_text, expected_model=sys.argv[2:5]
assert p.get('ok') is True, p
assert str(p.get('text') or '').strip() == expected_text, p
assert p.get('resolved_model') == expected_model, p
print(f"{alias.upper()}_LIVE_TEST=PASS resolved_model={p.get('resolved_model')} response_model={p.get('response_model')}")
PY
}

verify_call ox GLM_SWITCH_READY "$EXPECTED_OX"
verify_call qwen QWEN_SWITCH_READY "$EXPECTED_QWEN"
verify_call auto AUTO_SWITCH_READY openrouter/auto

unset KEY

echo "AI_SWITCHBOARD_E2E_VERIFIED=1"
