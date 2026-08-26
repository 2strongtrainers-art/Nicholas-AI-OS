#!/bin/zsh
set -euo pipefail

export PATH="$HOME/.local/bin:$HOME/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

log() { printf '%s\n' "$*"; }
version_or_missing() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    "$cmd" --version 2>&1 | head -1 || true
  else
    printf 'missing'
  fi
}

log "AGENT_STACK_INSTALL_START=1"
log "CODEX_BEFORE=$(version_or_missing codex)"

# OpenAI Codex CLI: use the current official macOS/Linux installer.
curl -fsSL https://chatgpt.com/codex/install.sh | sh
hash -r 2>/dev/null || true

CODEX_BIN="$(command -v codex || true)"
if [ -z "$CODEX_BIN" ] && [ -x "$HOME/.local/bin/codex" ]; then
  CODEX_BIN="$HOME/.local/bin/codex"
fi
if [ -z "$CODEX_BIN" ]; then
  echo "Codex installer completed but codex was not found on PATH" >&2
  exit 21
fi
CODEX_VERSION="$($CODEX_BIN --version 2>&1 | head -1)"
log "CODEX_INSTALLED=1"
log "CODEX_BIN=$CODEX_BIN"
log "CODEX_VERSION=$CODEX_VERSION"

# OpenCode: install/update from the official installer so the Mac has the newest
# available release before configuring the OpenRouter-backed Ox Alpha launcher.
log "OPENCODE_BEFORE=$(version_or_missing opencode)"
curl -fsSL https://opencode.ai/install | bash
hash -r 2>/dev/null || true

OPENCODE_BIN="$(command -v opencode || true)"
for candidate in "$HOME/.opencode/bin/opencode" "$HOME/.local/bin/opencode" "/opt/homebrew/bin/opencode" "/usr/local/bin/opencode"; do
  if [ -z "$OPENCODE_BIN" ] && [ -x "$candidate" ]; then
    OPENCODE_BIN="$candidate"
  fi
done
if [ -z "$OPENCODE_BIN" ]; then
  echo "OpenCode installer completed but opencode was not found" >&2
  exit 23
fi
OPENCODE_VERSION="$($OPENCODE_BIN --version 2>&1 | head -1 || true)"
log "OPENCODE_READY=1"
log "OPENCODE_BIN=$OPENCODE_BIN"
log "OPENCODE_VERSION=$OPENCODE_VERSION"

# Create a stable 'ox' launcher usable from any project folder. Do not store an
# API key in source control; OpenCode reads its own authenticated provider store
# or environment. The model slug is OpenRouter's live Ox Alpha identifier.
mkdir -p "$HOME/bin"
cat > "$HOME/bin/ox" <<'EOF'
#!/bin/zsh
set -e
MODEL="${OX_MODEL:-openrouter/stealth/ox-alpha}"
exec opencode --model "$MODEL" "$@"
EOF
chmod 700 "$HOME/bin/ox"
PROFILE="$HOME/.zprofile"
touch "$PROFILE"
if ! grep -Fq 'export PATH="$HOME/bin:$PATH"' "$PROFILE"; then
  printf '\n# Nicholas AI OS launchers\nexport PATH="$HOME/bin:$PATH"\n' >> "$PROFILE"
fi
log "OX_LAUNCHER_CREATED=1"
log "OX_LAUNCHER=$HOME/bin/ox"
log "OX_MODEL=openrouter/stealth/ox-alpha"

# Refresh the OpenCode catalog and verify whether Ox Alpha is currently listed.
# Ox Alpha is a time-limited OpenRouter preview, so model availability is treated
# as runtime state rather than assumed from configuration.
MODELS_TMP="$(mktemp)"
if "$OPENCODE_BIN" models --refresh >"$MODELS_TMP" 2>&1; then
  if grep -Fqi 'openrouter/stealth/ox-alpha' "$MODELS_TMP"; then
    log "OX_ALPHA_CATALOG_AVAILABLE=1"
  else
    log "OX_ALPHA_CATALOG_AVAILABLE=0"
  fi
