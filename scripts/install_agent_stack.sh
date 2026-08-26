#!/bin/zsh
set -euo pipefail
export PATH="$HOME/.local/bin:$HOME/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
log(){ printf '%s\n' "$*"; }
ver(){ command -v "$1" >/dev/null 2>&1 && "$1" --version 2>&1 | head -1 || printf 'missing'; }
ROOT="$HOME/Nicholas-AI-OS"
JOBS="$ROOT/jobs/openmontage"

log "AGENT_STACK_INSTALL_START=1"
log "CODEX_BEFORE=$(ver codex)"
curl -fsSL https://chatgpt.com/codex/install.sh | sh
hash -r 2>/dev/null || true
CODEX_BIN="$(command -v codex || true)"; [ -z "$CODEX_BIN" ] && [ -x "$HOME/.local/bin/codex" ] && CODEX_BIN="$HOME/.local/bin/codex"
[ -n "$CODEX_BIN" ] || exit 21
log "CODEX_INSTALLED=1"; log "CODEX_VERSION=$($CODEX_BIN --version 2>&1 | head -1)"

log "OPENCODE_BEFORE=$(ver opencode)"
curl -fsSL https://opencode.ai/install | bash
hash -r 2>/dev/null || true
OPENCODE_BIN="$(command -v opencode || true)"
for c in "$HOME/.opencode/bin/opencode" "$HOME/.local/bin/opencode" /opt/homebrew/bin/opencode /usr/local/bin/opencode; do [ -z "$OPENCODE_BIN" ] && [ -x "$c" ] && OPENCODE_BIN="$c"; done
[ -n "$OPENCODE_BIN" ] || exit 23
log "OPENCODE_READY=1"; log "OPENCODE_VERSION=$($OPENCODE_BIN --version 2>&1 | head -1 || true)"

mkdir -p "$HOME/bin"
cat > "$HOME/bin/ox" <<'EOF'
#!/bin/zsh
set -e
MODEL="${OX_MODEL:-openrouter/stealth/ox-alpha}"
exec opencode --model "$MODEL" "$@"
EOF
chmod 700 "$HOME/bin/ox"
touch "$HOME/.zprofile"
grep -Fq 'export PATH="$HOME/bin:$PATH"' "$HOME/.zprofile" || printf '\n# Nicholas AI OS launchers\nexport PATH="$HOME/bin:$PATH"\n' >> "$HOME/.zprofile"
log "OX_LAUNCHER_CREATED=1"

# Determine explicit subrequests from the currently running allowlisted install job.
FLAGS="$(python3 - "$JOBS" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]); preserve=switch=False
for f in p.glob('*.json'):
    try: j=json.loads(f.read_text())
    except Exception: continue
    if j.get('status')=='running' and j.get('execution_mode')=='install_agent_stack':
        preserve = preserve or j.get('preserve_ox_alpha') is True
        switch = switch or j.get('deploy_ai_switchboard') is True
print(('1' if preserve else '0')+('1' if switch else '0'))
PY
)"
PRESERVE="${FLAGS[1]:-0}"; SWITCH="${FLAGS[2]:-0}"

if [ "$PRESERVE" = "1" ]; then
  PRESERVE_SCRIPT="$ROOT/scripts/preserve_ox_alpha.sh"
  [ -f "$PRESERVE_SCRIPT" ] || { log "OX_PRESERVE_SCRIPT_MISSING=1"; exit 30; }
  /bin/zsh "$PRESERVE_SCRIPT" || log "OX_PRESERVATION_SUBTASK_FAILED=1"
fi

# Non-destructive Qwen audit; never delete, replace, or stop the existing service.
RAM_BYTES="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"; log "MAC_RAM_BYTES=$RAM_BYTES"
lsof -nP -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1 && log "PORT_8080_LISTENING=1" || log "PORT_8080_LISTENING=0"
FOUND35=0; FOUND38=0
for root in "$HOME/.cache/huggingface" "$HOME/Models" "$HOME/models" "$HOME/Downloads" "$HOME/.ollama/models"; do
  [ -d "$root" ] || continue
  while IFS= read -r f; do case "$f" in *Qwen3.8*|*qwen3.8*) FOUND38=1;; *Qwen3.5*|*qwen3.5*) FOUND35=1;; esac; done < <(find "$root" -maxdepth 7 -type f \( -iname '*qwen3.8*' -o -iname '*qwen3.5*' \) 2>/dev/null | head -40)
done
log "QWEN35_FILE_DETECTED=$FOUND35"; log "QWEN38_FILE_DETECTED=$FOUND38"; log "QWEN_PRESERVED=1"

# Keep the pre-existing switchboard deployment behavior available when explicitly requested.
if [ "$SWITCH" = "1" ]; then
  /bin/zsh "$ROOT/scripts/deploy_ai_switchboard.sh" || log "AI_SWITCHBOARD_DEPLOY_REQUEST_COMPLETED=0"
fi

# Hermes runtime only; do not turn on external messaging or provider keys here.
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash -s -- --skip-setup --non-interactive
hash -r 2>/dev/null || true
HERMES_BIN="$(command -v hermes || true)"
for c in "$HOME/.local/bin/hermes" "$HOME/.hermes/bin/hermes"; do [ -z "$HERMES_BIN" ] && [ -x "$c" ] && HERMES_BIN="$c"; done
[ -n "$HERMES_BIN" ] || exit 22
log "HERMES_INSTALLED=1"

CATALOG_ROOT="$HOME/AgentSkills"; CATALOG_DIR="$CATALOG_ROOT/awesome-agent-skills"
mkdir -p "$CATALOG_ROOT" "$HOME/.agents/catalogs"
if [ -d "$CATALOG_DIR/.git" ]; then git -C "$CATALOG_DIR" fetch --depth 1 origin main && git -C "$CATALOG_DIR" reset --hard origin/main; else rm -rf "$CATALOG_DIR" && git clone --depth 1 https://github.com/VoltAgent/awesome-agent-skills.git "$CATALOG_DIR"; fi
ln -sfn "$CATALOG_DIR" "$HOME/.agents/catalogs/awesome-agent-skills"
log "AWESOME_AGENT_SKILLS_INSTALLED=1"

test -x "$CODEX_BIN"; test -x "$OPENCODE_BIN"; test -x "$HOME/bin/ox"; test -x "$HERMES_BIN"; test -s "$CATALOG_DIR/README.md"
log "AI_TERMINAL_STACK_AUDIT=1"
log "AGENT_STACK_INSTALL_OK=1"
