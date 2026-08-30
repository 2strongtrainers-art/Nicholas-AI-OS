#!/bin/zsh
set -euo pipefail
set +x

PLIST="$HOME/Library/LaunchAgents/com.nicholas.automation-keepawake.plist"
LOG="$HOME/Library/Logs/AutomationKeepAwake.log"
LABEL="com.nicholas.automation-keepawake"
DOMAIN="gui/$(id -u)"
ROOT="$HOME/Nicholas-AI-OS"
JOBS="$ROOT/jobs/openmontage"

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string>
    <string>-s</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>$LOG</string>
  <key>StandardErrorPath</key>
  <string>$LOG</string>
</dict>
</plist>
EOF

plutil -lint "$PLIST" >/dev/null
launchctl bootout "$DOMAIN" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl kickstart -k "$DOMAIN/$LABEL"
sleep 1

echo "KEEP_AWAKE_INSTALLED=1"
echo "POLICY=Prevent idle system sleep while connected to AC power; display sleep remains allowed"
launchctl print "$DOMAIN/$LABEL" | grep -E 'state =|pid =|last exit code' || true
/usr/bin/pmset -g assertions | grep -E 'PreventSystemSleep|PreventUserIdleSystemSleep|Listed by owning process' || true

VERIFY_TOOL_ROUTER="$(python3 - "$JOBS" <<'PY'
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
flag = False
for path in root.glob('*.json'):
    try:
        job = json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        continue
    if job.get('status') == 'running' and job.get('execution_mode') == 'install_keepawake_agent' and job.get('verify_tool_router') is True:
        flag = True
        break
print('1' if flag else '0')
PY
)"

if [[ "$VERIFY_TOOL_ROUTER" = "1" ]]; then
  BASE_URL="https://nicholas-ai-switchboard.2strongtrainers.workers.dev"
  KEY="$(security find-generic-password -s nicholas-ai-switchboard -a gpt-action -w 2>/dev/null || true)"
  [[ -n "$KEY" ]] || { echo "TOOL_ROUTER_VERIFY=FAIL_KEYCHAIN_KEY_MISSING"; exit 51; }
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"; unset KEY' EXIT

  curl -fsS "$BASE_URL/health?verify=$(date +%s)" > "$TMP/health.json"
  curl -fsS "$BASE_URL/openapi.json?verify=$(date +%s)" > "$TMP/openapi.json"
  printf '%s' '{"task":"find a free browser tool for creating graphics and images","runtime_adapters":[],"limit":3,"include_paid":false}' > "$TMP/request.json"
  curl -fsS \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    --data-binary "@$TMP/request.json" \
    "$BASE_URL/tools/route" > "$TMP/route.json"

  python3 - "$TMP/health.json" "$TMP/openapi.json" "$TMP/route.json" <<'PY'
import json, sys
health = json.load(open(sys.argv[1], encoding='utf-8'))
api = json.load(open(sys.argv[2], encoding='utf-8'))
route = json.load(open(sys.argv[3], encoding='utf-8'))
assert health.get('ok') is True
assert health.get('version') == '1.1.0'
assert health.get('tool_routing') is True
post = api.get('paths', {}).get('/tools/route', {}).get('post', {})
assert post.get('operationId') == 'routeNicholasTool'
assert route.get('ok') is True
assert route.get('source') == 'embedded_private_websurfers'
assert '1800' in str(route.get('catalog_scope') or '')
results = route.get('results') or []
assert 1 <= len(results) <= 3
assert all(isinstance(item, dict) and item.get('website_name') for item in results)
print('TOOL_ROUTER_VERIFY=PASS')
print('TOOL_ROUTER_SOURCE=' + str(route.get('source')))
print('TOOL_ROUTER_SCOPE=' + str(route.get('catalog_scope')))
print('TOOL_ROUTER_RESULT_COUNT=' + str(len(results)))
print('TOOL_ROUTER_TOP_RESULT=' + str(results[0].get('website_name')))
PY
fi