else
  log "OX_ALPHA_CATALOG_REFRESH_OK=0"
fi
rm -f "$MODELS_TMP"

AUTH_TMP="$(mktemp)"
if "$OPENCODE_BIN" auth list >"$AUTH_TMP" 2>&1; then
  if grep -qi 'openrouter' "$AUTH_TMP"; then
    log "OPENROUTER_AUTH_DETECTED=1"
  else
    log "OPENROUTER_AUTH_DETECTED=0"
  fi
else
  log "OPENROUTER_AUTH_DETECTED=0"
fi
rm -f "$AUTH_TMP"

# Live Ox inference and file-edit smoke tests only run when OpenRouter auth is
# already present. No credentials are printed or written by this installer.
OX_LIVE=0
OX_EDIT=0
if "$OPENCODE_BIN" auth list 2>/dev/null | grep -qi 'openrouter'; then
  OX_OUT="$(mktemp)"
  if "$OPENCODE_BIN" run --model openrouter/stealth/ox-alpha "Reply exactly OX_ALPHA_READY" >"$OX_OUT" 2>&1; then
    if grep -Fq 'OX_ALPHA_READY' "$OX_OUT"; then
      OX_LIVE=1
    fi
  fi
  rm -f "$OX_OUT"

  OX_TMPDIR="$(mktemp -d)"
  if (cd "$OX_TMPDIR" && "$OPENCODE_BIN" run --auto --model openrouter/stealth/ox-alpha "Create a file named ox_probe.txt containing exactly OX_FILE_EDIT_OK and nothing else." >/dev/null 2>&1); then
    if [ -f "$OX_TMPDIR/ox_probe.txt" ] && grep -Fxq 'OX_FILE_EDIT_OK' "$OX_TMPDIR/ox_probe.txt"; then
      OX_EDIT=1
    fi
  fi
  rm -rf "$OX_TMPDIR"
fi
log "OX_ALPHA_LIVE=$OX_LIVE"
log "OX_ALPHA_FILE_EDIT=$OX_EDIT"

# Non-destructive local Qwen audit. Preserve the working Qwen3.5 service/model
# until RAM, process, model file and the port-8080 serving configuration are known.
RAM_BYTES="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
RAM_GB="$(python3 - "$RAM_BYTES" <<'PY'
import sys
try:
    print(round(int(sys.argv[1]) / (1024**3), 2))
except Exception:
    print(0)
PY
)"
log "MAC_RAM_BYTES=$RAM_BYTES"
log "MAC_RAM_GB=$RAM_GB"

if lsof -nP -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then
  log "PORT_8080_LISTENING=1"
else
  log "PORT_8080_LISTENING=0"
fi

QWEN_MODELS_TMP="$(mktemp)"
if curl -fsS --max-time 5 http://127.0.0.1:8080/v1/models >"$QWEN_MODELS_TMP" 2>/dev/null; then
  log "PORT_8080_OPENAI_API=1"
  QWEN_IDS="$(python3 - "$QWEN_MODELS_TMP" <<'PY'
import json, sys
try:
    data=json.load(open(sys.argv[1], 'r', encoding='utf-8'))
    ids=[str(x.get('id','')) for x in data.get('data',[]) if x.get('id')]
    print(','.join(ids)[:1000])
except Exception:
    print('')
PY
)"
  log "PORT_8080_MODEL_IDS=$QWEN_IDS"
else
  log "PORT_8080_OPENAI_API=0"
fi
rm -f "$QWEN_MODELS_TMP"

PROC_TMP="$(mktemp)"
ps -axo pid=,command= | grep -Ei 'llama-server|llama\.cpp|qwen|ollama' | grep -v grep | sed -E 's/(api[_-]?key|token|authorization|bearer)[ =:]+[^ ]+/\1=<redacted>/Ig' >"$PROC_TMP" || true
if [ -s "$PROC_TMP" ]; then
  log "QWEN_PROCESS_DETECTED=1"
  while IFS= read -r line; do log "QWEN_PROCESS=$line"; done < "$PROC_TMP"
