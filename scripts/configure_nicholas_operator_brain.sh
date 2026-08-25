#!/bin/zsh
set -euo pipefail

HERMES_BIN="$HOME/.local/bin/hermes"
HERMES_HOME_DIR="${HERMES_HOME:-$HOME/.hermes}"
HERMES_REPO="$HOME/.hermes/hermes-agent"
HERMES_PYTHON="$HERMES_REPO/venv/bin/python"
CODEX_AUTH_FILE="$HOME/.codex/auth.json"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOUL_SOURCE="$REPO_ROOT/hermes/NICHOLAS_OPERATOR_SOUL.md"
SOUL_TARGET="$HERMES_HOME_DIR/SOUL.md"

[[ -x "$HERMES_BIN" ]] || { echo "Hermes binary not found" >&2; exit 1; }
[[ -f "$SOUL_SOURCE" ]] || { echo "Nicholas Operator SOUL source missing" >&2; exit 1; }
[[ -f "$REPO_ROOT/.hermes.md" ]] || { echo "Nicholas-AI-OS Hermes context missing" >&2; exit 1; }
mkdir -p "$HERMES_HOME_DIR/memories"

if [[ -f "$SOUL_TARGET" ]]; then
  cp "$SOUL_TARGET" "$SOUL_TARGET.pre-nicholas-operator.bak"
fi
cp "$SOUL_SOURCE" "$SOUL_TARGET"
chmod 600 "$SOUL_TARGET"

"$HERMES_BIN" config set model.provider openai-codex >/dev/null
"$HERMES_BIN" config set model.default gpt-5.6-sol >/dev/null
"$HERMES_BIN" config set model.base_url https://chatgpt.com/backend-api/codex >/dev/null
"$HERMES_BIN" config set memory.memory_enabled true >/dev/null
"$HERMES_BIN" config set memory.user_profile_enabled true >/dev/null
"$HERMES_BIN" config set memory.write_approval true >/dev/null
"$HERMES_BIN" config set agent.tool_use_enforcement auto >/dev/null
"$HERMES_BIN" config set agent.execution_guidance auto >/dev/null
"$HERMES_BIN" config set agent.task_completion_guidance true >/dev/null
"$HERMES_BIN" config set agent.parallel_tool_call_guidance true >/dev/null
"$HERMES_BIN" config set agent.verify_on_stop true >/dev/null
"$HERMES_BIN" config set agent.run_budget_seconds 1800 >/dev/null

HERMES_PYTHON_PRESENT=0
HERMES_REPO_PRESENT=0
CODEX_AUTH_FILE_PRESENT=0
[[ -x "$HERMES_PYTHON" ]] && HERMES_PYTHON_PRESENT=1
[[ -d "$HERMES_REPO" ]] && HERMES_REPO_PRESENT=1
[[ -f "$CODEX_AUTH_FILE" ]] && CODEX_AUTH_FILE_PRESENT=1

CODEX_IMPORT=0
IMPORT_RC=99
IMPORT_OUTPUT=""
if [[ "$HERMES_PYTHON_PRESENT" == "1" && "$HERMES_REPO_PRESENT" == "1" ]]; then
  set +e
  IMPORT_OUTPUT="$(
    cd "$HERMES_REPO"
    "$HERMES_PYTHON" - <<'PY'
from hermes_cli.auth import _import_codex_cli_tokens, _save_codex_tokens

tokens = _import_codex_cli_tokens()
if tokens:
    _save_codex_tokens(tokens)
    print("CODEX_AUTH_IMPORTED=1")
else:
    print("CODEX_AUTH_IMPORTED=0")
PY
  )"
  IMPORT_RC=$?
  set -e
  if [[ "$IMPORT_OUTPUT" == *"CODEX_AUTH_IMPORTED=1"* ]]; then
    CODEX_IMPORT=1
  fi
fi

