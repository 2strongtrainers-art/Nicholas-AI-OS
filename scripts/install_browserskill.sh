#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="$HOME/.local/share/browserskill"
BIN_DIR="$HOME/.local/bin"
REPO_URL="https://github.com/Tencent/BrowserSkill.git"

mkdir -p "$INSTALL_DIR" "$BIN_DIR"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required for BrowserSkill." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required for BrowserSkill." >&2
  exit 1
fi

if [[ -d "$INSTALL_DIR/.git" ]]; then
  git -C "$INSTALL_DIR" fetch --tags --prune origin
  git -C "$INSTALL_DIR" checkout main
  git -C "$INSTALL_DIR" pull --ff-only origin main
else
  rm -rf "$INSTALL_DIR"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Install JS dependencies using the lockfile when available.
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

# Build when the project exposes a build script; otherwise leave source installed.
if node -e 'const p=require("./package.json"); process.exit(p.scripts&&p.scripts.build?0:1)' 2>/dev/null; then
  npm run build
fi

# Discover the BrowserSkill CLI entrypoint from package.json and expose a stable alias.
CLI_PATH="$(node <<'NODE'
const p=require('./package.json');
const b=p.bin;
if (!b) process.exit(1);
if (typeof b === 'string') console.log(b);
else {
  const key = Object.keys(b).find(k => /browser|bsk/i.test(k)) || Object.keys(b)[0];
  if (!key) process.exit(1);
  console.log(b[key]);
}
NODE
)"

if [[ -z "$CLI_PATH" || ! -e "$INSTALL_DIR/$CLI_PATH" ]]; then
  echo "BrowserSkill installed but CLI entrypoint could not be resolved from package.json." >&2
  exit 1
fi

chmod +x "$INSTALL_DIR/$CLI_PATH" || true
ln -sf "$INSTALL_DIR/$CLI_PATH" "$BIN_DIR/browserskill"
ln -sf "$INSTALL_DIR/$CLI_PATH" "$BIN_DIR/bsk"

echo "BrowserSkill installed at: $INSTALL_DIR"
echo "CLI aliases: browserskill | bsk"
"$BIN_DIR/bsk" --help >/dev/null 2>&1 || true
