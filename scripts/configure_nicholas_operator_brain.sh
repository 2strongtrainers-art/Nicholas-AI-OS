#!/bin/zsh
set -euo pipefail

HERMES_BIN="$HOME/.local/bin/hermes"
UV_BIN="$HOME/.local/bin/uv"
HERMES_HOME_DIR="${HERMES_HOME:-$HOME/.hermes}"
HERMES_REPO="$HOME/.hermes/hermes-agent"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOUL_SOURCE="$REPO_ROOT/hermes/NICHOLAS_OPERATOR_SOUL.md"
SOUL_TARGET="$HERMES_HOME_DIR/SOUL.md"

[[ -x "$HERMES_BIN" ]] || { echo "Hermes binary not found" >&2; exit 1; }
[[ -f "$SOUL_SOURCE" ]] || { echo "Nicholas Operator SOUL source missing" >&2; exit 1; }
[[ -f "$REPO_ROOT/.hermes.md" ]] || { echo "Nicholas-AI-OS Hermes context missing" >&2; exit 1; }
mkdir -p "$HERMES_HOME_DIR/memories"

# Preserve the previous identity before replacing it.
if [[ -f "$SOUL_TARGET" ]]; then
  cp "$SOUL_TARGET" "$SOUL_TARGET.pre-nicholas-operator.bak"
fi
cp "$SOUL_SOURCE" "$SOUL_TARGET"
chmod 600 "$SOUL_TARGET"

# Main interactive brain: existing ChatGPT/Codex OAuth, no API key inserted here.
"$HERMES_BIN" config set model.provider openai-codex >/dev/null
"$HERMES_BIN" config set model.default gpt-5.6-sol >/dev/null
"$HERMES_BIN" config set model.base_url https://chatgpt.com/backend-api/codex >/dev/null

# Deliberate operator guardrails.
"$HERMES_BIN" config set memory.memory_enabled true >/dev/null
"$HERMES_BIN" config set memory.user_profile_enabled true >/dev/null
"$HERMES_BIN" config set memory.write_approval true >/dev/null
"$HERMES_BIN" config set agent.tool_use_enforcement auto >/dev/null
"$HERMES_BIN" config set agent.execution_guidance auto >/dev/null
"$HERMES_BIN" config set agent.task_completion_guidance true >/dev/null
"$HERMES_BIN" config set agent.parallel_tool_call_guidance true >/dev/null
"$HERMES_BIN" config set agent.verify_on_stop true >/dev/null
"$HERMES_BIN" config set agent.run_budget_seconds 1800 >/dev/null

# Hermes' normal Codex import asks an interactive yes/no question. The Mac worker
# is headless, so perform the same supported import using Hermes' own functions.
# Token values remain local and are never printed or passed through GitHub.
CODEX_IMPORT=0
if [[ -x "$UV_BIN" && -d "$HERMES_REPO" ]]; then
  IMPORT_OUTPUT="$(
    cd "$HERMES_REPO"
    "$UV_BIN" run python - <<'PY'
from hermes_cli.auth import _import_codex_cli_tokens, _save_codex_tokens

tokens = _import_codex_cli_tokens()
if tokens:
    _save_codex_tokens(tokens)
    print("CODEX_AUTH_IMPORTED=1")
else:
    print("CODEX_AUTH_IMPORTED=0")
PY
  )"
  if [[ "$IMPORT_OUTPUT" == *"CODEX_AUTH_IMPORTED=1"* ]]; then
    CODEX_IMPORT=1
  fi
fi

# Keep unattended AI inference disabled: the existing daily health job remains no-agent.
# Do not add or modify any external messaging platform here.

AUTH_STATUS="$($HERMES_BIN auth status openai-codex 2>&1 || true)"
AUTH_LIST="$($HERMES_BIN auth list openai-codex 2>&1 || true)"
if [[ "$CODEX_IMPORT" == "1" ]] || echo "$AUTH_STATUS\n$AUTH_LIST" | grep -Eqi 'active|available|device_code'; then
  CODEX_AUTH=1
else
  CODEX_AUTH=0
fi

# Restart only the local Hermes service so new sessions pick up SOUL/config/auth.
"$HERMES_BIN" gateway restart >/dev/null 2>&1 || true
sleep 2
GATEWAY_STATUS="$($HERMES_BIN gateway status 2>&1 || true)"

MODEL_PROVIDER="$($HERMES_BIN config get model.provider 2>/dev/null || true)"
MODEL_DEFAULT="$($HERMES_BIN config get model.default 2>/dev/null || true)"
MEMORY_APPROVAL="$($HERMES_BIN config get memory.write_approval 2>/dev/null || true)"

[[ "$MODEL_PROVIDER" == *"openai-codex"* ]] || { echo "Provider verification failed" >&2; exit 1; }
[[ "$MODEL_DEFAULT" == *"gpt-5.6-sol"* ]] || { echo "Model verification failed" >&2; exit 1; }
[[ "$MEMORY_APPROVAL" == *"true"* || "$MEMORY_APPROVAL" == *"True"* ]] || { echo "Memory approval verification failed" >&2; exit 1; }
[[ "$CODEX_AUTH" == "1" ]] || { echo "Codex OAuth import verification failed" >&2; exit 1; }
[[ -s "$SOUL_TARGET" ]] || { echo "SOUL verification failed" >&2; exit 1; }

if echo "$GATEWAY_STATUS" | grep -Eqi 'supervised|running|PID|active'; then
  GATEWAY_OK=1
else
  GATEWAY_OK=0
fi

# Markers only; never print auth tokens, auth.json, .env, or raw credential output.
echo "NICHOLAS_OPERATOR_CONFIG_OK=1"
echo "NICHOLAS_OPERATOR_SOUL_INSTALLED=1"
echo "NICHOLAS_OPERATOR_PROJECT_CONTEXT=1"
echo "NICHOLAS_OPERATOR_PROVIDER=openai-codex"
echo "NICHOLAS_OPERATOR_MODEL=gpt-5.6-sol"
echo "NICHOLAS_OPERATOR_CODEX_AUTH_DETECTED=$CODEX_AUTH"
echo "NICHOLAS_OPERATOR_CODEX_AUTH_IMPORTED=$CODEX_IMPORT"
echo "NICHOLAS_OPERATOR_MEMORY_APPROVAL=1"
echo "NICHOLAS_OPERATOR_UNATTENDED_AI_CRON=0"
echo "NICHOLAS_OPERATOR_EXTERNAL_MESSAGING=0"
echo "NICHOLAS_OPERATOR_GATEWAY_OK=$GATEWAY_OK"