else
  log "QWEN_PROCESS_DETECTED=0"
fi
rm -f "$PROC_TMP"

FOUND35=0
FOUND38=0
for root in "$HOME/.cache/huggingface" "$HOME/Models" "$HOME/models" "$HOME/Downloads" "$HOME/.ollama/models"; do
  [ -d "$root" ] || continue
  while IFS= read -r file; do
    case "$file" in
      *Qwen3.8*|*qwen3.8*) FOUND38=1 ;;
      *Qwen3.5*|*qwen3.5*) FOUND35=1 ;;
    esac
    log "QWEN_MODEL_FILE=$file"
  done < <(find "$root" -maxdepth 7 -type f \( -iname '*qwen3.8*' -o -iname '*qwen3.5*' \) 2>/dev/null | head -40)
done
log "QWEN35_FILE_DETECTED=$FOUND35"
log "QWEN38_FILE_DETECTED=$FOUND38"
log "QWEN_PRESERVED=1"

# Nous Hermes Agent: install runtime only. Do not run setup, configure API keys,
# start a messaging gateway, or enable any account integrations.
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash -s -- --skip-setup --non-interactive
hash -r 2>/dev/null || true

HERMES_BIN="$(command -v hermes || true)"
for candidate in "$HOME/.local/bin/hermes" "$HOME/.hermes/bin/hermes"; do
  if [ -z "$HERMES_BIN" ] && [ -x "$candidate" ]; then
    HERMES_BIN="$candidate"
  fi
done
if [ -z "$HERMES_BIN" ]; then
  echo "Hermes installer completed but hermes was not found" >&2
  exit 22
fi
HERMES_VERSION="$($HERMES_BIN --version 2>&1 | head -1 || true)"
log "HERMES_INSTALLED=1"
log "HERMES_BIN=$HERMES_BIN"
log "HERMES_VERSION=$HERMES_VERSION"
log "HERMES_SETUP_SKIPPED=1"
log "HERMES_GATEWAY_STARTED=0"

# Awesome Agent Skills is a curated catalog rather than an executable package.
# Keep a local, updateable checkout outside Codex's live skills directory so the
# entire 1,000+ entry catalog is not injected into every coding session.
CATALOG_ROOT="$HOME/AgentSkills"
CATALOG_DIR="$CATALOG_ROOT/awesome-agent-skills"
mkdir -p "$CATALOG_ROOT" "$HOME/.agents/catalogs"
if [ -d "$CATALOG_DIR/.git" ]; then
  git -C "$CATALOG_DIR" fetch --depth 1 origin main
  git -C "$CATALOG_DIR" reset --hard origin/main
else
  rm -rf "$CATALOG_DIR"
  git clone --depth 1 https://github.com/VoltAgent/awesome-agent-skills.git "$CATALOG_DIR"
fi
ln -sfn "$CATALOG_DIR" "$HOME/.agents/catalogs/awesome-agent-skills"
CATALOG_SHA="$(git -C "$CATALOG_DIR" rev-parse --short=12 HEAD)"
log "AWESOME_AGENT_SKILLS_INSTALLED=1"
log "AWESOME_AGENT_SKILLS_PATH=$CATALOG_DIR"
log "AWESOME_AGENT_SKILLS_SHA=$CATALOG_SHA"

# Verification: installs exist; local Qwen remained untouched.
test -x "$CODEX_BIN"
test -x "$OPENCODE_BIN"
test -x "$HOME/bin/ox"
test -x "$HERMES_BIN"
test -s "$CATALOG_DIR/README.md"

log "AI_TERMINAL_STACK_AUDIT=1"
log "AGENT_STACK_INSTALL_OK=1"
