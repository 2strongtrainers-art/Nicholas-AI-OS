#!/bin/zsh
set -euo pipefail

REPO="$HOME/Nicholas-AI-OS"
PLIST="$HOME/Library/LaunchAgents/com.nicholas.coinbase-crypto-futures-paper.plist"
LOG="$HOME/Library/Logs/CoinbaseCryptoFuturesPaper.log"
RUNTIME="$HOME/.nicholas-ai-os/coinbase-futures-paper"
RUNNER="$REPO/scripts/run_coinbase_crypto_futures_paper_once.py"

if [[ ! -d "$REPO/.git" ]]; then
  echo "ERROR: $REPO is not a Git repository"
  exit 1
fi
if [[ ! -f "$RUNNER" ]]; then
  echo "ERROR: Coinbase crypto-futures paper runner missing: $RUNNER"
  exit 1
fi

PYTHON_BIN=""
for candidate in /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
  if [[ -x "$candidate" ]]; then
    PYTHON_BIN="$candidate"
    break
  fi
done
if [[ -z "$PYTHON_BIN" ]]; then
  PYTHON_BIN="$(command -v python3)"
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs" "$RUNTIME"
chmod +x "$RUNNER"
AUTOMATION_PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.npm-global/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.nicholas.coinbase-crypto-futures-paper</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON_BIN</string>
    <string>$RUNNER</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$REPO</string>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>60</integer>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>$LOG</string>
  <key>StandardErrorPath</key>
  <string>$LOG</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$AUTOMATION_PATH</string>
    <key>HOME</key>
    <string>$HOME</string>
    <key>COINBASE_FUTURES_PAPER_RUNTIME</key>
    <string>$RUNTIME</string>
  </dict>
</dict>
</plist>
EOF

plutil -lint "$PLIST" >/dev/null
launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/com.nicholas.coinbase-crypto-futures-paper"

sleep 8
if [[ ! -f "$RUNTIME/status.json" ]]; then
  echo "ERROR: Coinbase futures paper LaunchAgent started but produced no status file"
  exit 1
fi
if ! grep -q '"paper_only": true' "$RUNTIME/status.json"; then
  echo "ERROR: Coinbase futures status did not verify paper_only=true"
  exit 1
fi
if ! grep -q '"live_execution_enabled": false' "$RUNTIME/status.json"; then
  echo "ERROR: Coinbase futures status did not verify live_execution_enabled=false"
  exit 1
fi

# This installer never accepts or writes Coinbase credentials. Paper v1 uses
# public market-data endpoints only.
echo "COINBASE_CRYPTO_FUTURES_PAPER_INSTALLED=1"
echo "COINBASE_CRYPTO_FUTURES_LIVE_EXECUTION=0"
echo "COINBASE_CRYPTO_FUTURES_PUBLIC_DATA_ONLY=1"
echo "COINBASE_CRYPTO_FUTURES_INTERVAL_SECONDS=60"
echo "COINBASE_CRYPTO_FUTURES_STATUS=$RUNTIME/status.json"
echo "COINBASE_CRYPTO_FUTURES_LOG=$LOG"
cat "$RUNTIME/status.json"
