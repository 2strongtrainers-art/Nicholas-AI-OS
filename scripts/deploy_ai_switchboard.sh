#!/bin/zsh
set -euo pipefail
set +x
umask 077

ROOT="${HOME}/Nicholas-AI-OS"
SERVICE_DIR="${ROOT}/services/ai-switchboard"
AUTH_FILE="${HOME}/.local/share/opencode/auth.json"
KEYCHAIN_SERVICE="nicholas-ai-switchboard"
KEYCHAIN_ACCOUNT="gpt-action"
PRESERVE_EXISTING_SWITCHBOARD_SECRET="${PRESERVE_EXISTING_SWITCHBOARD_SECRET:-0}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() {
  echo "$1" >&2
  exit "${2:-1}"
}

[[ -d "$SERVICE_DIR" ]] || fail "AI switchboard service is missing from Nicholas-AI-OS."
command -v node >/dev/null 2>&1 || fail "Node.js is required."
command -v npm >/dev/null 2>&1 || fail "npm is required."
command -v python3 >/dev/null 2>&1 || fail "python3 is required."
command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v security >/dev/null 2>&1 || fail "macOS Keychain command is required."

cd "$SERVICE_DIR"

# Keep this deployment from creating tracked lockfile churn in the Mac queue repo.
npm install --no-package-lock --no-audit --no-fund >"$TMP_DIR/npm-install.log" 2>&1
npm run typecheck >"$TMP_DIR/typecheck.log" 2>&1
npx wrangler deploy --dry-run >"$TMP_DIR/wrangler-dry-run.log" 2>&1

# The existing Nicholas-AI-OS Cloudflare bridge means Wrangler may already be
# authenticated on this Mac. Never print its OAuth/API credential.
if ! npx wrangler whoami >"$TMP_DIR/whoami.log" 2>&1; then
  echo "NEEDS_CLOUDFLARE_AUTH=1"
  echo "Run Wrangler login once on the Mac, then requeue this deployment."
  exit 42
fi

# Reuse the OpenRouter credential already configured in OpenCode. The key is
# read locally and piped directly into Wrangler; it is never echoed or written
# to Nicholas-AI-OS.
OPENROUTER_KEY="${OPENROUTER_API_KEY:-}"
if [[ -z "$OPENROUTER_KEY" && -f "$AUTH_FILE" ]]; then
  OPENROUTER_KEY="$(python3 - "$AUTH_FILE" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
try:
    data = json.loads(path.read_text(encoding="utf-8"))
except Exception:
    print("")
    raise SystemExit(0)

entry = data.get("openrouter") if isinstance(data, dict) else None
key = ""
if isinstance(entry, dict):
    candidate = entry.get("key")
    if isinstance(candidate, str):
        key = candidate.strip()
print(key)
PY
)"
fi

if [[ -z "$OPENROUTER_KEY" ]]; then
  echo "NEEDS_OPENROUTER_AUTH=1"
  echo "OpenRouter is not available in the worker environment or OpenCode auth store."
  exit 43
fi

# Create the Worker once so Wrangler has a deployment target before secret
# binding. Missing secrets are safe here: authenticated routes remain closed.
INITIAL_DEPLOY="$(npx wrangler deploy 2>&1)" || {
  printf '%s\n' "$INITIAL_DEPLOY" | sed -E 's/(token|key|secret|authorization)[^[:space:]]*/\1=[REDACTED]/Ig' >&2
  exit 44
}

# Interactive/local deployments retain the original behavior: reuse the GPT
# Action key from Keychain or create it once if absent. Headless CI can set
# PRESERVE_EXISTING_SWITCHBOARD_SECRET=1, in which case the already-configured
# Cloudflare SWITCHBOARD_API_KEY is deliberately left untouched.
SWITCHBOARD_KEY=""
if [[ "$PRESERVE_EXISTING_SWITCHBOARD_SECRET" != "1" ]]; then
  SWITCHBOARD_KEY="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$KEYCHAIN_ACCOUNT" -w 2>/dev/null || true)"
  if [[ -z "$SWITCHBOARD_KEY" ]]; then
    SWITCHBOARD_KEY="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
    security add-generic-password -U \
      -s "$KEYCHAIN_SERVICE" \
      -a "$KEYCHAIN_ACCOUNT" \
      -w "$SWITCHBOARD_KEY" >/dev/null
  fi
fi

printf '%s' "$OPENROUTER_KEY" | npx wrangler secret put OPENROUTER_API_KEY >"$TMP_DIR/secret-openrouter.log" 2>&1
if [[ "$PRESERVE_EXISTING_SWITCHBOARD_SECRET" == "1" ]]; then
  echo "SWITCHBOARD_API_KEY_PRESERVED=1"
else
  printf '%s' "$SWITCHBOARD_KEY" | npx wrangler secret put SWITCHBOARD_API_KEY >"$TMP_DIR/secret-switchboard.log" 2>&1
fi

FINAL_DEPLOY="$(npx wrangler deploy 2>&1)" || {
  printf '%s\n' "$FINAL_DEPLOY" | sed -E 's/(token|key|secret|authorization)[^[:space:]]*/\1=[REDACTED]/Ig' >&2
  exit 45
}

WORKER_URL="$(printf '%s\n%s\n' "$INITIAL_DEPLOY" "$FINAL_DEPLOY" | grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' | tail -n 1 || true)"
if [[ -z "$WORKER_URL" ]]; then
  fail "Worker deployed but its workers.dev URL could not be resolved from Wrangler output." 46