AUTH_STATUS="$($HERMES_BIN auth status openai-codex 2>&1 || true)"
AUTH_LIST="$($HERMES_BIN auth list openai-codex 2>&1 || true)"
AUTH_ENTRY_PRESENT=0
if echo "$AUTH_STATUS\n$AUTH_LIST" | grep -Eqi 'active|available|device_code'; then
  AUTH_ENTRY_PRESENT=1
fi
if [[ "$CODEX_IMPORT" == "1" || "$AUTH_ENTRY_PRESENT" == "1" ]]; then
  CODEX_AUTH=1
else
  CODEX_AUTH=0
fi

"$HERMES_BIN" gateway restart >/dev/null 2>&1 || true
sleep 2
GATEWAY_STATUS="$($HERMES_BIN gateway status 2>&1 || true)"

MODEL_PROVIDER="$($HERMES_BIN config get model.provider 2>/dev/null || true)"
MODEL_DEFAULT="$($HERMES_BIN config get model.default 2>/dev/null || true)"
MEMORY_APPROVAL="$($HERMES_BIN config get memory.write_approval 2>/dev/null || true)"

GATEWAY_OK=0
if echo "$GATEWAY_STATUS" | grep -Eqi 'supervised|running|PID|active'; then
  GATEWAY_OK=1
fi

CONFIG_OK=1
DIAGNOSTIC="ok"
if [[ "$MODEL_PROVIDER" != *"openai-codex"* ]]; then
  CONFIG_OK=0; DIAGNOSTIC="provider_verification_failed"
elif [[ "$MODEL_DEFAULT" != *"gpt-5.6-sol"* ]]; then
  CONFIG_OK=0; DIAGNOSTIC="model_verification_failed"
elif [[ "$MEMORY_APPROVAL" != *"true"* && "$MEMORY_APPROVAL" != *"True"* ]]; then
  CONFIG_OK=0; DIAGNOSTIC="memory_approval_verification_failed"
elif [[ "$CODEX_AUTH" != "1" ]]; then
  CONFIG_OK=0; DIAGNOSTIC="codex_oauth_unavailable"
elif [[ ! -s "$SOUL_TARGET" ]]; then
  CONFIG_OK=0; DIAGNOSTIC="soul_verification_failed"
fi

# Markers only. Never print token values, auth file contents, .env contents, or raw auth output.
echo "NICHOLAS_OPERATOR_CONFIG_OK=$CONFIG_OK"
echo "NICHOLAS_OPERATOR_SOUL_INSTALLED=1"
echo "NICHOLAS_OPERATOR_PROJECT_CONTEXT=1"
echo "NICHOLAS_OPERATOR_PROVIDER=openai-codex"
echo "NICHOLAS_OPERATOR_MODEL=gpt-5.6-sol"
echo "NICHOLAS_OPERATOR_CODEX_AUTH_DETECTED=$CODEX_AUTH"
echo "NICHOLAS_OPERATOR_CODEX_AUTH_IMPORTED=$CODEX_IMPORT"
echo "NICHOLAS_OPERATOR_CODEX_AUTH_FILE_PRESENT=$CODEX_AUTH_FILE_PRESENT"
echo "NICHOLAS_OPERATOR_HERMES_REPO_PRESENT=$HERMES_REPO_PRESENT"
echo "NICHOLAS_OPERATOR_HERMES_PYTHON_PRESENT=$HERMES_PYTHON_PRESENT"
echo "NICHOLAS_OPERATOR_IMPORT_RC=$IMPORT_RC"
echo "NICHOLAS_OPERATOR_AUTH_ENTRY_PRESENT=$AUTH_ENTRY_PRESENT"
echo "NICHOLAS_OPERATOR_MEMORY_APPROVAL=1"
echo "NICHOLAS_OPERATOR_UNATTENDED_AI_CRON=0"
echo "NICHOLAS_OPERATOR_EXTERNAL_MESSAGING=0"
echo "NICHOLAS_OPERATOR_GATEWAY_OK=$GATEWAY_OK"
echo "NICHOLAS_OPERATOR_DIAGNOSTIC=$DIAGNOSTIC"
exit 0