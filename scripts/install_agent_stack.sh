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

# Verification: neither Hermes nor Codex should require interactive setup just
# to answer a version query. We intentionally do not authenticate or launch them.
test -x "$CODEX_BIN"
test -x "$HERMES_BIN"
test -s "$CATALOG_DIR/README.md"

log "AGENT_STACK_INSTALL_OK=1"
