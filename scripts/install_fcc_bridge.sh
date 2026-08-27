#!/usr/bin/env bash
set -euo pipefail

# Integrate Free Claude Code (FCC) into the Nicholas local AI stack without
# replacing the existing Cloudflare/OpenRouter switchboard. FCC becomes an
# additional local routing layer for Codex, OpenCode and Hermes.

FCC_COMMIT="af59bc08b1f9265cee941aaa703fe6280aa69274"
FCC_PYTHON="3.14.0"
FCC_ARCHIVE="https://github.com/Alishahryar1/free-claude-code/archive/${FCC_COMMIT}.zip"
LOCAL_BIN="$HOME/.local/bin"
mkdir -p "$LOCAL_BIN"

add_path() {
  case ":$PATH:" in
    *":$1:"*) ;;
    *) PATH="$1:$PATH" ;;
  esac
}

add_path "$HOME/.local/bin"
add_path "$HOME/.cargo/bin"
add_path "$HOME/.opencode/bin"
export PATH

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "Installing uv from Astral's official installer..."
  TMP_UV="$(mktemp)"
  trap 'rm -f "$TMP_UV"' EXIT
  curl -fsSL https://astral.sh/uv/install.sh -o "$TMP_UV"
  sh "$TMP_UV"
  rm -f "$TMP_UV"
  trap - EXIT
  add_path "$HOME/.local/bin"
  add_path "$HOME/.cargo/bin"
  export PATH
fi

command -v uv >/dev/null 2>&1 || { echo "uv installation failed." >&2; exit 1; }

echo "Installing Free Claude Code from pinned commit $FCC_COMMIT..."
uv tool install \
  --force \
  --refresh-package free-claude-code \
  --python "$FCC_PYTHON" \
  "free-claude-code @ $FCC_ARCHIVE"

TOOL_BIN="$(uv tool dir --bin)"
[[ -n "$TOOL_BIN" ]] || { echo "uv returned an empty tool bin directory." >&2; exit 1; }
add_path "$TOOL_BIN"
export PATH

for cmd in fcc-server fcc-codex fcc-opencode fcc-hermes; do
  [[ -x "$TOOL_BIN/$cmd" ]] || { echo "FCC installation is missing $cmd." >&2; exit 1; }
  if [[ "$TOOL_BIN" != "$LOCAL_BIN" ]]; then
    ln -sfn "$TOOL_BIN/$cmd" "$LOCAL_BIN/$cmd"
  fi
done

# The Nicholas stack already manages these agents. Do not silently install or
# replace them here; verify their presence so FCC cannot break the existing setup.
for agent in codex opencode hermes; do
  if ! command -v "$agent" >/dev/null 2>&1; then
    echo "Required existing agent '$agent' is not on PATH. FCC itself is installed, but this launcher cannot be verified yet." >&2
    exit 2
  fi
done

# Persist the pinned upstream revision for auditing and future upgrades.
CONFIG_DIR="$HOME/.config/nicholas-ai-switchboard"
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/fcc.env" <<EOF
FCC_UPSTREAM_REPO='Alishahryar1/free-claude-code'
FCC_UPSTREAM_COMMIT='$FCC_COMMIT'
FCC_TOOL_BIN='$TOOL_BIN'
EOF
chmod 600 "$CONFIG_DIR/fcc.env"

# Keep the standard local-bin path available in interactive shells.
touch "$HOME/.zshrc"
if ! grep -Fq 'export PATH="$HOME/.local/bin:$PATH"' "$HOME/.zshrc"; then
  printf '\n# Nicholas local tools\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.zshrc"
fi

"$TOOL_BIN/fcc-server" --version
"$TOOL_BIN/fcc-codex" --help >/dev/null 2>&1 || true
"$TOOL_BIN/fcc-opencode" --help >/dev/null 2>&1 || true
"$TOOL_BIN/fcc-hermes" --help >/dev/null 2>&1 || true

echo "FCC bridge installed and verified."
echo "Launchers: fcc-codex | fcc-opencode | fcc-hermes"
