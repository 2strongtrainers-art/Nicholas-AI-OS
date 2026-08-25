#!/bin/zsh
set -euo pipefail

REPO="$HOME/Nicholas-AI-OS"
PLIST="$HOME/Library/LaunchAgents/com.nicholas.coinbase-crypto-futures-paper.plist"
LOG="$HOME/Library/Logs/CoinbaseCryptoFuturesPaper.log"
RUNTIME="$HOME/.nicholas-ai-os/coinbase-futures-paper"
RUNNER="$REPO/scripts/run_coinbase_crypto_futures_paper_once.py"
HERMES_BIN="${HERMES_BIN:-$HOME/.local/bin/hermes}"

if [[ ! -d "$REPO/.git" ]]; then
  echo "ERROR: $REPO is not a Git repository"
  exit 1
fi
if [[ ! -f "$RUNNER" ]]; then
  echo "ERROR: Coinbase crypto-futures paper runner missing: $RUNNER"
  exit 1
fi
if [[ ! -x "$HERMES_BIN" ]]; then
  HERMES_BIN="$(command -v hermes || true)"
fi
if [[ -z "$HERMES_BIN" || ! -x "$HERMES_BIN" ]]; then
  echo "ERROR: Hermes CLI is required for MTF v2 supervisory gating"
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
    <key>HERMES_BIN</key>
    <string>$HERMES_BIN</string>
  </dict>
</dict>
</plist>
EOF

plutil -lint "$PLIST" >/dev/null
launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
rm -f "$RUNTIME/status.json"
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/com.nicholas.coinbase-crypto-futures-paper"

verified=0
for _ in {1..75}; do
  if [[ -f "$RUNTIME/status.json" ]] \
    && grep -q '"paper_only": true' "$RUNTIME/status.json" \
    && grep -q '"live_execution_enabled": false' "$RUNTIME/status.json" \
    && grep -q '"strategy": "coinbase_crypto_futures_mtf_hermes_v2"' "$RUNTIME/status.json" \
    && grep -q '"hermes_supervisor_enabled": true' "$RUNTIME/status.json"; then
    verified=1
    break
  fi
  sleep 1
done

if [[ "$verified" -ne 1 ]]; then
  echo "ERROR: Coinbase MTF + Hermes feed did not produce a verified v2 status"
  [[ -f "$RUNTIME/status.json" ]] && cat "$RUNTIME/status.json"
  exit 1
fi

# No Coinbase credentials are accepted or written. This system is public-data,
# paper-execution only; Hermes can only accept/reduce/reject deterministic setups.
echo "COINBASE_CRYPTO_FUTURES_PAPER_INSTALLED=1"
echo "COINBASE_CRYPTO_FUTURES_MTF=1"
echo "COINBASE_CRYPTO_FUTURES_HERMES_SUPERVISOR=1"
echo "COINBASE_CRYPTO_FUTURES_LIVE_EXECUTION=0"
echo "COINBASE_CRYPTO_FUTURES_PUBLIC_DATA_ONLY=1"
echo "COINBASE_CRYPTO_FUTURES_INTERVAL_SECONDS=60"
echo "COINBASE_CRYPTO_FUTURES_STATUS=$RUNTIME/status.json"
echo "COINBASE_CRYPTO_FUTURES_LOG=$LOG"
cat "$RUNTIME/status.json"