fi

curl -fsS "$WORKER_URL/health" >"$TMP_DIR/health.json"
if [[ "$PRESERVE_EXISTING_SWITCHBOARD_SECRET" == "1" ]]; then
  python3 - "$TMP_DIR/health.json" <<'PY'
import json
import sys
health = json.load(open(sys.argv[1], encoding="utf-8"))
if health.get("ok") is not True:
    raise SystemExit("Health check did not return ok=true")
print("SWITCHBOARD_HEALTH=PASS")
print("AUTHENTICATED_MODEL_CHECK=SKIPPED_PRESERVE_MODE")
PY
else
  curl -fsS \
    -H "Authorization: Bearer $SWITCHBOARD_KEY" \
    "$WORKER_URL/models?refresh=1" >"$TMP_DIR/models.json"

  python3 - "$TMP_DIR/health.json" "$TMP_DIR/models.json" <<'PY'
import json
import sys

health = json.load(open(sys.argv[1], encoding="utf-8"))
models = json.load(open(sys.argv[2], encoding="utf-8"))
if health.get("ok") is not True:
    raise SystemExit("Health check did not return ok=true")
if models.get("ok") is not True:
    raise SystemExit("Model resolution did not return ok=true")
if not models.get("ox") or not models.get("qwen"):
    raise SystemExit("Ox/Qwen aliases did not resolve")
print(f"OX_MODEL_RESOLVED={models['ox']}")
print(f"QWEN_MODEL_RESOLVED={models['qwen']}")
PY
fi

# A tiny Ox inference proves the external path end-to-end. Qwen is resolved
# from the live catalog but is not automatically invoked here because provider
# pricing can differ; the private GPT Preview will perform that explicit test.
python3 - "$TMP_DIR/ox-request.json" <<'PY'
import json
import sys
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump({
        "model": "ox",
        "prompt": "Return exactly OX_SWITCHBOARD_READY",
        "max_tokens": 64,
    }, f)
PY

if [[ "$PRESERVE_EXISTING_SWITCHBOARD_SECRET" == "1" ]]; then
  echo "OX_LIVE_TEST=SKIPPED_PRESERVE_MODE"
else
  curl -fsS \
    -H "Authorization: Bearer $SWITCHBOARD_KEY" \
    -H "Content-Type: application/json" \
    --data-binary "@$TMP_DIR/ox-request.json" \
    "$WORKER_URL/ask" >"$TMP_DIR/ox-response.json"

  python3 - "$TMP_DIR/ox-response.json" <<'PY'
import json
import sys
payload = json.load(open(sys.argv[1], encoding="utf-8"))
if payload.get("ok") is not True:
    raise SystemExit("Ox switchboard request failed")
text = str(payload.get("text") or "").strip()
if text != "OX_SWITCHBOARD_READY":
    raise SystemExit(f"Unexpected Ox validation response: {text[:120]!r}")
print(f"OX_LIVE_TEST=PASS")
print(f"OX_RESPONSE_MODEL={payload.get('response_model') or payload.get('resolved_model')}")
PY
fi

# Install/update the local `ai` launcher now that OpenCode is already working.
/bin/zsh "$ROOT/scripts/install_ai_switcher.sh" >"$TMP_DIR/ai-launcher.log" 2>&1 || {
  echo "AI_LAUNCHER_INSTALL=WARNING"
}

# Create a safe helper that copies (but never prints) the GPT Action bearer key
# when the final ChatGPT GPT-editor authentication field needs it. The helper is
# only executed interactively; preserve-mode CI never reads or modifies Keychain.
mkdir -p "$HOME/.local/bin"
cat >"$HOME/.local/bin/ai-switchboard-key-copy" <<'EOF'
#!/bin/zsh
set -euo pipefail
KEY="$(security find-generic-password -s nicholas-ai-switchboard -a gpt-action -w)"
printf '%s' "$KEY" | pbcopy
unset KEY
echo "AI Switchboard GPT Action key copied to clipboard."
EOF
chmod 700 "$HOME/.local/bin/ai-switchboard-key-copy"

# Persist only non-secret deployment metadata locally for easy recovery.
CONFIG_DIR="$HOME/.config/nicholas-ai-switchboard"
mkdir -p "$CONFIG_DIR"
printf 'AI_SWITCHBOARD_URL=%q\n' "$WORKER_URL" >"$CONFIG_DIR/deployment.env"
chmod 600 "$CONFIG_DIR/deployment.env"

# Final output intentionally contains no credential value.
echo "AI_SWITCHBOARD_DEPLOYED=1"
echo "AI_SWITCHBOARD_URL=$WORKER_URL"
echo "OPENAPI_URL=$WORKER_URL/openapi.json"
echo "PRIVACY_URL=$WORKER_URL/privacy"
if [[ "$PRESERVE_EXISTING_SWITCHBOARD_SECRET" == "1" ]]; then
  echo "GPT_ACTION_KEY_UNCHANGED=1"
else
  echo "GPT_ACTION_KEY_STORED_IN_KEYCHAIN=1"
fi
echo "GPT_ACTION_KEY_COPY_COMMAND=ai-switchboard-key-copy"
echo "AI_SWITCHBOARD_BACKEND_VERIFIED=1"