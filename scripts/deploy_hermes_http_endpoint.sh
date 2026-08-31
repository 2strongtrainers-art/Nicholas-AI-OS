#!/bin/zsh
set -euo pipefail
set +x
umask 077

ROOT="${HOME}/Nicholas-AI-OS"
SERVICE_DIR="$ROOT/services/ai-switchboard"
CONFIG_DIR="$HOME/.config/nicholas-ai-switchboard"
DEPLOY_ENV="$CONFIG_DIR/deployment.env"
WORKER_KEY_FILE="$CONFIG_DIR/hermes-worker.key"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() { echo "$1" >&2; exit "${2:-1}"; }

[[ -d "$SERVICE_DIR" ]] || fail "AI switchboard service is missing." 2
[[ -f "$ROOT/scripts/install_hermes_switchboard_worker.sh" ]] || fail "Hermes worker installer is missing." 3
[[ -f "$DEPLOY_ENV" ]] || fail "Switchboard deployment metadata is missing." 4
command -v node >/dev/null 2>&1 || fail "Node.js is required." 5
command -v npm >/dev/null 2>&1 || fail "npm is required." 6
command -v python3 >/dev/null 2>&1 || fail "python3 is required." 7
command -v curl >/dev/null 2>&1 || fail "curl is required." 8

cd "$SERVICE_DIR"
npm install --no-package-lock --no-audit --no-fund >"$TMP_DIR/npm.log" 2>&1
npm run typecheck >"$TMP_DIR/typecheck.log" 2>&1
npx wrangler deploy --dry-run >"$TMP_DIR/dry-run.log" 2>&1
npx wrangler whoami >"$TMP_DIR/whoami.log" 2>&1 || fail "Wrangler is not authenticated on this Mac." 10

# Resolve or create one persistent KV namespace without storing its ID in Git.
npx wrangler kv namespace list >"$TMP_DIR/kv-list.txt" 2>&1
KV_ID="$(python3 - "$TMP_DIR/kv-list.txt" <<'PY'
import json, re, sys
text=open(sys.argv[1], encoding='utf-8', errors='replace').read()
try:
    rows=json.loads(text)
except Exception:
    rows=[]
if isinstance(rows, list):
    for row in rows:
        title=str(row.get('title') or '') if isinstance(row, dict) else ''
        if 'HERMES_JOBS' in title:
            print(row.get('id') or '')
            raise SystemExit
for m in re.finditer(r'\{[^{}]*"id"\s*:\s*"([a-f0-9]+)"[^{}]*"title"\s*:\s*"([^"]*HERMES_JOBS[^"]*)"[^{}]*\}', text, re.I|re.S):
    print(m.group(1)); raise SystemExit
print('')
PY
)"
if [[ -z "$KV_ID" ]]; then
  npx wrangler kv namespace create HERMES_JOBS >"$TMP_DIR/kv-create.log" 2>&1
  npx wrangler kv namespace list >"$TMP_DIR/kv-list-after.txt" 2>&1
  KV_ID="$(python3 - "$TMP_DIR/kv-list-after.txt" <<'PY'
import json, re, sys
text=open(sys.argv[1], encoding='utf-8', errors='replace').read()
try: rows=json.loads(text)
except Exception: rows=[]
if isinstance(rows, list):
    for row in rows:
        title=str(row.get('title') or '') if isinstance(row, dict) else ''
        if 'HERMES_JOBS' in title:
            print(row.get('id') or ''); raise SystemExit
for m in re.finditer(r'\{[^{}]*"id"\s*:\s*"([a-f0-9]+)"[^{}]*"title"\s*:\s*"([^"]*HERMES_JOBS[^"]*)"[^{}]*\}', text, re.I|re.S):
    print(m.group(1)); raise SystemExit
print('')
PY
  )"
fi
[[ -n "$KV_ID" ]] || fail "Could not resolve HERMES_JOBS KV namespace." 11

python3 - "$SERVICE_DIR/wrangler.jsonc" "$TMP_DIR/wrangler-hermes.json" "$KV_ID" <<'PY'
import json, sys
src,out,kv_id=sys.argv[1:]
data=json.load(open(src, encoding='utf-8'))
data['kv_namespaces']=[{'binding':'HERMES_JOBS','id':kv_id}]
with open(out,'w',encoding='utf-8') as f:
    json.dump(data,f,indent=2); f.write('\n')
PY

# Worker-only credential: local owner-only file, never Git/Keychain/stdout.
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
if [[ ! -s "$WORKER_KEY_FILE" ]]; then
  python3 - "$WORKER_KEY_FILE" <<'PY'
import secrets, sys
from pathlib import Path
Path(sys.argv[1]).write_text(secrets.token_urlsafe(48), encoding='utf-8')
PY
fi
chmod 600 "$WORKER_KEY_FILE"
WORKER_KEY="$(cat "$WORKER_KEY_FILE")"
[[ -n "$WORKER_KEY" ]] || fail "Hermes worker credential is empty." 12
printf '%s' "$WORKER_KEY" | npx wrangler secret put HERMES_WORKER_KEY --config "$TMP_DIR/wrangler-hermes.json" >"$TMP_DIR/worker-secret.log" 2>&1
npx wrangler deploy --config "$TMP_DIR/wrangler-hermes.json" >"$TMP_DIR/deploy.log" 2>&1

NICHOLAS_AI_OS_ROOT="$ROOT" /bin/zsh "$ROOT/scripts/install_hermes_switchboard_worker.sh" >"$TMP_DIR/install-worker.log" 2>&1

source "$DEPLOY_ENV"
[[ -n "${AI_SWITCHBOARD_URL:-}" ]] || fail "AI_SWITCHBOARD_URL is missing." 13

curl -fsS "$AI_SWITCHBOARD_URL/health" >"$TMP_DIR/health.json"
curl -fsS "$AI_SWITCHBOARD_URL/openapi.json" >"$TMP_DIR/openapi.json"
python3 - "$TMP_DIR/health.json" "$TMP_DIR/openapi.json" <<'PY'
import json, sys
health=json.load(open(sys.argv[1],encoding='utf-8'))
schema=json.load(open(sys.argv[2],encoding='utf-8'))
assert health.get('ok') is True
assert health.get('hermes_jobs') is True, health
paths=schema.get('paths') or {}
assert paths.get('/hermes/jobs',{}).get('post',{}).get('operationId')=='createHermesJob'
assert paths.get('/hermes/jobs/{job_id}',{}).get('get',{}).get('operationId')=='getHermesJob'
assert '/hermes/internal/jobs' not in paths
assert '/hermes/internal/claim' not in paths
print('HERMES_SCHEMA_AND_STORE=PASS')
PY

printf '%s' '{"task":"Return exactly HERMES_HTTP_ENDPOINT_OK. Do not use tools.","timeout_seconds":300}' >"$TMP_DIR/create.json"

# Public routes must remain protected by the existing GPT bearer, which this
# headless path intentionally never reads or rotates.
PUBLIC_CODE="$(curl -sS -o "$TMP_DIR/public-unauth.json" -w '%{http_code}' \
  -H "Content-Type: application/json" \
  --data-binary "@$TMP_DIR/create.json" \
  "$AI_SWITCHBOARD_URL/hermes/jobs")"
[[ "$PUBLIC_CODE" = "401" ]] || fail "Public Hermes route did not enforce bearer auth." 14
echo "HERMES_PUBLIC_AUTH_BARRIER=PASS"

# Internal worker-authenticated route exercises the same persistent queue while
# keeping worker-only operations out of the GPT/OpenAPI surface.
curl -fsS \
  -H "Authorization: Bearer $WORKER_KEY" \
  -H "Content-Type: application/json" \
  --data-binary "@$TMP_DIR/create.json" \
  "$AI_SWITCHBOARD_URL/hermes/internal/jobs" >"$TMP_DIR/created.json"
JOB_ID="$(python3 - "$TMP_DIR/created.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
assert d.get('ok') is True, d
j=d.get('job') or {}
assert j.get('status')=='queued', j
print(j['id'])
PY
)"
[[ -n "$JOB_ID" ]] || fail "Hermes smoke job was not created." 15

/usr/bin/python3 "$HOME/.local/share/nicholas-ai/hermes_switchboard_worker.py"

curl -fsS \
  -H "Authorization: Bearer $WORKER_KEY" \
  "$AI_SWITCHBOARD_URL/hermes/internal/jobs/$JOB_ID" >"$TMP_DIR/result.json"
python3 - "$TMP_DIR/result.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
assert d.get('ok') is True, d
j=d.get('job') or {}
assert j.get('status')=='completed', j
assert 'HERMES_HTTP_ENDPOINT_OK' in str(j.get('result') or ''), j
assert j.get('profile')=='research_readonly', j
print('HERMES_ENDPOINT_E2E=PASS')
PY
unset WORKER_KEY

echo "HERMES_HTTP_ENDPOINT=PASS"
echo "HERMES_CREATE_JOB=PASS"
echo "HERMES_GET_RESULT=PASS"
echo "HERMES_MAC_WORKER=PASS"
echo "GPT_ACTION_BEARER_UNCHANGED=PASS"